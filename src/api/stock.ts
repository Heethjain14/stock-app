import { DEFAULT_LOW_STOCK_THRESHOLD } from '../domain/clothing';
import { supabase } from '../lib/supabase';
import type {
  MovementMode,
  NewStockItem,
  StockFilters,
  StockItem,
  StockMovement,
} from '../types/stock';
import { generateStockId } from '../utils/generateId';

export class StockApiError extends Error {
  readonly cause: unknown;
  readonly code?: string;

  constructor(message: string, cause?: unknown, code?: string) {
    super(message);
    this.name = 'StockApiError';
    this.cause = cause;
    this.code = code;
  }
}

type PgLikeError = { message?: string; code?: string };

function toApiError(error: unknown, fallback: string): StockApiError {
  if (error instanceof StockApiError) return error;
  const e = (error ?? {}) as PgLikeError;
  const raw = typeof e.message === 'string' ? e.message : '';
  let message = fallback;
  if (/network request failed|failed to fetch|network error/i.test(raw)) {
    message = 'Cannot reach the server. Check your internet connection and try again.';
  } else if (e.code === '23505') {
    message = 'That record already exists.';
  } else if (e.code === '42501' || /row-level security|permission denied/i.test(raw)) {
    message = 'You do not have permission to do that.';
  } else if (e.code === 'P0001' && raw) {
    // Business-rule errors raised by our own RPC (e.g. "already received").
    message = raw;
  } else if (/jwt|not authenticated/i.test(raw)) {
    message = 'Your session has expired. Please sign in again.';
  }
  return new StockApiError(message, error, e.code);
}

// Escapes a user string for use inside a double-quoted PostgREST filter value with ilike.
function quoteLikeValue(input: string): string {
  const cleaned = input.trim().replace(/["\\]/g, '');
  const likeEscaped = cleaned.replace(/[%_]/g, (m) => `\\${m}`);
  // Inside a PostgREST double-quoted value a backslash must itself be escaped.
  return likeEscaped.replace(/\\/g, '\\\\');
}

export async function listItems(
  filters: StockFilters,
  page = 1,
  pageSize = 20,
): Promise<{ items: StockItem[]; total: number }> {
  try {
    const safePage = Math.max(1, Math.floor(page));
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('stock_items').select('*', { count: 'exact' });

    const search = filters.search?.trim();
    if (search) {
      const q = quoteLikeValue(search);
      if (q) query = query.or(`name.ilike."%${q}%",barcode.ilike."%${q}%"`);
    }
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.gender) query = query.eq('gender', filters.gender);
    if (filters.size) query = query.eq('size', filters.size);
    if (filters.color) query = query.eq('color', filters.color);
    if (filters.lot_number) query = query.eq('lot_number', filters.lot_number);
    if (filters.quality) query = query.eq('quality', filters.quality);
    if (filters.lowStockOnly) {
      // Simplification: uses the default threshold, not each item's own low_stock_threshold.
      query = query.not('quantity', 'is', null).lte('quantity', DEFAULT_LOW_STOCK_THRESHOLD);
    }

    if (filters.status === 'low') {
      query = query.gt('quantity', 0).lte('quantity', DEFAULT_LOW_STOCK_THRESHOLD);
    } else if (filters.status === 'out') {
      query = query.eq('quantity', 0);
    } else if (filters.status === 'pending') {
      query = query.is('quantity', null);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { items: (data ?? []) as StockItem[], total: count ?? 0 };
  } catch (e) {
    throw toApiError(e, 'Could not load stock items.');
  }
}

export async function getItemByBarcode(barcode: string): Promise<StockItem | null> {
  try {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('barcode', barcode.trim())
      .maybeSingle();
    if (error) throw error;
    return (data as StockItem | null) ?? null;
  } catch (e) {
    throw toApiError(e, 'Could not look up that barcode.');
  }
}

export async function getItemById(id: string): Promise<StockItem | null> {
  try {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as StockItem | null) ?? null;
  } catch (e) {
    throw toApiError(e, 'Could not load that item.');
  }
}

const MAX_BARCODE_ATTEMPTS = 5;

export async function createItem(input: NewStockItem): Promise<StockItem> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const createdBy = sessionData.session?.user.id ?? null;

    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_BARCODE_ATTEMPTS; attempt++) {
      const { data, error } = await supabase
        .from('stock_items')
        .insert({ ...input, barcode: generateStockId(input.category), created_by: createdBy })
        .select('*')
        .single();
      if (!error) return data as StockItem;
      if (error.code !== '23505') throw error;
      lastError = error; // barcode collision, try a new one
    }
    throw new StockApiError(
      'Could not generate a unique barcode. Please try again.',
      lastError,
      '23505',
    );
  } catch (e) {
    throw toApiError(e, 'Could not create the item.');
  }
}

export async function updateItemDetails(
  id: string,
  patch: Partial<NewStockItem>,
): Promise<StockItem> {
  try {
    const { data, error } = await supabase
      .from('stock_items')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      // RLS silently filters non-admin updates to zero rows.
      throw new StockApiError('Item not found, or you do not have permission to edit it.');
    }
    return data as StockItem;
  } catch (e) {
    throw toApiError(e, 'Could not update the item.');
  }
}

export async function recordMovement(
  itemId: string,
  mode: MovementMode,
  amount: number,
  note?: string,
): Promise<StockItem> {
  try {
    const { data, error } = await supabase.rpc('record_movement', {
      p_item_id: itemId,
      p_mode: mode,
      p_amount: amount,
      p_note: note ?? null,
    });
    if (error) throw error;
    return data as StockItem;
  } catch (e) {
    throw toApiError(e, 'Could not record the stock movement.');
  }
}

export async function listMovements(itemId: string, limit = 50): Promise<StockMovement[]> {
  try {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as StockMovement[];
  } catch (e) {
    throw toApiError(e, 'Could not load the movement history.');
  }
}

async function countItems(
  apply: (q: ReturnType<typeof baseCount>) => ReturnType<typeof baseCount>,
): Promise<number> {
  const { count, error } = await apply(baseCount());
  if (error) throw error;
  return count ?? 0;
}

function baseCount() {
  return supabase.from('stock_items').select('id', { count: 'exact', head: true });
}

export async function getDashboardStats(): Promise<{
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  notReceived: number;
}> {
  try {
    const [totalItems, lowStock, outOfStock, notReceived] = await Promise.all([
      countItems((q) => q),
      // Simplification: default threshold (see listItems); out-of-stock (0) is counted separately.
      countItems((q) => q.gt('quantity', 0).lte('quantity', DEFAULT_LOW_STOCK_THRESHOLD)),
      countItems((q) => q.eq('quantity', 0)),
      countItems((q) => q.is('quantity', null)),
    ]);
    return { totalItems, lowStock, outOfStock, notReceived };
  } catch (e) {
    throw toApiError(e, 'Could not load dashboard stats.');
  }
}

function distinctSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = typeof v === 'string' ? v.trim() : '';
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export async function getFilterOptions(): Promise<{
  colors: string[];
  lotNumbers: string[];
  qualities: string[];
  sizes: string[];
}> {
  try {
    const { data, error } = await supabase
      .from('stock_items')
      .select('color, lot_number, quality, size')
      .limit(1000);
    if (error) throw error;
    const rows = (data ?? []) as Pick<StockItem, 'color' | 'lot_number' | 'quality' | 'size'>[];
    return {
      colors: distinctSorted(rows.map((r) => r.color)),
      lotNumbers: distinctSorted(rows.map((r) => r.lot_number)),
      qualities: distinctSorted(rows.map((r) => r.quality)),
      sizes: distinctSorted(rows.map((r) => r.size)),
    };
  } catch (e) {
    throw toApiError(e, 'Could not load filter options.');
  }
}

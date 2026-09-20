import type { Category, Gender, Season } from '../domain/clothing';

// quantity === null means "not received yet" (QR created, stock never counted).
export type StockItem = {
  id: string;
  barcode: string;
  name: string;
  category: Category | null;
  gender: Gender | null;
  fabric: string | null;
  size: string | null;
  color: string | null;
  season: Season | null;
  lot_number: string | null;
  quality: string | null;
  other_specs: string | null;
  unit: string;
  quantity: number | null;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type NewStockItem = Omit<
  StockItem,
  'id' | 'quantity' | 'created_at' | 'updated_at' | 'created_by' | 'low_stock_threshold'
> & { low_stock_threshold?: number };

export type MovementMode = 'add' | 'subtract' | 'set' | 'receive';

export type StockMovement = {
  id: string;
  item_id: string;
  mode: MovementMode;
  delta: number;
  resulting_quantity: number;
  note: string | null;
  actor: string | null;
  actor_email: string | null;
  created_at: string;
};

export type StockFilters = {
  search?: string;
  category?: Category | null;
  gender?: Gender | null;
  size?: string | null;
  color?: string | null;
  lot_number?: string | null;
  quality?: string | null;
  lowStockOnly?: boolean;
  status?: 'low' | 'out' | 'pending';
};

export type StockStatus = 'not_received' | 'out' | 'low' | 'ok';

export function stockStatus(item: Pick<StockItem, 'quantity' | 'low_stock_threshold'>): StockStatus {
  if (item.quantity === null) return 'not_received';
  if (item.quantity === 0) return 'out';
  if (item.quantity <= item.low_stock_threshold) return 'low';
  return 'ok';
}

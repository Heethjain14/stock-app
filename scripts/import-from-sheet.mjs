#!/usr/bin/env node
/**
 * Import stock from the OLD Google Sheet (exported as CSV) into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/import-from-sheet.mjs --file old-stock.csv --dry-run
 *   ... same without --dry-run to really import.
 *
 * Flags:
 *   --file <path>                 CSV path (or pass it as the first bare argument)
 *   --dry-run                     Parse + validate + report; write nothing
 *   --default-category "<Label>"  Use this clothing category for old categories that
 *                                 are not in CATEGORY_MAP (otherwise those rows are skipped)
 *
 * Env (never commit these, never put the service key in the app):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     service_role key (bypasses RLS). NOT the anon key.
 *
 * Old barcodes are kept so QR labels already printed keep working.
 * Idempotent: barcodes that already exist in Supabase are skipped.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// EDIT ME: old sheet category (case-insensitive) -> new clothing category.
// Set a value to null to leave that category unmapped (rows are reported and
// skipped, unless you pass --default-category). The values below are only
// guesses - the old sheet was not clothing-specific.
// ---------------------------------------------------------------------------
const CATEGORY_MAP = {
  Electronics: null,
  Stationery: null,
  Beverages: null,
  Produce: null,
  'Packaged goods': 'Accessories',
  General: 'Accessories',
};

const CLOTHING_CATEGORIES = [
  'Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Ethnic wear',
  'Innerwear', 'Activewear', 'Kidswear', 'Accessories',
];

const IMPORT_NOTE = 'Imported from Google Sheet';
const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { file: null, dryRun: false, defaultCategory: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--file') out.file = argv[++i];
    else if (a.startsWith('--file=')) out.file = a.slice(7);
    else if (a === '--default-category') out.defaultCategory = argv[++i];
    else if (a.startsWith('--default-category=')) out.defaultCategory = a.slice(19);
    else if (!a.startsWith('--') && !out.file) out.file = a;
    else fail(`Unknown argument: ${a}`);
  }
  return out;
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV parser (RFC 4180-ish): quoted fields, escaped quotes, embedded
// commas/newlines, CRLF, UTF-8 BOM.
// ---------------------------------------------------------------------------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
const blankToNull = (v) => {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
};

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function buildCategoryLookup() {
  const map = new Map();
  for (const [k, v] of Object.entries(CATEGORY_MAP)) map.set(k.trim().toLowerCase(), v);
  for (const c of CLOTHING_CATEGORIES) if (!map.has(c.toLowerCase())) map.set(c.toLowerCase(), c);
  return map;
}

function mapRow(rec, lookup, defaultCategory, warnings, lineNo) {
  const barcode = (rec.barcode ?? '').trim();
  const name = (rec.name ?? '').trim();
  if (!barcode) return { skip: 'missing barcode' };
  if (!name) return { skip: 'missing name' };

  const oldCat = (rec.category ?? '').trim();
  let category = lookup.get(oldCat.toLowerCase());
  let unmappedCategory = null;
  if (!category) {
    if (defaultCategory) category = defaultCategory;
    else unmappedCategory = oldCat || '(blank)';
  }
  if (unmappedCategory) return { skip: 'unmapped category', unmappedCategory };

  let quantity = null;
  const qRaw = (rec.quantity ?? '').trim();
  if (qRaw !== '') {
    const n = Number(qRaw.replace(/,/g, ''));
    if (!Number.isFinite(n)) {
      warnings.push(`line ${lineNo} (${barcode}): quantity "${qRaw}" is not a number -> left blank (NULL)`);
    } else {
      let q = Math.round(n);
      if (q < 0) { warnings.push(`line ${lineNo} (${barcode}): negative quantity ${qRaw} -> 0`); q = 0; }
      quantity = q;
    }
  }

  let movedAt = null;
  const lu = (rec.last_updated ?? '').trim();
  if (lu) {
    const d = new Date(lu);
    if (!Number.isNaN(d.getTime())) movedAt = d.toISOString();
  }

  return {
    item: {
      barcode,
      name,
      category,
      lot_number: blankToNull(rec.lot_number),
      quality: blankToNull(rec.quality),
      color: blankToNull(rec.color),
      other_specs: blankToNull(rec.other_specs),
      unit: blankToNull(rec.unit) ?? 'pcs',
      quantity,
      created_by: null,
    },
    movedAt,
  };
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
function jwtRole(key) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload.role ?? null;
  } catch {
    return null; // new-style sb_secret_... keys are not JWTs
  }
}

async function fetchExistingBarcodes(supabase) {
  const existing = new Set();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('stock_items')
      .select('barcode')
      .order('barcode')
      .range(from, from + page - 1);
    if (error) throw new Error(`Could not read existing barcodes: ${error.message}`);
    for (const r of data) existing.add(r.barcode);
    if (data.length < page) break;
  }
  return existing;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) fail('Missing CSV path. Use --file <path>.');

  let defaultCategory = null;
  if (args.defaultCategory) {
    defaultCategory = CLOTHING_CATEGORIES.find(
      (c) => c.toLowerCase() === args.defaultCategory.trim().toLowerCase(),
    );
    if (!defaultCategory) {
      fail(`--default-category must be one of: ${CLOTHING_CATEGORIES.join(', ')}`);
    }
  }

  let text;
  try { text = readFileSync(args.file, 'utf8'); }
  catch (e) { fail(`Cannot read ${args.file}: ${e.message}`); }

  const rows = parseCsv(text);
  if (rows.length < 2) fail('CSV has no data rows.');

  const headers = rows[0].map(normalizeHeader);
  for (const required of ['barcode', 'name', 'category']) {
    if (!headers.includes(required)) fail(`CSV is missing required column "${required}". Found: ${headers.join(', ')}`);
  }

  const lookup = buildCategoryLookup();
  const warnings = [];
  const skipped = { 'missing barcode': 0, 'missing name': 0, duplicate: 0 };
  const unmapped = new Map(); // old category -> count
  const toImport = [];
  const seen = new Set();

  rows.slice(1).forEach((cells, idx) => {
    const lineNo = idx + 2;
    const rec = {};
    headers.forEach((h, i) => { rec[h] = cells[i] ?? ''; });
    const res = mapRow(rec, lookup, defaultCategory, warnings, lineNo);
    if (res.skip === 'unmapped category') {
      unmapped.set(res.unmappedCategory, (unmapped.get(res.unmappedCategory) ?? 0) + 1);
      return;
    }
    if (res.skip) { skipped[res.skip]++; return; }
    if (seen.has(res.item.barcode)) {
      skipped.duplicate++;
      warnings.push(`line ${lineNo}: duplicate barcode ${res.item.barcode} in file -> skipped`);
      return;
    }
    seen.add(res.item.barcode);
    toImport.push(res);
  });

  // Supabase connection
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabase = null;
  if (url && key) {
    if (jwtRole(key) === 'anon') fail('SUPABASE_SERVICE_ROLE_KEY looks like the ANON key. Use the service_role key.');
    supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  } else if (!args.dryRun) {
    fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  } else {
    console.log('Note: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set - dry run will not check for existing barcodes.\n');
  }

  let existing = new Set();
  if (supabase) existing = await fetchExistingBarcodes(supabase);

  const fresh = toImport.filter((r) => !existing.has(r.item.barcode));
  const alreadyThere = toImport.length - fresh.length;

  let inserted = 0;
  let movementsInserted = 0;
  const failures = [];

  if (!args.dryRun && fresh.length > 0) {
    for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
      const batch = fresh.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('stock_items')
        .insert(batch.map((r) => r.item))
        .select('id, barcode, quantity');
      if (error) {
        failures.push(`Batch starting at row ${i + 1} failed: ${error.message}`);
        continue;
      }
      inserted += data.length;

      const movedAtByBarcode = new Map(batch.map((r) => [r.item.barcode, r.movedAt]));
      const movements = data
        .filter((d) => d.quantity !== null)
        .map((d) => {
          const m = {
            item_id: d.id,
            mode: 'receive',
            delta: d.quantity,
            resulting_quantity: d.quantity,
            note: IMPORT_NOTE,
            actor: null,
            actor_email: 'import-script',
          };
          const at = movedAtByBarcode.get(d.barcode);
          if (at) m.created_at = at;
          return m;
        });
      if (movements.length > 0) {
        const { error: mErr } = await supabase.from('stock_movements').insert(movements);
        if (mErr) failures.push(`Movements for batch at row ${i + 1} failed (items were inserted): ${mErr.message}`);
        else movementsInserted += movements.length;
      }
    }
  }

  // Summary
  const withQty = fresh.filter((r) => r.item.quantity !== null).length;
  console.log('=== Import summary' + (args.dryRun ? ' (DRY RUN - nothing written)' : '') + ' ===');
  console.log(`Rows in CSV:                  ${rows.length - 1}`);
  console.log(`Valid rows:                   ${toImport.length}`);
  console.log(`Already in Supabase (skipped): ${alreadyThere}${supabase ? '' : ' (not checked)'}`);
  console.log(args.dryRun
    ? `Would insert:                 ${fresh.length} items (${withQty} with quantity, ${fresh.length - withQty} blank/NULL)`
    : `Inserted:                     ${inserted} items, ${movementsInserted} receive movements`);
  console.log(`Skipped, missing barcode:     ${skipped['missing barcode']}`);
  console.log(`Skipped, missing name:        ${skipped['missing name']}`);
  console.log(`Skipped, duplicate in file:   ${skipped.duplicate}`);
  const unmappedTotal = [...unmapped.values()].reduce((a, b) => a + b, 0);
  console.log(`Skipped, unmapped category:   ${unmappedTotal}`);
  if (unmapped.size > 0) {
    console.log('\nUnmapped old categories (edit CATEGORY_MAP at top of this file, or use --default-category "<Label>"):');
    for (const [c, n] of unmapped) console.log(`  - ${c}: ${n} rows`);
  }
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.slice(0, 50).forEach((w) => console.log('  - ' + w));
    if (warnings.length > 50) console.log(`  ... and ${warnings.length - 50} more`);
  }
  if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
}

main().catch((e) => fail(e.message));

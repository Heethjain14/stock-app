import { BARCODE_PREFIX, CATEGORIES, type Category } from '../domain/clothing';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 6;

function randomValues(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function randomSuffix(length: number = SUFFIX_LENGTH): string {
  const bytes = randomValues(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    // Modulo bias is negligible for a label suffix (256 % 32 === 0, so none in fact).
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

export function generateStockId(category: Category | null): string {
  const entry = CATEGORIES.find((c) => c.label === category);
  const prefix = entry ? entry.prefix : 'GEN';
  return `${BARCODE_PREFIX}${prefix}-${randomSuffix()}`;
}

// Legacy 4-char labels still validate.
export function isStockBarcode(value: string): boolean {
  return /^STOCK-[A-Z]{3}-[A-Z0-9]{4,6}$/.test(value);
}

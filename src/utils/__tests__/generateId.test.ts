import { CATEGORIES } from '../../domain/clothing';
import { generateStockId, isStockBarcode } from '../generateId';

const FORMAT = /^STOCK-([A-Z]{3})-([A-Z0-9]{6})$/;
const ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

describe('generateStockId', () => {
  it('produces STOCK-<PREFIX>-<6 chars>', () => {
    const id = generateStockId('Tops');
    expect(id).toMatch(FORMAT);
    expect(id).toHaveLength('STOCK-TOP-'.length + 6);
  });

  it('uses the correct prefix for all 9 categories', () => {
    expect(CATEGORIES).toHaveLength(9);
    for (const { label, prefix } of CATEGORIES) {
      const id = generateStockId(label);
      expect(id.startsWith(`STOCK-${prefix}-`)).toBe(true);
      expect(id).toMatch(FORMAT);
    }
  });

  it('only uses the unambiguous charset (no 0, 1, I, O)', () => {
    for (let i = 0; i < 100; i++) {
      const suffix = generateStockId('Accessories').split('-')[2];
      expect(suffix).toMatch(ALLOWED);
      expect(suffix).not.toMatch(/[01IO]/);
    }
  });

  it('is unique across 200 generations', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(generateStockId('Bottoms'));
    expect(ids.size).toBe(200);
  });

  it('always generates ids that pass isStockBarcode', () => {
    for (const { label } of CATEGORIES) {
      expect(isStockBarcode(generateStockId(label))).toBe(true);
    }
  });
});

describe('isStockBarcode', () => {
  it('accepts new 6-char labels', () => {
    expect(isStockBarcode('STOCK-TOP-A2B3C4')).toBe(true);
    expect(isStockBarcode('STOCK-KID-ZZZZZZ')).toBe(true);
  });

  it('accepts legacy 4-char labels', () => {
    expect(isStockBarcode('STOCK-TOP-A2B3')).toBe(true);
    expect(isStockBarcode('STOCK-ACC-0001')).toBe(true);
  });

  it('rejects invalid values', () => {
    const invalid = [
      '',
      'STOCK-',
      'STOCK-TOP-',
      'STOCK-TOP-ABC',
      'STOCK-TOP-ABCDEFG',
      'STOCK-TO-ABCDEF',
      'STOCK-TOPS-ABCDEF',
      'stock-top-abcdef',
      'STOCK-TOP-ABC$EF',
      'XSTOCK-TOP-ABCDEF',
      'STOCK-TOP-ABCDEF ',
      ' STOCK-TOP-ABCDEF',
      'https://example.com',
      '1234567890123',
    ];
    for (const value of invalid) expect(isStockBarcode(value)).toBe(false);
  });
});

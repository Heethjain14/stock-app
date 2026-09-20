export const CATEGORIES = [
  { label: 'Tops', prefix: 'TOP' },
  { label: 'Bottoms', prefix: 'BTM' },
  { label: 'Outerwear', prefix: 'OUT' },
  { label: 'Dresses', prefix: 'DRS' },
  { label: 'Ethnic wear', prefix: 'ETH' },
  { label: 'Innerwear', prefix: 'INN' },
  { label: 'Activewear', prefix: 'ACT' },
  { label: 'Kidswear', prefix: 'KID' },
  { label: 'Accessories', prefix: 'ACC' },
] as const;

export type Category = (typeof CATEGORIES)[number]['label'];
export const CATEGORY_LABELS = CATEGORIES.map((c) => c.label) as Category[];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free size'] as const;

export const FABRICS = [
  'Cotton',
  'Linen',
  'Polyester',
  'Denim',
  'Wool',
  'Silk',
  'Rayon',
  'Blend',
] as const;

export const SEASONS = ['Spring/Summer', 'Autumn/Winter', 'All season'] as const;
export type Season = (typeof SEASONS)[number];

export const QUALITIES = ['Premium', 'Grade A', 'Grade B', 'Seconds'] as const;

export const UNITS = ['pcs', 'pair', 'set', 'box'] as const;

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const BARCODE_PREFIX = 'STOCK-';

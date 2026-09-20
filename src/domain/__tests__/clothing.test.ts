import {
  CATEGORIES,
  CATEGORY_LABELS,
  FABRICS,
  GENDERS,
  QUALITIES,
  SEASONS,
  SIZES,
  UNITS,
} from '../clothing';

describe('CATEGORIES', () => {
  it('has a 3-letter uppercase prefix for every category', () => {
    for (const c of CATEGORIES) {
      expect(c.prefix).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('has unique prefixes', () => {
    const prefixes = CATEGORIES.map((c) => c.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('has unique labels, matching CATEGORY_LABELS', () => {
    const labels = CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(CATEGORY_LABELS).toEqual(labels);
  });
});

describe('option lists', () => {
  const lists: Record<string, readonly string[]> = {
    GENDERS,
    SIZES,
    FABRICS,
    SEASONS,
    QUALITIES,
    UNITS,
  };

  it.each(Object.keys(lists))('%s has no duplicate entries', (name) => {
    const list = lists[name];
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list).size).toBe(list.length);
  });
});

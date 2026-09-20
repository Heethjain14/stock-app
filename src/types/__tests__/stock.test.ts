import { stockStatus } from '../stock';

describe('stockStatus', () => {
  it('returns not_received when quantity is null', () => {
    expect(stockStatus({ quantity: null, low_stock_threshold: 5 })).toBe('not_received');
  });

  it('returns out when quantity is 0', () => {
    expect(stockStatus({ quantity: 0, low_stock_threshold: 5 })).toBe('out');
  });

  it('returns low below the threshold', () => {
    expect(stockStatus({ quantity: 1, low_stock_threshold: 5 })).toBe('low');
  });

  it('returns low exactly at the threshold', () => {
    expect(stockStatus({ quantity: 5, low_stock_threshold: 5 })).toBe('low');
  });

  it('returns ok just above the threshold', () => {
    expect(stockStatus({ quantity: 6, low_stock_threshold: 5 })).toBe('ok');
  });

  it('treats 0 as out even when the threshold is 0', () => {
    expect(stockStatus({ quantity: 0, low_stock_threshold: 0 })).toBe('out');
    expect(stockStatus({ quantity: 1, low_stock_threshold: 0 })).toBe('ok');
  });
});

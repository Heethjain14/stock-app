import React from 'react';
import { stockStatus, type StockItem } from '../../types/stock';
import { Badge } from './Badge';

export type StockStatusBadgeProps = {
  item: Pick<StockItem, 'quantity' | 'low_stock_threshold' | 'unit'>;
};

export function StockStatusBadge({ item }: StockStatusBadgeProps) {
  const status = stockStatus(item);
  const qty = `${item.quantity ?? 0} ${item.unit}`;
  switch (status) {
    case 'not_received':
      return <Badge tone="neutral" label="Not received" />;
    case 'out':
      return <Badge tone="danger" label="Out of stock" />;
    case 'low':
      return <Badge tone="warning" label={`Low · ${qty}`} />;
    default:
      return <Badge tone="success" label={qty} />;
  }
}

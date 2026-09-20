-- Category is no longer required when creating an item (the New item form only
-- asks for name, lot, quality, color, quantity and notes).
alter table public.stock_items alter column category drop not null;

alter table public.stock_items drop constraint if exists stock_items_category_check;
alter table public.stock_items add constraint stock_items_category_check
  check (category is null or category in (
    'Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Ethnic wear',
    'Innerwear', 'Activewear', 'Kidswear', 'Accessories'));

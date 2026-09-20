-- =====================================================================
-- seed.sql  -  DEVELOPMENT SAMPLE DATA ONLY.  DO NOT RUN IN PRODUCTION.
-- Run in the Supabase SQL editor after 0001_init.sql. Re-runnable
-- (existing barcodes are skipped). created_by is NULL for all rows.
-- To remove the samples afterwards:
--   delete from public.stock_items where lot_number like 'SEED-%';
-- =====================================================================

with ins as (
  insert into public.stock_items
    (barcode, name, category, gender, fabric, size, color, season, lot_number, quality, other_specs, unit, quantity, low_stock_threshold, created_by)
  values
    ('STOCK-TOP-K7M2QX', 'Oxford Shirt',             'Tops',        'Men',    'Cotton',    'L',         'Blue',       'Spring/Summer', 'SEED-L2401', 'Grade A', 'Button-down collar',   'pcs', 42,   5,  null),
    ('STOCK-TOP-R4WN8D', 'Oxford Shirt',             'Tops',        'Men',    'Cotton',    'M',         'White',      'Spring/Summer', 'SEED-L2401', 'Grade A', 'Button-down collar',   'pcs', 3,    5,  null),
    ('STOCK-DRS-H9T3VC', 'Linen Dress',              'Dresses',     'Women',  'Linen',     'M',         'Beige',      'Spring/Summer', 'SEED-L2402', 'Premium', 'Knee length, pockets', 'pcs', 18,   5,  null),
    ('STOCK-OUT-P2X6ZB', 'Denim Jacket',             'Outerwear',   'Unisex', 'Denim',     'L',         'Indigo',     'All season',    'SEED-L2403', 'Premium', null,                   'pcs', 7,    5,  null),
    ('STOCK-BTM-C8F5LJ', 'Slim Fit Chinos',          'Bottoms',     'Men',    'Cotton',    'L',         'Khaki',      'All season',    'SEED-L2404', 'Grade A', '4-way stretch',        'pcs', 25,   5,  null),
    ('STOCK-ETH-W3Y7NA', 'Cotton Kurti',             'Ethnic wear', 'Women',  'Cotton',    'M',         'Maroon',     'All season',    'SEED-L2405', 'Grade A', 'Block print',          'pcs', null, 5,  null),
    ('STOCK-OUT-M5G9SE', 'Wool Winter Coat',         'Outerwear',   'Women',  'Wool',      'S',         'Charcoal',   'Autumn/Winter', 'SEED-L2406', 'Premium', 'Fully lined',          'pcs', 0,    3,  null),
    ('STOCK-INN-T6Q4HK', 'Boxer Briefs (pack of 3)', 'Innerwear',   'Men',    'Cotton',    'XL',        'Black',      'All season',    'SEED-L2407', 'Grade A', null,                   'set', 60,   10, null),
    ('STOCK-ACT-D2B8RP', 'Dry-fit Running Tee',      'Activewear',  'Unisex', 'Polyester', 'M',         'Neon Green', 'Spring/Summer', 'SEED-L2408', 'Grade A', 'Moisture wicking',     'pcs', 4,    5,  null),
    ('STOCK-KID-V7J3XM', 'Graphic T-shirt',          'Kidswear',    'Boys',   'Cotton',    'S',         'Red',        'Spring/Summer', 'SEED-L2409', 'Grade B', null,                   'pcs', 30,   5,  null),
    ('STOCK-ACC-N9E5UF', 'Silk Scarf',               'Accessories', 'Women',  'Silk',      'Free size', 'Emerald',    'Autumn/Winter', 'SEED-L2410', 'Premium', '90x90 cm',             'pcs', null, 5,  null),
    ('STOCK-KID-Z4A6TW', 'Denim Skirt',              'Kidswear',    'Girls',  'Denim',     'XS',        'Light Blue', 'Spring/Summer', 'SEED-L2411', 'Seconds', 'Minor stitch flaws',   'pcs', 12,   5,  null)
  on conflict (barcode) do nothing
  returning id, quantity
)
insert into public.stock_movements (item_id, mode, delta, resulting_quantity, note, actor, actor_email)
select id, 'receive', quantity, quantity, 'Seed data (dev only)', null, 'seed@local'
from ins
where quantity is not null;

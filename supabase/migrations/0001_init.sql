-- =====================================================================
-- 0001_init.sql  -  Clothing stock app: schema, RLS, and RPC
-- Safe to run in the Supabase SQL editor as ONE script (re-runnable).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: updated_at trigger function
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users that already exist.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;

-- Admin check used by RLS policies. SECURITY DEFINER avoids policy recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- stock_items
-- ---------------------------------------------------------------------
create table if not exists public.stock_items (
  id                  uuid primary key default gen_random_uuid(),
  barcode             text not null unique,
  name                text not null,
  category            text not null check (category in (
                        'Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Ethnic wear',
                        'Innerwear', 'Activewear', 'Kidswear', 'Accessories')),
  gender              text null check (gender is null or gender in
                        ('Men', 'Women', 'Unisex', 'Boys', 'Girls')),
  fabric              text null,
  size                text null,
  color               text null,
  season              text null check (season is null or season in
                        ('Spring/Summer', 'Autumn/Winter', 'All season')),
  lot_number          text null,
  quality             text null,
  other_specs         text null,
  unit                text not null default 'pcs',
  -- NULL = QR label created but stock never received/counted
  quantity            integer null check (quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id)
);

create index if not exists stock_items_category_idx   on public.stock_items (category);
create index if not exists stock_items_name_lower_idx on public.stock_items (lower(name));
create index if not exists stock_items_lot_idx        on public.stock_items (lot_number);
create index if not exists stock_items_color_idx      on public.stock_items (color);
create index if not exists stock_items_size_idx       on public.stock_items (size);
-- (barcode is already indexed by its UNIQUE constraint)

drop trigger if exists stock_items_set_updated_at on public.stock_items;
create trigger stock_items_set_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

-- Guard: signed-in users (even admins) cannot change quantity directly through
-- the API; it must go through record_movement so it is always logged.
-- (The SQL editor / service role have auth.uid() = null and are not blocked.)
create or replace function public.guard_quantity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quantity is distinct from old.quantity
     and auth.uid() is not null
     and coalesce(current_setting('app.movement_rpc', true), '') <> 'on' then
    raise exception 'Quantity can only be changed via record_movement()';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_items_guard_quantity on public.stock_items;
create trigger stock_items_guard_quantity
  before update on public.stock_items
  for each row execute function public.guard_quantity_change();

-- ---------------------------------------------------------------------
-- stock_movements (append-only log; written only by record_movement)
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null references public.stock_items (id) on delete cascade,
  mode               text not null check (mode in ('add', 'subtract', 'set', 'receive')),
  delta              integer not null,
  resulting_quantity integer not null,
  note               text,
  actor              uuid references auth.users (id),
  actor_email        text,
  created_at         timestamptz not null default now()
);

create index if not exists stock_movements_item_created_idx
  on public.stock_movements (item_id, created_at desc);

-- ---------------------------------------------------------------------
-- RPC: record_movement
-- Locks the item row (FOR UPDATE) so two people scanning at once can never
-- overwrite each other's change (fixes the old lost-update race).
-- ---------------------------------------------------------------------
create or replace function public.record_movement(
  p_item_id uuid,
  p_mode    text,
  p_amount  integer,
  p_note    text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_item  public.stock_items;
  v_old   integer;
  v_new   integer;
  v_delta integer;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_mode is null or p_mode not in ('add', 'subtract', 'set', 'receive') then
    raise exception 'Invalid mode "%": must be add, subtract, set or receive', p_mode
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Amount must be a number >= 0' using errcode = '22023';
  end if;

  select * into v_item
  from public.stock_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  v_old := v_item.quantity;

  if p_mode = 'receive' then
    if v_old is not null then
      raise exception 'Item already has a quantity (%); use add, subtract or set', v_old
        using errcode = '22023';
    end if;
    v_new   := p_amount;
    v_delta := p_amount;
  else
    if v_old is null then
      raise exception 'Item has not been received yet; use mode "receive" to set its first quantity'
        using errcode = '22023';
    end if;

    if p_mode = 'add' then
      if v_old::bigint + p_amount > 2147483647 then
        raise exception 'Resulting quantity is too large' using errcode = '22003';
      end if;
      v_new := v_old + p_amount;
    elsif p_mode = 'subtract' then
      v_new := greatest(v_old - p_amount, 0);   -- clamp at 0
    else -- 'set'
      v_new := p_amount;
    end if;
    v_delta := v_new - v_old;                    -- ACTUAL change (after clamping)
  end if;

  select coalesce(u.email, p.email) into v_email
  from (select v_uid as id) x
  left join auth.users u on u.id = x.id
  left join public.profiles p on p.id = x.id;

  -- Allow the quantity guard trigger to pass for this transaction only.
  perform set_config('app.movement_rpc', 'on', true);

  update public.stock_items
     set quantity = v_new
   where id = p_item_id
   returning * into v_item;

  insert into public.stock_movements
    (item_id, mode, delta, resulting_quantity, note, actor, actor_email)
  values
    (p_item_id, p_mode, v_delta, v_new, p_note, v_uid, v_email);

  return v_item;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.stock_items     enable row level security;
alter table public.stock_movements enable row level security;

-- profiles: own row, admins see all. No write policies (roles are changed
-- only from the SQL editor / service role).
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- stock_items
drop policy if exists stock_items_select on public.stock_items;
create policy stock_items_select on public.stock_items
  for select to authenticated
  using (true);

drop policy if exists stock_items_insert on public.stock_items;
create policy stock_items_insert on public.stock_items
  for insert to authenticated
  with check (created_by = auth.uid() and quantity is null);

drop policy if exists stock_items_update_admin on public.stock_items;
create policy stock_items_update_admin on public.stock_items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists stock_items_delete_admin on public.stock_items;
create policy stock_items_delete_admin on public.stock_items
  for delete to authenticated
  using (public.is_admin());

-- stock_movements: read only; inserts happen inside record_movement.
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Privileges: nothing for anon; minimal for authenticated
-- ---------------------------------------------------------------------
revoke all on public.profiles        from anon, authenticated;
revoke all on public.stock_items     from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;

grant select                         on public.profiles        to authenticated;
grant select, insert, update, delete on public.stock_items     to authenticated;
grant select                         on public.stock_movements to authenticated;

revoke all on function public.record_movement(uuid, text, integer, text) from public, anon;
grant execute on function public.record_movement(uuid, text, integer, text) to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Future tables created in public should not be exposed to anon by default.
alter default privileges in schema public revoke all on tables from anon;

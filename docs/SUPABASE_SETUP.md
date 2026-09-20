# Supabase setup guide

This app stores stock in Supabase (Postgres + login). Follow the steps in order. You only do this once.

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Pick an organization, give the project a name (e.g. `clothing-stock`), and set a strong **database password** (save it in a password manager; the app does not need it).
3. Choose the **region closest to your shop/warehouse** (e.g. Mumbai for India). It cannot be changed later.
4. Plan: **Free** is fine to start. Click **Create new project** and wait a couple of minutes.

## 2. Create the tables (run the migration)

### Option A: SQL editor (easiest)

1. In the dashboard open **SQL Editor > New query**.
2. Open `supabase/migrations/0001_init.sql` from this repo, copy **all** of it, paste it, and click **Run**.
3. You should see "Success. No rows returned". The script is safe to run again.

### Option B: Supabase CLI

```bash
npm install -g supabase        # or: npx supabase ...
supabase login
supabase link --project-ref YOUR-PROJECT-REF   # the ref is the xxxx in https://xxxx.supabase.co
supabase db push
```

## 3. Authentication settings

1. **Authentication > Sign In / Providers** (or **Providers**): make sure **Email** is enabled. Keep "Confirm email" on or off as you prefer; users you create by hand are auto-confirmed (below).
2. Turn **off** public sign-ups: in **Authentication > Sign In / Providers** (older dashboards: **Authentication > Settings**) disable **Allow new users to sign up**. Otherwise anyone with your public app key could create an account.
3. Create your staff accounts: **Authentication > Users > Add user > Create new user**. Enter email + password and tick **Auto Confirm User**. Repeat for each person. A row in `profiles` is created automatically with role `staff`.

## 4. Make yourself the first admin

Admins can edit and delete items. Everyone else is `staff` (can view, create QR/items, and record stock movements).

In **SQL Editor**, run (replace the email):

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

Check: `select email, role from public.profiles;`

## 5. Connect the app

1. In the dashboard open **Project Settings > API** (or **Connect**). Copy the **Project URL** and the **anon / publishable** key.
2. In the repo, copy `.env.example` to `.env` and fill in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```

3. For cloud (EAS) builds the `.env` file is not uploaded, so create the variables in EAS:

   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT-REF.supabase.co" --environment production --visibility plaintext
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR-ANON-PUBLIC-KEY" --environment production --visibility plaintext
   ```

   Repeat with `--environment preview` (and `development`) if you build those profiles.

**Important**

- Variables starting with `EXPO_PUBLIC_` are baked into the app and **are public by design**. That is fine for the URL and the anon key: the real protection is **Row Level Security (RLS)** in the database, which the migration enables. Without a logged-in user, the anon key can read nothing.
- The **service role key** bypasses RLS. **Never** put it in `.env`, the app, or EAS `EXPO_PUBLIC_` variables. It is only used on your own computer by the import script (step 7).

## 6. Optional: load sample data (development only)

Open `supabase/seed.sql`, paste it into the SQL editor and run it. It adds 12 sample clothing items (some with no quantity yet, some low, one at 0). Remove them later with:

```sql
delete from public.stock_items where lot_number like 'SEED-%';
```

Do not seed your production project.

## 7. Migrate the old Google Sheet

The old QR labels (`STOCK-<CAT>-<4 chars>`) keep working because the import keeps the old barcodes.

1. In Google Sheets: **File > Download > Comma-separated values (.csv)**. Save it as e.g. `old-stock.csv` (columns: barcode, name, category, lot_number, quality, color, other_specs, quantity, unit, last_updated).
2. Open `scripts/import-from-sheet.mjs` and edit `CATEGORY_MAP` at the top so each old category (Electronics, Stationery, Beverages, Produce, Packaged goods, General) points to a clothing category (Tops, Bottoms, Outerwear, Dresses, Ethnic wear, Innerwear, Activewear, Kidswear, Accessories). Unmapped categories are reported and skipped, unless you pass `--default-category "Accessories"`.
3. Get the **service_role** key from **Project Settings > API** and set it for this terminal session only.

   PowerShell:
   ```powershell
   $env:SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY = "YOUR-SERVICE-ROLE-KEY"
   ```
   Bash:
   ```bash
   export SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE-KEY"
   ```

4. **Dry run** (writes nothing, prints what would happen):

   ```bash
   node scripts/import-from-sheet.mjs --file old-stock.csv --dry-run
   ```

5. **Real run** (re-running is safe; existing barcodes are skipped):

   ```bash
   node scripts/import-from-sheet.mjs --file old-stock.csv
   ```

   Items with a numeric quantity get that quantity plus one `receive` history entry ("Imported from Google Sheet"). Blank quantity stays empty (NULL = "not received yet").
6. **Verify counts** in the SQL editor and compare with the number of rows in your sheet:

   ```sql
   select count(*) as items, count(quantity) as with_quantity from public.stock_items;
   select count(*) from public.stock_movements where note = 'Imported from Google Sheet';
   ```

7. **Security cleanup:** the old app shipped the URL of your Google Apps Script web app inside its bundle, so anyone who extracted the app could call it. After the import is verified, open the Apps Script project > **Deploy > Manage deployments** and **archive/delete the web app deployment** (and consider making the Sheet private). Close the shell session or unset the service key when done.

## 8. Smoke tests (verify security)

Run these in the SQL editor (they run as admin/postgres, so RLS is simulated by switching role).

**a) Anon gets nothing**

```sql
begin;
set local role anon;
select count(*) from public.stock_items;   -- expect: ERROR permission denied
rollback;
```

Or from a terminal (should return an error/empty, never data):

```bash
curl "https://YOUR-PROJECT-REF.supabase.co/rest/v1/stock_items?select=*" -H "apikey: YOUR-ANON-PUBLIC-KEY"
```

**b) record_movement works and subtract clamps at 0** (simulates a logged-in user; replace the UUID with a user id from `select id, email from auth.users;`)

```sql
begin;
select set_config('request.jwt.claim.sub', 'USER-UUID-HERE', true);
set local role authenticated;

-- pick an item that has a quantity, note its id/qty
select id, name, quantity from public.stock_items where quantity is not null limit 1;

select quantity from public.record_movement('ITEM-UUID-HERE', 'add', 5, 'test');       -- +5
select quantity from public.record_movement('ITEM-UUID-HERE', 'subtract', 100000, 'test'); -- clamps to 0
select mode, delta, resulting_quantity from public.stock_movements
  where item_id = 'ITEM-UUID-HERE' order by created_at desc limit 2;   -- delta of the subtract = -(qty before), not -100000
rollback;   -- undo the test
```

**c) Direct quantity edits are blocked**

```sql
begin;
select set_config('request.jwt.claim.sub', 'USER-UUID-HERE', true);
set local role authenticated;
update public.stock_items set quantity = 999;   -- expect 0 rows (staff) or an error (admin)
rollback;
```

## 9. Troubleshooting

| Problem | Likely cause / fix |
| --- | --- |
| App says "Invalid login credentials" | User does not exist or was not auto-confirmed. Check **Authentication > Users**; re-create with **Auto Confirm User** ticked, or reset the password there. |
| Login works but the list is empty / "permission denied" | Migration not run (or partly failed), or the app is using the wrong project URL/key. Re-run `0001_init.sql`; check `.env` and restart Expo with `npx expo start -c` (env vars are read at start). |
| Cannot edit/delete an item ("0 rows" / RLS error) | Only admins can edit/delete. Promote the user with the SQL in step 4. Stock quantity changes always go through Add/Subtract/Set (`record_movement`), never direct edits. |
| "Item has not been received yet" | The QR was created but no quantity was ever entered. Use **Receive** (first count) instead of Add/Subtract/Set. |
| Import script: "Could not read existing barcodes" / 401 | You used the anon key or a wrong URL. Use the `service_role` key and the project URL, set in the same terminal. Do not run `node` from a different shell than the one where you set the variables. |
| EAS build has no Supabase config | `.env` is not uploaded. Create both `EXPO_PUBLIC_` variables with `eas env:create` for the profile's environment, then rebuild. |

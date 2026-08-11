-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- See README.md for the full project setup walkthrough.

-- One row per user, created right after signup. Holds the random salt used
-- to derive the client-side vault encryption key from the master password.
-- The salt itself is not secret -- it just needs to be unique per user and
-- never reused -- so storing it in plain text here is fine.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  kdf_salt text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "select own profile" on profiles
  for select using (auth.uid() = id);

create policy "insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- One row per saved credential. `encrypted_data` is the base64 AES-256-GCM
-- ciphertext of a JSON blob { title, url, email, username, password } --
-- nothing about a saved credential (not even the site name) is readable
-- without the master password.
create table if not exists vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_data text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vault_items enable row level security;

create policy "crud own vault items" on vault_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists vault_items_user_id_idx on vault_items(user_id);

-- Keep updated_at current on every edit.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists vault_items_set_updated_at on vault_items;
create trigger vault_items_set_updated_at
  before update on vault_items
  for each row execute function set_updated_at();

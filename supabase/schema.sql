-- ==============================================================================
-- Vault Database Schema & Zero-Trust Row-Level Security (RLS)
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Profiles Table: holds immutable Argon2id KDF salt & 2FA TOTP configuration per user
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  kdf_salt text not null,
  totp_enabled boolean not null default false,
  totp_secret text,
  totp_account text,
  totp_issuer text default 'MynexVault',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist if table was already created
alter table profiles add column if not exists totp_enabled boolean not null default false;
alter table profiles add column if not exists totp_secret text;
alter table profiles add column if not exists totp_account text;
alter table profiles add column if not exists totp_issuer text default 'MynexVault';
alter table profiles add column if not exists updated_at timestamptz not null default now();

-- Enforce Row Level Security (Zero-Trust: users can ONLY access their own profile)
alter table profiles enable row level security;

drop policy if exists "select own profile" on profiles;
create policy "select own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);


-- 2. Vault Items Table: holds client-side encrypted AES-256-GCM ciphertext blobs
create table if not exists vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_data text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce Row Level Security (Zero-Trust: users can ONLY access their own vault items)
alter table vault_items enable row level security;

drop policy if exists "crud own vault items" on vault_items;
create policy "crud own vault items" on vault_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists vault_items_user_id_idx on vault_items(user_id);


-- 3. Automatic updated_at Timestamps
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

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();


-- 4. Automatic Profile Creation Trigger on Auth Signup
-- Guarantees every user has an immutable salt immediately upon account creation,
-- avoiding RLS failures when email verification is required.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, kdf_salt, totp_enabled)
  values (new.id, encode(gen_random_bytes(16), 'base64'), false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

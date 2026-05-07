-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type member_status as enum ('active', 'cancelled', 'paused', 'contact');
create type fob_type as enum ('fob', 'remote');
create type fob_location as enum ('hexa', 'panorama', 'kai', 'other');
create type fob_status as enum ('available', 'assigned', 'lost', 'deactivated', 'retired');
create type deposit_status as enum ('pending', 'paid', 'refunded', 'waived', 'failed');

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table members (
  id               uuid primary key default gen_random_uuid(),
  officernd_id     text unique not null,
  name             text not null,
  company          text,
  email            text,
  suite            text,
  status           member_status not null default 'active',
  last_synced_at   timestamptz
);

create table fobs (
  id             uuid primary key default gen_random_uuid(),
  serial_number  text unique not null,
  type           fob_type not null,
  location       fob_location not null default 'hexa',
  status         fob_status not null default 'available',
  notes          text,
  created_at     timestamptz not null default now()
);

create table assignments (
  id                       uuid primary key default gen_random_uuid(),
  fob_id                   uuid not null references fobs(id),
  member_id                uuid not null references members(id),
  issued_at                timestamptz not null default now(),
  expected_return_at       timestamptz,
  returned_at              timestamptz,
  deposit_amount           numeric not null,
  deposit_currency         text not null default 'USD',
  officernd_fee_id         text,
  officernd_refund_fee_id  text,
  deposit_status           deposit_status not null default 'pending',
  issue_notes              text,
  return_notes             text,
  created_at               timestamptz not null default now()
);

-- One open assignment per fob at a time
create unique index assignments_fob_open_idx
  on assignments(fob_id)
  where returned_at is null;

create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create table app_settings (
  id                       int primary key default 1,
  default_fob_deposit      numeric not null default 100.00,
  default_remote_deposit   numeric not null default 200.00,
  notification_email       text,
  auto_create_deposit_fee  boolean not null default true,
  auto_refund_on_return    boolean not null default true,
  -- Enforce single row
  constraint app_settings_single_row check (id = 1)
);

-- Seed the single settings row
insert into app_settings (id) values (1);

-- ─── Serial number normalisation trigger ─────────────────────────────────────

create or replace function normalize_serial_number()
returns trigger as $$
begin
  new.serial_number := upper(replace(new.serial_number, ' ', ''));
  return new;
end;
$$ language plpgsql;

create trigger normalize_fob_serial
  before insert or update on fobs
  for each row execute function normalize_serial_number();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index members_status_idx on members(status);
create index assignments_member_idx on assignments(member_id);
create index assignments_fob_idx on assignments(fob_id);
create index assignments_returned_at_idx on assignments(returned_at) where returned_at is null;
create index audit_log_created_at_idx on audit_log(created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table members     enable row level security;
alter table fobs        enable row level security;
alter table assignments enable row level security;
alter table audit_log   enable row level security;
alter table app_settings enable row level security;

-- Full access for authenticated users
create policy "authenticated full access" on members
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on fobs
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on assignments
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on audit_log
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on app_settings
  for all to authenticated using (true) with check (true);

-- ============================================================
-- VОР Platform — Initial Database Schema
-- Supabase migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- Table: documents
-- Stores each parsing run
-- ─────────────────────────────────────────────
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  title           text,
  source_type     text not null check (source_type in ('paste', 'upload')) default 'paste',
  source_filename text,
  raw_text        text not null,
  metadata        jsonb default '{}'::jsonb
);

comment on table documents is 'Each VОР extraction run (paste or uploaded file)';
comment on column documents.metadata is 'Detected header fields: date, author, reviewer, basis, project';

-- ─────────────────────────────────────────────
-- Table: line_items
-- Structured rows extracted from documents
-- ─────────────────────────────────────────────
create table if not exists line_items (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  row_index     integer not null,
  code          text,           -- "№ п.п." e.g. "1.1-2"
  name          text,           -- "Наименование работ…"
  unit          text,           -- "Ед. изм." e.g. "м3"
  qty_raw       text,           -- raw quantity string e.g. "356 472,30"
  qty_value     numeric,        -- normalized float
  formula       text,           -- "Формула расчёта"
  ref_drawings  text,           -- "Ссылка на чертежи"
  file_name     text,           -- "Наименование файла"
  pages         text,           -- "Номер страниц"
  comment       text,           -- "Дополнительная информация"
  item_type     text,           -- "Тип позиции": Работа | Материал | Перевозка
  warnings      jsonb default '[]'::jsonb,  -- array of warning strings
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table line_items is 'Individual VОР table rows, linked to a document';
comment on column line_items.code is 'Row number as string, e.g. "1.1-2". Do NOT cast to numeric.';
comment on column line_items.warnings is 'Array of human-readable warning strings for this row';

-- Trigger: update updated_at automatically
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger line_items_updated_at
  before update on line_items
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- Table: exports
-- Log of every export action
-- ─────────────────────────────────────────────
create table if not exists exports (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid references documents(id) on delete cascade,
  type         text not null check (type in ('xlsx', 'csv', 'json')),
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
create index if not exists idx_line_items_document_id on line_items(document_id);
create index if not exists idx_line_items_item_type on line_items(item_type);
create index if not exists idx_line_items_code on line_items(code);
create index if not exists idx_documents_created_at on documents(created_at desc);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
-- NOTE: RLS is enabled but anon users can read/write.
-- This is intentional for MVP (no auth yet).
-- Add auth.uid() checks when authentication is introduced.

alter table documents   enable row level security;
alter table line_items  enable row level security;
alter table exports     enable row level security;

-- Policy: allow all operations for anon (MVP - no auth)
-- ⚠️  Replace with auth-scoped policies when adding user accounts.
create policy "anon_all_documents"  on documents  for all to anon using (true) with check (true);
create policy "anon_all_line_items" on line_items for all to anon using (true) with check (true);
create policy "anon_all_exports"    on exports    for all to anon using (true) with check (true);

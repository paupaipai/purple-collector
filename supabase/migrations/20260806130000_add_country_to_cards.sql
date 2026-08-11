-- Adds a country column to cards so photocards can be ordered/grouped by
-- release country (Korea, Japan, etc). Nullable and free-text: values are
-- backfilled manually per card from the Supabase table editor.
alter table public.cards
  add column if not exists country text;

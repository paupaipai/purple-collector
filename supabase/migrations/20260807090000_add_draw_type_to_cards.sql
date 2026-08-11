-- Adds a draw_type column to cards to distinguish redraw versions (R1, R2, ...)
-- of the same photocard, independent of retailer/country. Nullable and
-- free-text: values are backfilled per card afterwards.
alter table public.cards
  add column if not exists draw_type text;

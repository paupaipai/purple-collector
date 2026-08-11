-- Guarantees collection_types.name_en exists.
--
-- hooks/useEraAlbums.ts and app/(tabs)/index.tsx now select name_en for
-- bilingual type names, but no migration in this repo ever created it —
-- the table itself predates the migrations folder. If the column is
-- missing in a given environment, the select() that includes it fails
-- outright (42703), and since the query's error is discarded, the whole
-- type header (name, color, icon) silently goes blank instead of just the
-- translation.
alter table public.collection_types
  add column if not exists name_en text;

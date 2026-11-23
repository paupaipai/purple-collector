-- Community Challenge: quita EXECUTE de anon/authenticated a dos funciones
-- internas del concurso. Supabase las concede de forma explicita por default
-- privileges, asi que `revoke ... from public` no alcanza (ver SR-9).
--
-- Se aplico en produccion via MCP como migracion separada; este archivo la
-- refleja tal cual para que el repo calce con schema_migrations.

revoke execute on function public.card_images_log_event() from anon, authenticated;
revoke execute on function public.challenge_window_end(public.challenges) from anon, authenticated;

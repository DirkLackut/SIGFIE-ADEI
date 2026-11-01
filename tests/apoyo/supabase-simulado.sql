-- =============================================================================
-- Simulación mínima de Supabase para correr las migraciones en PGlite.
--
-- Reproduce SOLO lo que las migraciones y las políticas RLS necesitan:
--   · los roles anon, authenticated y service_role;
--   · el esquema auth con auth.users, auth.sessions, auth.uid() y auth.jwt();
--   · la configuración con la que se creó el proyecto sigfie-adei (29-oct):
--       - "Automatically expose new tables" DESACTIVADO → no hay permisos por
--         defecto: cada tabla necesita su GRANT explícito;
--       - "Enable automatic RLS" ACTIVADO → toda tabla nueva en public nace con RLS.
--
-- No simula el servicio de Auth (contraseñas, correos, tokens). Eso se prueba
-- contra el proyecto real en la tarea T16 (plan, decisión D12).
-- =============================================================================

-- Roles de Supabase. service_role ignora RLS, como en Supabase.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Esquema auth ----------------------------------------------------------------
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key,
  email              text unique,
  encrypted_password text,
  banned_until       timestamptz,
  created_at         timestamptz not null default now()
);

create table auth.sessions (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Las mismas firmas que en Supabase. Leen los "claims" del token, que el banco
-- de pruebas fija con set_config, igual que lo hace PostgREST en Supabase.
create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'role', '')
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role()
  to anon, authenticated, service_role;

-- "Enable automatic RLS": toda tabla nueva del esquema public nace con RLS.
-- La función vive en un esquema propio de la simulación, no en public: así no
-- se confunde con las funciones del proyecto en las revisiones de seguridad.
create schema supabase_simulado;
create function supabase_simulado.rls_automatica() returns event_trigger
language plpgsql as $$
declare r record;
begin
  for r in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE' and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', r.object_identity);
  end loop;
end $$;

create event trigger rls_automatica on ddl_command_end
  when tag in ('CREATE TABLE') execute function supabase_simulado.rls_automatica();

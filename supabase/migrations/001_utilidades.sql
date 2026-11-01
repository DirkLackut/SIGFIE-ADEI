-- =============================================================================
-- 001 · Utilidades, organización y correlativos
-- Spec 001: CE-29, CE-48, CE-77, CE-95, CE-99, P8 · Plan §4.2, §4.3
-- =============================================================================

-- Extensiones en su propio esquema, como recomienda Supabase. Van ANTES del
-- cierre de funciones de abajo: sus funciones (unaccent, las de trigramas) son
-- de uso general y deben poder usarse, como en cualquier PostgreSQL.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Ninguna función nueva se puede ejecutar desde la API salvo que se le dé
-- permiso explícito. PostgreSQL, por defecto, deja ejecutar cualquier función a
-- todo el mundo (PUBLIC); aquí se invierte, igual que el proyecto ya lo hace con
-- las tablas ("Automatically expose new tables" apagado, plan §5.5).
--
-- Son dos instrucciones y las dos hacen falta. El permiso a PUBLIC es GLOBAL, y
-- PostgreSQL no deja quitar por esquema algo que se da globalmente: hay que
-- quitarlo globalmente (la primera). La segunda quita lo que Supabase da por
-- esquema a sus roles de la API. Con solo la segunda, cualquier usuario podía
-- ejecutar funciones internas (lo detectó la prueba de T5).
alter default privileges revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- normalizar(texto): sin mayúsculas, tildes ni espacios de más.
-- Debe dar lo mismo que normalizar() de src/dominio/texto.ts (lo prueba T5).
-- Inmutable, para poder usarse en índices únicos y en la columna de búsqueda.
-- -----------------------------------------------------------------------------
create function public.normalizar(texto text) returns text
language sql immutable strict parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, texto)),
    '\s+', ' ', 'g'))
$$;

-- La fecha del día en Nicaragua, no la del servidor (CE-77).
create function public.hoy_managua() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'America/Managua')::date $$;

-- -----------------------------------------------------------------------------
-- Organización: la academia dueña de los datos (CE-95). En producción: solo ADEI.
-- -----------------------------------------------------------------------------
create table public.organizacion (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique
            constraint organizacion_codigo_formato check (codigo ~ '^[A-Z]{2,10}$'),
  nombre    text not null check (length(btrim(nombre)) between 2 and 120),
  creado_en timestamptz not null default now()
);

-- La organización del usuario que hace la consulta. Se escribe en plpgsql
-- porque consulta la tabla usuario, que se crea en 003: plpgsql no exige que
-- la tabla exista al crear la función, solo al ejecutarla.
create function public.mi_organizacion() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return (select u.organizacion_id from public.usuario u where u.id = auth.uid());
end $$;

-- -----------------------------------------------------------------------------
-- Correlativos de los códigos, por organización, tipo y año (CE-29, CE-48, CE-99, P8)
-- -----------------------------------------------------------------------------
create table public.correlativo (
  organizacion_id uuid not null references public.organizacion(id),
  tipo            text not null check (tipo in ('estudiante', 'grupo')),
  anio            int  not null check (anio between 2000 and 2999),
  ultimo          int  not null check (ultimo >= 1),
  primary key (organizacion_id, tipo, anio)
);

-- Atómica: el INSERT … ON CONFLICT DO UPDATE bloquea la fila del contador hasta
-- que termina la transacción, así que dos registros simultáneos nunca reciben el
-- mismo número; y si la transacción se deshace, el número no se consume.
-- El año nuevo crea su propia fila: el reinicio anual es automático.
create function public.siguiente_correlativo(p_organizacion uuid, p_tipo text, p_anio int)
returns int
language sql volatile security definer
set search_path = ''
as $$
  insert into public.correlativo as c (organizacion_id, tipo, anio, ultimo)
  values (p_organizacion, p_tipo, p_anio, 1)
  on conflict (organizacion_id, tipo, anio) do update set ultimo = c.ultimo + 1
  returning ultimo
$$;

-- Los datos de la organización los ve su gente; los correlativos, nadie desde la API.
grant select on public.organizacion to authenticated;

-- Funciones que cualquier usuario necesita poder usar, porque aparecen en valores
-- por defecto, índices y políticas: no revelan nada que el usuario no sepa ya.
-- siguiente_correlativo() NO está aquí: solo la llaman otras funciones del sistema.
grant execute on function public.normalizar(text), public.hoy_managua(), public.mi_organizacion()
  to authenticated, service_role;

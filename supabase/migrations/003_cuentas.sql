-- =============================================================================
-- 003 · Cuentas de usuario, roles y aviso de privacidad
-- Spec 001: CE-5, CE-6, CE-9, CE-13, CE-14 a CE-16, CE-69, CE-95 · Plan §4.4, §5
--
-- La contraseña NO está aquí: la guarda Supabase Auth en auth.users (CE-12).
-- La tabla de intentos de ingreso (bloqueo, CE-63 a CE-68) llega con la spec 004.
-- =============================================================================

create type public.rol as enum ('asistente', 'direccion', 'profesor', 'admin_tecnico');

create table public.usuario (
  id                          uuid primary key references auth.users(id),
  organizacion_id             uuid not null references public.organizacion(id),
  -- Se guarda en minúsculas: "Aura" y "aura" son el mismo usuario (CE-69).
  nombre_usuario              text not null unique
                              constraint usuario_nombre_formato check (nombre_usuario ~ '^\S{4,30}$')
                              constraint usuario_nombre_minusculas check (nombre_usuario = lower(nombre_usuario)),
  correo                      text check (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(correo) <= 100),
  estado                      text not null default 'activo' check (estado in ('activo', 'inactivo')),
  profesor_id                 uuid unique,                                   -- CE-6: un profesor, una cuenta
  debe_cambiar_contrasena     boolean not null default false,                -- CE-9
  contrasena_temporal_emitida timestamptz,                                   -- CE-70 (vence a las 72 h)
  ultimo_acceso               timestamptz,
  creado_en                   timestamptz not null default now(),
  unique (organizacion_id, id),
  foreign key (organizacion_id, profesor_id) references public.profesor (organizacion_id, id),
  constraint usuario_temporal_coherente
    check (not debe_cambiar_contrasena or contrasena_temporal_emitida is not null)
);

create table public.usuario_rol (
  organizacion_id uuid not null,
  usuario_id      uuid not null,
  rol             public.rol not null,
  primary key (usuario_id, rol),
  foreign key (organizacion_id, usuario_id) references public.usuario (organizacion_id, id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- CE-6: una cuenta con rol Profesor está vinculada a un profesor del catálogo.
-- Se revisa al final de la transacción: primero se crea la cuenta y luego el rol.
-- -----------------------------------------------------------------------------
create function public.revisar_cuenta_profesor() returns trigger
language plpgsql
set search_path = ''
as $$
declare v_usuario uuid;
begin
  -- Cada rama toca solo los campos de su tabla: PL/pgSQL evalúa la expresión
  -- completa, y new.id no existe en usuario_rol.
  if tg_table_name = 'usuario' then v_usuario := new.id; else v_usuario := new.usuario_id; end if;
  if exists (select 1 from public.usuario_rol r join public.usuario u on u.id = r.usuario_id
             where r.usuario_id = v_usuario and r.rol = 'profesor' and u.profesor_id is null) then
    raise exception 'Una cuenta con rol Profesor debe estar vinculada a un profesor del catálogo.'
      using errcode = 'check_violation', constraint = 'cuenta_profesor_vinculada';
  end if;
  return null;
end $$;

create constraint trigger cuenta_profesor_vinculada_rol
  after insert or update on public.usuario_rol deferrable initially deferred
  for each row execute function public.revisar_cuenta_profesor();
create constraint trigger cuenta_profesor_vinculada_usuario
  after update of profesor_id on public.usuario deferrable initially deferred
  for each row execute function public.revisar_cuenta_profesor();

-- -----------------------------------------------------------------------------
-- CE-13: ninguna acción puede dejar a la organización sin una Asistente activa.
-- Solo se revisa cuando algo QUITA (desactivar, quitar el rol, borrar): una
-- organización recién creada, que todavía no tiene Asistente, no es un error.
-- -----------------------------------------------------------------------------
create function public.revisar_ultima_asistente() returns trigger
language plpgsql
set search_path = ''
as $$
declare v_org uuid := old.organizacion_id;
begin
  -- ¿Lo que se quitó era una Asistente activa? Ramas separadas por tabla (ver arriba).
  if tg_table_name = 'usuario_rol' then
    if old.rol <> 'asistente' then return null; end if;
  else
    if not (old.estado = 'activo' and new.estado = 'inactivo') then return null; end if;
  end if;

  if not exists (
    select 1 from public.usuario u join public.usuario_rol r on r.usuario_id = u.id
    where u.organizacion_id = v_org and u.estado = 'activo' and r.rol = 'asistente'
  ) then
    raise exception 'La organización no puede quedarse sin ninguna cuenta activa de Asistente de Dirección.'
      using errcode = 'check_violation', constraint = 'ultima_asistente';
  end if;
  return null;
end $$;

create constraint trigger ultima_asistente_rol
  after delete or update on public.usuario_rol deferrable initially deferred
  for each row execute function public.revisar_ultima_asistente();
create constraint trigger ultima_asistente_usuario
  after update of estado on public.usuario deferrable initially deferred
  for each row execute function public.revisar_ultima_asistente();

-- -----------------------------------------------------------------------------
-- Aviso de privacidad, versionado (RF-16, RN-16). La aceptación se guarda con la
-- sesión: el aviso se acepta en cada inicio de sesión (CE-14, CE-15).
-- -----------------------------------------------------------------------------
create table public.aviso_privacidad (
  organizacion_id uuid not null references public.organizacion(id),
  version         text not null check (version ~ '^v\d+\.\d+$'),
  texto           text not null check (length(btrim(texto)) >= 50),
  vigente_desde   timestamptz not null default now(),
  primary key (organizacion_id, version)
);

create table public.aceptacion_privacidad (
  id              bigint generated always as identity primary key,
  organizacion_id uuid not null,
  usuario_id      uuid not null,
  sesion          uuid not null,
  version         text not null,
  fecha_hora      timestamptz not null default now(),
  foreign key (organizacion_id, usuario_id) references public.usuario (organizacion_id, id),
  foreign key (organizacion_id, version) references public.aviso_privacidad (organizacion_id, version)
);
create index aceptacion_por_sesion on public.aceptacion_privacidad (usuario_id, sesion);

-- El aviso vigente de una organización: el de vigencia más reciente ya iniciada.
create function public.aviso_vigente(p_organizacion uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select a.version from public.aviso_privacidad a
  where a.organizacion_id = p_organizacion and a.vigente_desde <= now()
  order by a.vigente_desde desc limit 1
$$;

grant select, insert, update on public.usuario, public.usuario_rol to authenticated;
grant select on public.aviso_privacidad, public.aceptacion_privacidad to authenticated;
-- El servidor busca la cuenta por nombre de usuario antes de que exista sesión (plan §5.1).
grant select on public.usuario to service_role;

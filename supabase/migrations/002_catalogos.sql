-- =============================================================================
-- 002 · Catálogos controlados: sucursal, modalidad, horario, nivel, profesor
-- Spec 001: CE-21 a CE-28, CE-74, CE-75, CE-95, CE-97, CE-98 · Plan §4.1, §4.2
--
-- Patrón de todas las tablas de datos (plan §4.2):
--   · organizacion_id NOT NULL con valor por defecto mi_organizacion(): la app
--     nunca lo envía y nadie escribe en otra organización cambiando un número;
--   · UNIQUE (organizacion_id, id), para que las llaves foráneas sean compuestas
--     y una fila nunca pueda apuntar a otra organización (CE-97);
--   · las reglas de unicidad incluyen la organización (CE-98).
-- RLS ya nace encendida ("Enable automatic RLS"); las políticas están en 007.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sucursal
-- -----------------------------------------------------------------------------
create table public.sucursal (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  nombre          text not null check (length(btrim(nombre)) between 2 and 60),
  direccion       text not null check (length(btrim(direccion)) between 2 and 200),
  telefono        text check (telefono ~ '^\d{8}$'),
  es_central      boolean not null default false,
  unique (organizacion_id, id)
);
create unique index sucursal_nombre_unico on public.sucursal (organizacion_id, public.normalizar(nombre));
-- Como máximo una central por organización…
create unique index sucursal_una_central on public.sucursal (organizacion_id) where es_central;

-- …y como mínimo una, si la organización tiene sucursales (CE-28). Se revisa al
-- final de la transacción, para poder cambiar cuál es la central en dos pasos.
create function public.revisar_sucursal_central() returns trigger
language plpgsql
set search_path = ''
as $$
declare v_org uuid := coalesce(new.organizacion_id, old.organizacion_id);
begin
  if exists (select 1 from public.sucursal where organizacion_id = v_org)
     and not exists (select 1 from public.sucursal where organizacion_id = v_org and es_central) then
    raise exception 'La organización debe tener exactamente una sucursal central.'
      using errcode = 'check_violation', constraint = 'sucursal_exactamente_una_central';
  end if;
  return null;
end $$;

create constraint trigger sucursal_exactamente_una_central
  after insert or update or delete on public.sucursal
  deferrable initially deferred
  for each row execute function public.revisar_sucursal_central();

-- -----------------------------------------------------------------------------
-- Modalidad y horario (RN-07: cada horario pertenece a una sola modalidad)
-- -----------------------------------------------------------------------------
create table public.modalidad (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  nombre          text not null check (length(btrim(nombre)) between 2 and 40),
  dias_de_clase   text not null check (length(btrim(dias_de_clase)) between 2 and 40),
  activo          boolean not null default true,
  unique (organizacion_id, id)
);
create unique index modalidad_nombre_unico on public.modalidad (organizacion_id, public.normalizar(nombre));

create table public.horario (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  modalidad_id    uuid not null,
  hora_inicio     time not null,
  hora_fin        time not null,
  activo          boolean not null default true,
  unique (organizacion_id, id),
  constraint horario_fin_despues_de_inicio check (hora_fin > hora_inicio),                    -- CE-27
  constraint horario_unico unique (organizacion_id, modalidad_id, hora_inicio, hora_fin),     -- CE-74
  foreign key (organizacion_id, modalidad_id) references public.modalidad (organizacion_id, id) -- CE-26, CE-97
);

-- -----------------------------------------------------------------------------
-- Nivel
-- -----------------------------------------------------------------------------
create table public.nivel (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  codigo          text not null check (length(btrim(codigo)) between 1 and 10),
  nombre          text not null check (length(btrim(nombre)) between 2 and 60),
  programa        text not null check (programa in
                    ('Principiante', 'Beginners', 'Intermediate', 'Conversation',
                     'Conversation Avanzada', 'Advanced', 'Especial')),
  orden           int  not null check (orden between 1 and 99),
  publico         text not null check (publico in ('Adultos', 'Niños')),
  activo          boolean not null default true,
  unique (organizacion_id, id),
  constraint nivel_orden_unico unique (organizacion_id, programa, publico, orden)
);
create unique index nivel_nombre_unico on public.nivel (organizacion_id, public.normalizar(nombre));
create unique index nivel_codigo_unico on public.nivel (organizacion_id, public.normalizar(codigo));

-- -----------------------------------------------------------------------------
-- Profesor. Sin unicidad de nombre: dos personas pueden llamarse igual (CE-75);
-- la advertencia de homónimo la da la aplicación.
-- -----------------------------------------------------------------------------
create table public.profesor (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  nombres         text not null check (nombres   ~ '^[[:alpha:]'' ]{2,60}$' and btrim(nombres)   = nombres),
  apellidos       text not null check (apellidos ~ '^[[:alpha:]'' ]{2,60}$' and btrim(apellidos) = apellidos),
  telefono        text not null check (telefono ~ '^\d{8}$'),
  activo          boolean not null default true,
  unique (organizacion_id, id)
);

-- Permisos de tabla. Las políticas RLS (007) deciden QUÉ filas y QUIÉN escribe.
grant select, insert, update, delete on public.sucursal, public.modalidad, public.horario,
  public.nivel, public.profesor to authenticated;

-- =============================================================================
-- 005 · Estudiantes y tutores
-- Spec 001: CE-29 a CE-41, CE-76, CE-77, CE-80 a CE-82, CE-95, CE-97, CE-98
-- RF-01, RF-12, RN-01, RN-02, RN-21 · Plan §4.1, §7
--
-- RN-21: no hay columnas de estado civil ni de condición de salud (CE-39).
-- =============================================================================

-- Años cumplidos a una fecha dada. Da lo mismo que calcularEdad() de la app,
-- incluido quien nació un 29 de febrero (lo prueba T9).
create function public.edad(nacimiento date, hoy date) returns int
language sql immutable strict parallel safe
set search_path = ''
as $$ select extract(year from age(hoy, nacimiento))::int $$;
grant execute on function public.edad(date, date) to authenticated, service_role;

create table public.estudiante (
  id                  uuid primary key default gen_random_uuid(),
  organizacion_id     uuid not null default public.mi_organizacion() references public.organizacion(id),
  codigo_adei         text not null constraint estudiante_codigo_formato check (codigo_adei ~ '^[A-Z]{2,10}-\d{4}-\d{5}$'),
  cedula              text constraint estudiante_cedula_formato check (cedula ~ '^\d{3}-\d{6}-\d{4}[A-Z]$'),
  nombres             text not null constraint estudiante_nombres_formato
                        check (nombres ~ '^[[:alpha:]'' ]{2,60}$' and btrim(nombres) = nombres and nombres !~ '\s\s'),
  apellidos           text not null constraint estudiante_apellidos_formato
                        check (apellidos ~ '^[[:alpha:]'' ]{2,60}$' and btrim(apellidos) = apellidos and apellidos !~ '\s\s'),
  fecha_nacimiento    date not null,
  telefono            text constraint estudiante_telefono_formato check (telefono ~ '^\d{8}$'),
  correo              text constraint estudiante_correo_formato check (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(correo) <= 100),
  direccion           text check (length(direccion) <= 200),
  contacto_emergencia text check (length(btrim(contacto_emergencia)) between 2 and 100),
  sucursal_id         uuid not null,
  estado_matricula    text not null default 'Activo' check (estado_matricula in ('Activo', 'Desertor', 'Egresado')),
  fecha_cambio_estado date,
  origen_registro     text not null default 'Captura' check (origen_registro in ('Captura', 'Migración')),
  version             int  not null default 1,     -- para la edición simultánea (CE-86, spec 004)
  creado_en           timestamptz not null default now(),
  -- Lo que se busca (CE-42): nombre completo sin tildes, cédula sin guiones y código.
  busqueda            text generated always as (
                        public.normalizar(nombres || ' ' || apellidos) || ' ' ||
                        coalesce(replace(lower(cedula), '-', ''), '') || ' ' ||
                        lower(codigo_adei)) stored,
  unique (organizacion_id, id),
  constraint estudiante_codigo_unico unique (organizacion_id, codigo_adei),        -- RN-01
  constraint estudiante_cedula_unica unique (organizacion_id, cedula),             -- RN-01, CE-30, CE-98
  foreign key (organizacion_id, sucursal_id) references public.sucursal (organizacion_id, id)
);
create index estudiante_busqueda on public.estudiante using gin (busqueda extensions.gin_trgm_ops);

create table public.tutor (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  nombre_completo text not null check (length(btrim(nombre_completo)) between 5 and 120 and btrim(nombre_completo) = nombre_completo),
  cedula          text not null constraint tutor_cedula_formato check (cedula ~ '^\d{3}-\d{6}-\d{4}[A-Z]$'),
  telefono        text not null constraint tutor_telefono_formato check (telefono ~ '^\d{8}$'),
  unique (organizacion_id, id),
  constraint tutor_cedula_unica unique (organizacion_id, cedula)   -- CE-38: un tutor, un registro
);

create table public.estudiante_tutor (
  organizacion_id uuid not null default public.mi_organizacion(),
  estudiante_id   uuid not null,
  tutor_id        uuid not null,
  primary key (estudiante_id, tutor_id),
  foreign key (organizacion_id, estudiante_id) references public.estudiante (organizacion_id, id),
  foreign key (organizacion_id, tutor_id)      references public.tutor (organizacion_id, id)
);

-- -----------------------------------------------------------------------------
-- Reglas que dependen de la fecha de hoy: no pueden ser CHECK, porque un CHECK
-- debe dar siempre lo mismo (plan §4.1). Van en un trigger.
-- -----------------------------------------------------------------------------
create function public.validar_estudiante() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_hoy  date := public.hoy_managua();
  v_edad int;
  v_fecha_cambio boolean := tg_op = 'INSERT' or new.fecha_nacimiento is distinct from old.fecha_nacimiento;
begin
  if tg_op = 'UPDATE' then
    -- CE-41: el código no se modifica por ningún medio. La organización, tampoco.
    if new.codigo_adei is distinct from old.codigo_adei then
      raise exception 'El código ADEI no se puede modificar.' using errcode = 'check_violation', constraint = 'estudiante_codigo_inmutable';
    end if;
    if new.organizacion_id is distinct from old.organizacion_id then
      raise exception 'Un estudiante no puede cambiar de organización.' using errcode = 'check_violation';
    end if;
    new.version := old.version + 1;
  end if;

  if v_fecha_cambio then
    -- CE-36: no posterior a hoy y edad entre 4 y 99 años, ambos incluidos.
    if new.fecha_nacimiento > v_hoy then
      raise exception 'La fecha de nacimiento no puede ser posterior a hoy.'
        using errcode = 'check_violation', constraint = 'estudiante_fecha_nacimiento';
    end if;
    v_edad := public.edad(new.fecha_nacimiento, v_hoy);
    if v_edad < 4 or v_edad > 99 then
      raise exception 'La edad debe estar entre 4 y 99 años.'
        using errcode = 'check_violation', constraint = 'estudiante_fecha_nacimiento';
    end if;
  else
    v_edad := public.edad(new.fecha_nacimiento, v_hoy);
  end if;

  -- CE-35: un adulto necesita teléfono al registrarse. Al editar, la falta solo
  -- se advierte en la aplicación (CE-80): quien se registró de niño y cumplió 18
  -- no queda bloqueado para corregir otros datos.
  if tg_op = 'INSERT' and v_edad >= 18 and new.telefono is null then
    raise exception 'Un estudiante mayor de edad debe tener teléfono.'
      using errcode = 'check_violation', constraint = 'estudiante_telefono_adulto';
  end if;

  -- CE-34: un menor necesita contacto de emergencia, al registrarse o al pasar a
  -- ser menor por un cambio de fecha de nacimiento (CE-81).
  if v_fecha_cambio and v_edad < 18 and new.contacto_emergencia is null then
    raise exception 'Un estudiante menor de edad debe tener contacto de emergencia.'
      using errcode = 'check_violation', constraint = 'estudiante_contacto_menor';
  end if;
  return new;
end $$;

create trigger validar before insert or update on public.estudiante
  for each row execute function public.validar_estudiante();

-- -----------------------------------------------------------------------------
-- CE-33, CE-81, CE-82: un menor de 18 años siempre tiene al menos un tutor.
-- Se revisa al final de la transacción, para poder crear al estudiante y a su
-- tutor juntos.
-- -----------------------------------------------------------------------------
create function public.revisar_menor_con_tutor() returns trigger
language plpgsql
set search_path = ''
as $$
declare v_estudiante uuid; v_nacimiento date;
begin
  if tg_table_name = 'estudiante' then v_estudiante := new.id; else v_estudiante := old.estudiante_id; end if;
  select e.fecha_nacimiento into v_nacimiento from public.estudiante e where e.id = v_estudiante;
  if v_nacimiento is not null
     and public.edad(v_nacimiento, public.hoy_managua()) < 18
     and not exists (select 1 from public.estudiante_tutor t where t.estudiante_id = v_estudiante) then
    raise exception 'Un estudiante menor de 18 años debe tener al menos un tutor.'
      using errcode = 'check_violation', constraint = 'menor_con_tutor';
  end if;
  return null;
end $$;

create constraint trigger menor_con_tutor_estudiante
  after insert or update of fecha_nacimiento on public.estudiante deferrable initially deferred
  for each row execute function public.revisar_menor_con_tutor();
create constraint trigger menor_con_tutor_vinculo
  after delete or update on public.estudiante_tutor deferrable initially deferred
  for each row execute function public.revisar_menor_con_tutor();

create trigger auditar after insert or update or delete on public.estudiante       for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.tutor            for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.estudiante_tutor for each row execute function public.registrar_cambio('estudiante_id', 'tutor_id');

-- Estudiantes y tutores no se eliminan: un expediente se conserva siempre.
grant select, insert, update on public.estudiante, public.tutor to authenticated;
grant select, insert, delete on public.estudiante_tutor to authenticated;

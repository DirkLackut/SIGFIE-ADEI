-- =============================================================================
-- 014 · Consulta y reportes
-- Spec 003: CE-1 a CE-98 · RF-10, RF-11, RF-13, RF-15, RF-17 a RF-21 ·
-- RN-13, RN-14, RN-15, RN-20, RN-23, RN-24 · Plan §3 y §4 (D30 a D37)
--
-- Todo lo que se escribe pasa por funciones SECURITY DEFINER (D26, D34): las
-- tablas nuevas solo tienen políticas de lectura. Cada función comprueba a mano
-- la organización, la puerta de acceso y el rol. «No existe» responde PT404.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bitácora: tipo de acción «Incidente» (CE-11). Lo registra el filtrado cuando
-- lo obtenido no cuadra con el total. registrar_evento lo acepta porque, igual
-- que una consulta, queda siempre a nombre de quien llama.
-- -----------------------------------------------------------------------------
alter table public.auditoria drop constraint auditoria_tipo_accion_check;
alter table public.auditoria add constraint auditoria_tipo_accion_check check (tipo_accion in
  ('Consulta', 'Creación', 'Modificación', 'Eliminación', 'Acceso', 'Denegación', 'Incidente'));

create or replace function public.registrar_evento(p_tipo text, p_entidad text, p_registro text default null, p_detalle text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Solo un usuario con sesión puede registrar eventos.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo not in ('Acceso', 'Consulta', 'Denegación', 'Incidente') then
    raise exception 'Tipo de evento no permitido: %', p_tipo using errcode = 'invalid_parameter_value';
  end if;
  insert into public.auditoria (organizacion_id, usuario_id, tipo_accion, entidad, registro_afectado, detalle)
  values (public.mi_organizacion(), auth.uid(), p_tipo, p_entidad, p_registro, p_detalle);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Facturas (CE-52 a CE-66, RN-13, RN-14). Solo se registra lo impreso en el
-- talonario: el sistema no genera facturas (CE-64).
-- -----------------------------------------------------------------------------
create table public.factura (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.mi_organizacion() references public.organizacion(id),
  serie           text not null constraint factura_serie_formato check (serie ~ '^[A-Z]$'),
  numero          int  not null constraint factura_numero_rango check (numero between 1 and 99999),
  fecha_emision   date not null constraint factura_fecha_cuatro_cifras check (extract(year from fecha_emision) between 1000 and 9999),
  -- Sin escala fija: numeric(6,2) redondearía 12.345 en silencio en vez de rechazarlo.
  monto           numeric not null constraint factura_monto_rango
                    check (monto between 0.01 and 9999.99 and monto = round(monto, 2)),
  moneda          text not null constraint factura_moneda_valida check (moneda in ('USD', 'NIO')),
  forma_pago      text not null default 'Efectivo'
                    constraint factura_forma_pago_valida check (forma_pago in ('Efectivo', 'Tarjeta', 'Transferencia')),
  inscripcion_id  uuid,
  version         int  not null default 1,
  creado_en       timestamptz not null default now(),
  unique (organizacion_id, id),
  constraint factura_numero_unico unique (organizacion_id, serie, numero),              -- CE-54
  constraint factura_inscripcion_unica unique (organizacion_id, inscripcion_id),        -- CE-60
  -- Anular una inscripción hecha por error (001·CE-58) deja la factura con sus
  -- estudiantes, sin inscripción: solo se vacía esa columna.
  foreign key (organizacion_id, inscripcion_id) references public.inscripcion (organizacion_id, id)
    on delete set null (inscripcion_id)
);

create table public.factura_estudiante (
  organizacion_id uuid not null default public.mi_organizacion(),
  factura_id      uuid not null,
  estudiante_id   uuid not null,
  primary key (factura_id, estudiante_id),
  foreign key (organizacion_id, factura_id) references public.factura (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, estudiante_id) references public.estudiante (organizacion_id, id)
);
create index factura_estudiante_por_estudiante on public.factura_estudiante (estudiante_id);

create trigger auditar after insert or update or delete on public.factura
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.factura_estudiante
  for each row execute function public.registrar_cambio('factura_id', 'estudiante_id');

alter table public.factura            enable row level security;
alter table public.factura_estudiante enable row level security;
do $$
declare t text;
begin
  foreach t in array array['factura', 'factura_estudiante'] loop
    execute format($p$
      create policy leer on public.%1$I for select to authenticated
        using (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and ((select public.tiene_rol('asistente')) or (select public.tiene_rol('direccion'))));
    $p$, t);
  end loop;
end $$;
revoke all on public.factura, public.factura_estudiante from anon, authenticated, service_role;
grant select on public.factura, public.factura_estudiante to authenticated;

-- Monto atípico (CE-56): más de US$200, o su equivalente en córdobas a la tasa
-- oficial fija del BCN (36.6243 C$ por dólar): C$7,325.
create function interno.monto_atipico(p_monto numeric, p_moneda text) returns boolean
language sql immutable
set search_path = ''
as $$ select case p_moneda when 'USD' then p_monto > 200 when 'NIO' then p_monto > 7325 else false end $$;

-- Lo común a registrar y corregir: campos, fecha, estudiantes e inscripción.
-- Devuelve los estudiantes sin repetir. Cada campo se revisa aquí, antes de la
-- tabla, con el nombre de su restricción y un mensaje propio: el error de la
-- restricción devolvería la fila rechazada con identificadores internos (T21, A05).
create function interno.revisar_factura(p_datos jsonb, p_factura uuid) returns uuid[]
language plpgsql stable
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_fecha date;
  v_numero text := btrim(coalesce(p_datos ->> 'numero', ''));
  v_monto text := btrim(coalesce(p_datos ->> 'monto', ''));
  v_estudiantes uuid[];
  v_inscripcion uuid := nullif(p_datos ->> 'inscripcion_id', '')::uuid;
  v_dueno uuid;
  v_otra record;
begin
  if upper(btrim(coalesce(p_datos ->> 'serie', 'B'))) !~ '^[A-Z]$' then                      -- CE-53
    raise exception 'La serie es una sola letra.' using errcode = 'check_violation', constraint = 'factura_serie_formato';
  end if;
  if v_numero !~ '^[0-9]{1,5}$' or v_numero::int < 1 then
    raise exception 'El número es un entero de 1 a 5 cifras.' using errcode = 'check_violation', constraint = 'factura_numero_rango';
  end if;
  if v_monto !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or v_monto::numeric < 0.01 then                -- CE-55
    raise exception 'El monto va de 0.01 a 9,999.99, con dos decimales como máximo.'
      using errcode = 'check_violation', constraint = 'factura_monto_rango';
  end if;
  if coalesce(p_datos ->> 'moneda', '') not in ('USD', 'NIO') then
    raise exception 'Elija US$ o C$.' using errcode = 'check_violation', constraint = 'factura_moneda_valida';
  end if;
  if coalesce(nullif(p_datos ->> 'forma_pago', ''), 'Efectivo') not in ('Efectivo', 'Tarjeta', 'Transferencia') then
    raise exception 'Elija Efectivo, Tarjeta o Transferencia.' using errcode = 'check_violation', constraint = 'factura_forma_pago_valida';
  end if;
  begin
    v_fecha := (p_datos ->> 'fecha_emision')::date;
  exception when others then
    raise exception 'La fecha de emisión no es válida.' using errcode = 'check_violation', constraint = 'factura_fecha_valida';
  end;
  if v_fecha is null then
    raise exception 'Falta la fecha de emisión.' using errcode = 'check_violation';
  end if;
  if extract(year from v_fecha) not between 1000 and 9999 then
    raise exception 'La fecha de emisión debe tener un año de cuatro cifras.' using errcode = 'check_violation';
  end if;
  if v_fecha > public.hoy_managua() then                                                      -- CE-57
    raise exception 'La fecha de emisión no puede ser posterior a hoy.' using errcode = 'check_violation';
  end if;

  select coalesce(array_agg(distinct x::uuid), '{}') into v_estudiantes
  from jsonb_array_elements_text(coalesce(p_datos -> 'estudiantes', '[]'::jsonb)) x;
  if cardinality(v_estudiantes) = 0 then                                                      -- CE-52
    raise exception 'La factura debe amparar al menos un estudiante.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.estudiante e where e.id = any(v_estudiantes) and e.organizacion_id = v_org)
     <> cardinality(v_estudiantes) then
    raise exception 'Un estudiante de la factura no existe.' using errcode = 'PT404';
  end if;

  if v_inscripcion is not null then                                                           -- CE-60
    select i.estudiante_id into v_dueno from public.inscripcion i
    where i.id = v_inscripcion and i.organizacion_id = v_org;
    if v_dueno is null then
      raise exception 'La inscripción no existe.' using errcode = 'PT404';
    end if;
    if not v_dueno = any(v_estudiantes) then
      raise exception 'La inscripción debe ser de uno de los estudiantes amparados por la factura.'
        using errcode = 'check_violation';
    end if;
    select f.serie, f.numero into v_otra from public.factura f
    where f.organizacion_id = v_org and f.inscripcion_id = v_inscripcion and f.id is distinct from p_factura;
    if found then
      raise exception 'Esa inscripción ya tiene la factura %-%.', v_otra.serie, v_otra.numero using errcode = 'check_violation';
    end if;
  end if;
  return v_estudiantes;
end $$;

-- p_datos: serie, numero, fecha_emision, monto, moneda, forma_pago, estudiantes
-- (lista de ids), inscripcion_id (opcional).
-- Respuestas: registrada | duplicada (con la factura existente) | atipico
create function public.registrar_factura(p_datos jsonb, p_confirmar boolean default false) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_serie text := upper(btrim(coalesce(p_datos ->> 'serie', 'B')));
  v_numero int;
  v_monto numeric;
  v_moneda text := p_datos ->> 'moneda';
  v_estudiantes uuid[];
  v_existente uuid;
  v_id uuid;
begin
  perform interno.exigir_asistente();                                                         -- CE-66
  v_estudiantes := interno.revisar_factura(p_datos, null);
  v_numero := (p_datos ->> 'numero')::int;      -- ya revisados: no fallan
  v_monto := (p_datos ->> 'monto')::numeric;

  select f.id into v_existente from public.factura f
  where f.organizacion_id = v_org and f.serie = v_serie and f.numero = v_numero;
  if v_existente is not null then                                                             -- CE-54
    return jsonb_build_object('estado', 'duplicada', 'id', v_existente, 'serie', v_serie, 'numero', v_numero);
  end if;
  if interno.monto_atipico(v_monto, v_moneda) and not p_confirmar then                        -- CE-56
    return jsonb_build_object('estado', 'atipico', 'monto', v_monto, 'moneda', v_moneda);
  end if;

  insert into public.factura (organizacion_id, serie, numero, fecha_emision, monto, moneda, forma_pago, inscripcion_id)
  values (v_org, v_serie, v_numero, (p_datos ->> 'fecha_emision')::date, v_monto, v_moneda,
          coalesce(nullif(p_datos ->> 'forma_pago', ''), 'Efectivo'), nullif(p_datos ->> 'inscripcion_id', '')::uuid)
  returning id into v_id;
  insert into public.factura_estudiante (organizacion_id, factura_id, estudiante_id)
  select v_org, v_id, x from unnest(v_estudiantes) x;
  return jsonb_build_object('estado', 'registrada', 'id', v_id);
end $$;

-- CE-62. Respuestas: corregida | conflicto | duplicada | atipico
create function public.corregir_factura(p_id uuid, p_version int, p_datos jsonb, p_motivo text, p_confirmar boolean default false)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_actual public.factura;
  v_serie text := upper(btrim(coalesce(p_datos ->> 'serie', 'B')));
  v_numero int;
  v_monto numeric;
  v_moneda text := p_datos ->> 'moneda';
  v_motivo text;
  v_estudiantes uuid[];
  v_existente uuid;
begin
  perform interno.exigir_asistente();
  select * into v_actual from public.factura where id = p_id and organizacion_id = v_org;
  if v_actual.id is null then raise exception 'La factura no existe.' using errcode = 'PT404'; end if;
  v_motivo := interno.exigir_motivo(p_motivo);
  v_estudiantes := interno.revisar_factura(p_datos, p_id);
  v_numero := (p_datos ->> 'numero')::int;
  v_monto := (p_datos ->> 'monto')::numeric;
  if v_actual.version <> p_version then
    return jsonb_build_object('estado', 'conflicto', 'version', v_actual.version);
  end if;
  select f.id into v_existente from public.factura f
  where f.organizacion_id = v_org and f.serie = v_serie and f.numero = v_numero and f.id <> p_id;
  if v_existente is not null then
    return jsonb_build_object('estado', 'duplicada', 'id', v_existente, 'serie', v_serie, 'numero', v_numero);
  end if;
  if interno.monto_atipico(v_monto, v_moneda) and not p_confirmar then
    return jsonb_build_object('estado', 'atipico', 'monto', v_monto, 'moneda', v_moneda);
  end if;

  perform interno.anotar_motivo(v_motivo);
  update public.factura set
    serie = v_serie, numero = v_numero, fecha_emision = (p_datos ->> 'fecha_emision')::date,
    monto = v_monto, moneda = v_moneda, forma_pago = coalesce(nullif(p_datos ->> 'forma_pago', ''), 'Efectivo'),
    inscripcion_id = nullif(p_datos ->> 'inscripcion_id', '')::uuid, version = version + 1
  where id = p_id;
  delete from public.factura_estudiante where factura_id = p_id and estudiante_id <> all(v_estudiantes);
  insert into public.factura_estudiante (organizacion_id, factura_id, estudiante_id)
  select v_org, p_id, x from unnest(v_estudiantes) x
  on conflict do nothing;
  return jsonb_build_object('estado', 'corregida', 'id', p_id, 'version', v_actual.version + 1);
end $$;

-- CE-63: la bitácora conserva la factura y sus vínculos (registrar_cambio).
create function public.anular_factura(p_id uuid, p_motivo text) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_motivo text;
begin
  perform interno.exigir_asistente();
  if not exists (select 1 from public.factura where id = p_id and organizacion_id = public.mi_organizacion()) then
    raise exception 'La factura no existe.' using errcode = 'PT404';
  end if;
  v_motivo := interno.exigir_motivo(p_motivo);
  perform interno.anotar_motivo(v_motivo);
  delete from public.factura where id = p_id;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Estado de matrícula (CE-67 a CE-74, RN-20).
-- La regla de la fecha vive en la base (principio 1): aunque se escriba la tabla
-- directo por la API, el estado no cambia sin una fecha válida, y la fecha no se
-- mueve sola.
-- -----------------------------------------------------------------------------
create function public.revisar_estado_matricula() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado_matricula is distinct from old.estado_matricula then
    if new.fecha_cambio_estado is null then
      raise exception 'Falta la fecha del cambio de estado.' using errcode = 'check_violation';
    end if;
    if new.fecha_cambio_estado > public.hoy_managua() then
      raise exception 'La fecha del cambio de estado no puede ser posterior a hoy.' using errcode = 'check_violation';
    end if;
    if new.fecha_cambio_estado < old.fecha_cambio_estado then
      raise exception 'La fecha del cambio no puede ser anterior al último cambio de estado (%).',
        to_char(old.fecha_cambio_estado, 'DD/MM/YYYY') using errcode = 'check_violation';
    end if;
  elsif new.fecha_cambio_estado is distinct from old.fecha_cambio_estado then
    raise exception 'La fecha del cambio de estado solo cambia con el estado.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger revisar_estado before update of estado_matricula, fecha_cambio_estado on public.estudiante
  for each row execute function public.revisar_estado_matricula();

-- Respuestas: cambiado | advertir (con las inscripciones En curso, CE-71)
create function public.cambiar_estado_matricula(p_estudiante uuid, p_estado text, p_fecha date default null,
  p_observacion text default null, p_confirmar boolean default false) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_actual text;
  v_fecha date := coalesce(p_fecha, public.hoy_managua());
  v_obs text := nullif(btrim(coalesce(p_observacion, '')), '');
  v_en_curso jsonb;
begin
  perform interno.exigir_asistente();                                                         -- CE-74
  select estado_matricula into v_actual from public.estudiante
  where id = p_estudiante and organizacion_id = public.mi_organizacion();
  if v_actual is null then raise exception 'El estudiante no existe.' using errcode = 'PT404'; end if;
  if v_actual = p_estado then                                                                 -- CE-68
    raise exception 'El estudiante ya está en estado %.', p_estado using errcode = 'check_violation';
  end if;
  if length(v_obs) > 300 then                                                                 -- CE-70
    raise exception 'La observación admite hasta 300 caracteres.' using errcode = 'check_violation';
  end if;

  if p_estado in ('Desertor', 'Egresado') and not p_confirmar then                            -- CE-71
    select coalesce(jsonb_agg(jsonb_build_object('inscripcion_id', i.id, 'grupo_id', g.id,
             'codigo_grupo', g.codigo_grupo, 'nivel', n.nombre, 'estado_acta', g.estado_acta)
             order by g.fecha_inicio), '[]'::jsonb)
      into v_en_curso
    from public.inscripcion i join public.grupo g on g.id = i.grupo_id join public.nivel n on n.id = g.nivel_id
    where i.estudiante_id = p_estudiante and i.estado_inscripcion = 'En curso';
    if jsonb_array_length(v_en_curso) > 0 then
      return jsonb_build_object('estado', 'advertir', 'inscripciones', v_en_curso);
    end if;
  end if;

  perform interno.anotar_motivo(coalesce(v_obs, 'Cambio de estado de matrícula'));           -- CE-73
  update public.estudiante set estado_matricula = p_estado, fecha_cambio_estado = v_fecha
  where id = p_estudiante;
  return jsonb_build_object('estado', 'cambiado', 'estado_matricula', p_estado, 'fecha', v_fecha);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Filtrado con verificación de completitud (CE-1 a CE-28, RF-10, RN-23, D30).
-- -----------------------------------------------------------------------------

-- Punto de prueba de CE-11: siempre 0. La prueba t22 lo reemplaza por 1 para
-- simular que lo obtenido no cuadra con el total. Volátil a propósito, para que
-- ningún plan guardado lo fije.
create function interno.desfase_completitud() returns int
language sql volatile
set search_path = ''
as $$ select 0 $$;

-- Fecha de un criterio: null si viene vacía; error legible si no existe o su año
-- no tiene cuatro cifras (CE-7).
create function interno.fecha_criterio(p_texto text, p_campo text) returns date
language plpgsql immutable
set search_path = ''
as $$
declare v date;
begin
  if p_texto is null or btrim(p_texto) = '' then return null; end if;
  if p_texto !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'La fecha debe tener día, mes y un año de cuatro cifras.' using errcode = 'invalid_datetime_format', detail = p_campo;
  end if;
  begin
    v := p_texto::date;
  exception when others then
    raise exception 'Esa fecha no existe.' using errcode = 'invalid_datetime_format', detail = p_campo;
  end;
  return v;
end $$;

-- CE-1, CE-6 a CE-8: revisa los criterios. Devuelve null si están bien, o
-- {campo, mensaje} con el primero que falla.
create function interno.revisar_criterios(c jsonb, p_vista text) returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  k text;
  v_uuid uuid;
  v_desde date; v_hasta date;
  c_claves constant text[] := array['sucursal_id', 'programa', 'nivel_id', 'modalidad_id', 'horario_id', 'profesor_id',
    'estado_matricula', 'estado_inscripcion', 'estado_academico', 'desde', 'hasta'];
  c_tablas constant jsonb := '{"sucursal_id":"sucursal","nivel_id":"nivel","modalidad_id":"modalidad","horario_id":"horario","profesor_id":"profesor"}';
  v_existe boolean;
begin
  if p_vista not in ('inscripciones', 'estudiantes') then
    return jsonb_build_object('campo', 'vista', 'mensaje', 'La vista debe ser Inscripciones o Estudiantes.');
  end if;
  if jsonb_typeof(c) <> 'object' then
    return jsonb_build_object('campo', 'criterios', 'mensaje', 'Los criterios no tienen la forma esperada.');
  end if;
  for k in select jsonb_object_keys(c) loop
    if not k = any(c_claves) then
      return jsonb_build_object('campo', k, 'mensaje', 'Ese criterio no existe.');
    end if;
  end loop;

  -- Identificadores de catálogo: deben existir en la organización (CE-1, CE-95).
  for k in select jsonb_object_keys(c_tablas) loop
    if nullif(c ->> k, '') is not null then
      begin
        v_uuid := (c ->> k)::uuid;
      exception when others then
        return jsonb_build_object('campo', k, 'mensaje', 'Ese valor no existe en el catálogo.');
      end;
      execute format('select exists (select 1 from public.%I where id = $1 and organizacion_id = $2)', c_tablas ->> k)
        into v_existe using v_uuid, v_org;
      if not v_existe then
        return jsonb_build_object('campo', k, 'mensaje', 'Ese valor no existe en el catálogo.');
      end if;
    end if;
  end loop;

  if nullif(c ->> 'programa', '') is not null and not exists (
       select 1 from public.nivel where organizacion_id = v_org and programa = c ->> 'programa') then
    return jsonb_build_object('campo', 'programa', 'mensaje', 'Ese programa no existe en el catálogo.');
  end if;
  if coalesce(c ->> 'estado_matricula', '') not in ('', 'Activo', 'Desertor', 'Egresado') then
    return jsonb_build_object('campo', 'estado_matricula', 'mensaje', 'El estado de matrícula debe ser Activo, Desertor o Egresado.');
  end if;
  if coalesce(c ->> 'estado_inscripcion', '') not in ('', 'En curso', 'Completada', 'Retirada', 'Trasladada') then
    return jsonb_build_object('campo', 'estado_inscripcion', 'mensaje', 'Ese estado de inscripción no existe.');
  end if;
  if coalesce(c ->> 'estado_academico', '') not in ('', 'Pendiente', 'Aprobado', 'Reprobado', 'Condicionado') then
    return jsonb_build_object('campo', 'estado_academico', 'mensaje', 'El estado académico debe ser Pendiente, Aprobado, Reprobado o Condicionado.');
  end if;

  -- CE-6: el horario pertenece a la modalidad elegida (RN-07).
  if nullif(c ->> 'horario_id', '') is not null and nullif(c ->> 'modalidad_id', '') is not null and not exists (
       select 1 from public.horario where id = (c ->> 'horario_id')::uuid and modalidad_id = (c ->> 'modalidad_id')::uuid) then
    return jsonb_build_object('campo', 'horario_id', 'mensaje', 'Ese horario no pertenece a la modalidad elegida.');
  end if;
  -- CE-8: el nivel pertenece al programa elegido.
  if nullif(c ->> 'nivel_id', '') is not null and nullif(c ->> 'programa', '') is not null and not exists (
       select 1 from public.nivel where id = (c ->> 'nivel_id')::uuid and programa = c ->> 'programa') then
    return jsonb_build_object('campo', 'nivel_id', 'mensaje', 'Ese nivel no pertenece al programa elegido.');
  end if;

  -- CE-7: fechas que existen y rango en orden (RN-08).
  for k in select unnest(array['desde', 'hasta']) loop
    begin
      perform interno.fecha_criterio(c ->> k, k);
    exception when invalid_datetime_format then
      return jsonb_build_object('campo', k, 'mensaje', sqlerrm);
    end;
  end loop;
  v_desde := interno.fecha_criterio(c ->> 'desde', 'desde');
  v_hasta := interno.fecha_criterio(c ->> 'hasta', 'hasta');
  if v_desde is not null and v_hasta is not null and v_hasta < v_desde then
    return jsonb_build_object('campo', 'hasta', 'mensaje', 'La fecha final no puede ser anterior a la inicial.');
  end if;
  return null;
end $$;

-- Las inscripciones que cumplen los criterios de inscripción. p_con_sucursal:
-- aplica el criterio de sucursal al grupo (vista Inscripciones, CE-4).
create function interno.inscripciones_que_cumplen(c jsonb, p_con_sucursal boolean)
returns table (inscripcion_id uuid, estudiante_id uuid)
language sql stable
set search_path = ''
as $$
  select i.id, i.estudiante_id
  from public.inscripcion i
  join public.grupo g on g.id = i.grupo_id
  join public.nivel n on n.id = g.nivel_id
  join public.horario h on h.id = g.horario_id
  where i.organizacion_id = public.mi_organizacion()
    and (not p_con_sucursal or nullif(c ->> 'sucursal_id', '') is null or g.sucursal_id = (c ->> 'sucursal_id')::uuid)
    and (nullif(c ->> 'programa', '') is null or n.programa = c ->> 'programa')
    and (nullif(c ->> 'nivel_id', '') is null or g.nivel_id = (c ->> 'nivel_id')::uuid)
    and (nullif(c ->> 'modalidad_id', '') is null or h.modalidad_id = (c ->> 'modalidad_id')::uuid)
    and (nullif(c ->> 'horario_id', '') is null or g.horario_id = (c ->> 'horario_id')::uuid)
    and (nullif(c ->> 'profesor_id', '') is null or g.profesor_id = (c ->> 'profesor_id')::uuid)
    and (nullif(c ->> 'estado_inscripcion', '') is null or i.estado_inscripcion = c ->> 'estado_inscripcion')
    -- CE-5: grupos en curso algún día del rango.
    and (nullif(c ->> 'hasta', '') is null or g.fecha_inicio <= (c ->> 'hasta')::date)
    and (nullif(c ->> 'desde', '') is null or g.fecha_termino >= (c ->> 'desde')::date)
    -- CE-16: el mismo cálculo del acta (002, D24).
    and (nullif(c ->> 'estado_academico', '') is null or exists (
          select 1 from public.resultado_academico r
          where r.inscripcion_id = i.id and r.estado_academico = c ->> 'estado_academico'))
$$;

-- ¿Hay algún criterio que sea de la inscripción? (CE-3)
create function interno.hay_criterio_de_inscripcion(c jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select exists (select 1 from jsonb_each_text(c) x
                 where x.key not in ('sucursal_id', 'estado_matricula') and nullif(x.value, '') is not null)
$$;

-- p_destino: pantalla (una página de 50) | exportar | imprimir (todas las filas).
-- Respuestas: ok | criterios_invalidos | incompleto | denegado
create function public.filtrar(p_criterios jsonb, p_vista text default 'inscripciones', p_pagina int default 1,
  p_destino text default 'pantalla') returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  c_por_pagina constant int := 50;
  c jsonb := coalesce(p_criterios, '{}'::jsonb);
  v_vista text := coalesce(p_vista, 'inscripciones');
  v_pagina int := greatest(coalesce(p_pagina, 1), 1);
  v_todo boolean;
  v_error jsonb;
  v_total int;
  v_filas jsonb;
  v_esperados int;
  v_obtenidos int;
  v_desde int; v_hasta int;
  v_matricula text := nullif(c ->> 'estado_matricula', '');
  v_sucursal uuid;
begin
  perform interno.exigir_acceso();
  if not (public.tiene_rol('asistente') or public.tiene_rol('direccion')) then                -- CE-18
    perform public.registrar_evento('Denegación', 'filtrado', v_vista, left(c::text, 900));
    return jsonb_build_object('estado', 'denegado');
  end if;
  if p_destino not in ('pantalla', 'exportar', 'imprimir') then
    return jsonb_build_object('estado', 'criterios_invalidos', 'campo', 'destino', 'mensaje', 'Destino desconocido.');
  end if;
  v_error := interno.revisar_criterios(c, v_vista);
  if v_error is not null then
    return jsonb_build_object('estado', 'criterios_invalidos') || v_error;
  end if;
  v_todo := p_destino <> 'pantalla';
  v_desde := case when v_todo then 1 else (v_pagina - 1) * c_por_pagina + 1 end;
  v_hasta := case when v_todo then 2147483647 else v_pagina * c_por_pagina end;
  v_sucursal := nullif(c ->> 'sucursal_id', '')::uuid;

  -- Total y filas en UNA consulta (D30): salen del mismo instante.
  if v_vista = 'inscripciones' then
    select coalesce(max(x.total), 0)::int,
           coalesce(jsonb_agg(x.fila order by x.orden) filter (where x.orden between v_desde and v_hasta), '[]'::jsonb)
      into v_total, v_filas
    from (
      select count(*) over () as total,
             row_number() over (order by public.normalizar(e.apellidos), public.normalizar(e.nombres), e.codigo_adei,
                                         g.fecha_inicio, g.codigo_grupo) as orden,
             jsonb_build_object(
               'id', i.id, 'estudiante_id', e.id, 'codigo_adei', e.codigo_adei, 'apellidos', e.apellidos,
               'nombres', e.nombres, 'estado_matricula', e.estado_matricula,
               'sucursal', s.nombre, 'grupo_id', g.id, 'codigo_grupo', g.codigo_grupo, 'programa', n.programa,
               'nivel', n.nombre, 'modalidad', m.nombre, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin,
               'profesor', p.nombres || ' ' || p.apellidos, 'fecha_inicio', g.fecha_inicio, 'fecha_termino', g.fecha_termino,
               'estado_acta', g.estado_acta, 'estado_inscripcion', i.estado_inscripcion) as fila
      from interno.inscripciones_que_cumplen(c, true) q
      join public.inscripcion i on i.id = q.inscripcion_id
      join public.estudiante e on e.id = i.estudiante_id
      join public.grupo g on g.id = i.grupo_id
      join public.nivel n on n.id = g.nivel_id
      join public.horario h on h.id = g.horario_id
      join public.modalidad m on m.id = h.modalidad_id
      join public.profesor p on p.id = g.profesor_id
      join public.sucursal s on s.id = g.sucursal_id
      where v_matricula is null or e.estado_matricula = v_matricula
    ) x;
    -- La nota y el estado, solo para las filas que se devuelven (D24: se calculan al leer).
    select coalesce(jsonb_agg(f || jsonb_build_object('nota_final', r.nota_final, 'estado_academico', r.estado_academico,
             'provisional', r.provisional) order by o), '[]'::jsonb)
      into v_filas
    from jsonb_array_elements(v_filas) with ordinality as t(f, o)
    left join public.resultado_academico r on r.inscripcion_id = (f ->> 'id')::uuid;
  else
    select coalesce(max(x.total), 0)::int,
           coalesce(jsonb_agg(x.fila order by x.orden) filter (where x.orden between v_desde and v_hasta), '[]'::jsonb)
      into v_total, v_filas
    from (
      select count(*) over () as total,
             row_number() over (order by public.normalizar(e.apellidos), public.normalizar(e.nombres), e.codigo_adei) as orden,
             jsonb_build_object(
               'id', e.id, 'codigo_adei', e.codigo_adei, 'apellidos', e.apellidos, 'nombres', e.nombres,
               'cedula', e.cedula, 'sucursal', s.nombre, 'estado_matricula', e.estado_matricula,
               'inscripciones', coalesce(q.cuantas, 0),
               'ultimo_nivel', (select n.nombre from public.inscripcion i2 join public.grupo g2 on g2.id = i2.grupo_id
                                join public.nivel n on n.id = g2.nivel_id
                                where i2.estudiante_id = e.id order by g2.fecha_inicio desc, g2.codigo_grupo desc limit 1)) as fila
      from public.estudiante e
      join public.sucursal s on s.id = e.sucursal_id
      left join (select q.estudiante_id, count(*)::int as cuantas
                 from interno.inscripciones_que_cumplen(c, false) q group by q.estudiante_id) q on q.estudiante_id = e.id
      where e.organizacion_id = public.mi_organizacion()
        and (v_sucursal is null or e.sucursal_id = v_sucursal)
        and (v_matricula is null or e.estado_matricula = v_matricula)
        and (q.estudiante_id is not null or not interno.hay_criterio_de_inscripcion(c))      -- CE-3
    ) x;
  end if;

  -- Comprobación de completitud (CE-11, CE-25, RN-23).
  v_esperados := case when v_todo then v_total else greatest(0, least(c_por_pagina, v_total - (v_pagina - 1) * c_por_pagina)) end;
  v_obtenidos := jsonb_array_length(v_filas) + interno.desfase_completitud();
  if v_obtenidos <> v_esperados then
    perform public.registrar_evento('Incidente', 'filtrado', v_vista, left(jsonb_build_object(
      'criterios', c, 'destino', p_destino, 'pagina', v_pagina, 'total', v_total,
      'esperados', v_esperados, 'obtenidos', v_obtenidos)::text, 1000));
    return jsonb_build_object('estado', 'incompleto', 'total', v_total, 'esperados', v_esperados, 'obtenidos', v_obtenidos);
  end if;

  perform public.registrar_evento('Consulta', 'filtrado', v_vista, left(jsonb_build_object(        -- CE-17, CE-28
    'criterios', c, 'destino', p_destino, 'pagina', v_pagina, 'total', v_total)::text, 1000));
  return jsonb_build_object('estado', 'ok', 'vista', v_vista, 'total', v_total, 'pagina', v_pagina,
    'por_pagina', c_por_pagina, 'filas', v_filas);
end $$;

-- -----------------------------------------------------------------------------
-- 5. Historial académico (CE-36 a CE-43, RF-11) y Hoja de matrícula (CE-44 a
-- CE-51, RF-18). Devuelven los datos; «sin registro» y las líneas en blanco los
-- pone dominio/hoja-matricula.ts (CE-46, CE-47).
-- -----------------------------------------------------------------------------

-- La factura en el formato que leen las pantallas.
create function interno.factura_json(f public.factura) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case when f.id is null then null else jsonb_build_object(
    'id', f.id, 'serie', f.serie, 'numero', f.numero, 'fecha_emision', f.fecha_emision, 'monto', f.monto,
    'moneda', f.moneda, 'forma_pago', f.forma_pago, 'inscripcion_id', f.inscripcion_id, 'version', f.version) end
$$;

-- Respuestas: ok | denegado
create function public.historial_academico(p_estudiante uuid) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_est jsonb;
begin
  perform interno.exigir_acceso();
  if not (public.tiene_rol('asistente') or public.tiene_rol('direccion')) then                -- CE-18
    perform public.registrar_evento('Denegación', 'historial', p_estudiante::text);
    return jsonb_build_object('estado', 'denegado');
  end if;
  select jsonb_build_object('id', e.id, 'codigo_adei', e.codigo_adei, 'nombres', e.nombres, 'apellidos', e.apellidos,
           'cedula', e.cedula, 'sucursal', s.nombre, 'estado_matricula', e.estado_matricula,
           'fecha_cambio_estado', e.fecha_cambio_estado, 'origen_registro', e.origen_registro)
    into v_est
  from public.estudiante e join public.sucursal s on s.id = e.sucursal_id
  where e.id = p_estudiante and e.organizacion_id = public.mi_organizacion();
  if v_est is null then raise exception 'El estudiante no existe.' using errcode = 'PT404'; end if;

  perform public.registrar_evento('Consulta', 'historial', p_estudiante::text);               -- CE-41
  return jsonb_build_object('estado', 'ok', 'estudiante', v_est,
    -- CE-37: en orden cronológico por inicio del grupo. Las anuladas ya no existen (CE-42).
    'inscripciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'grupo_id', g.id, 'codigo_grupo', g.codigo_grupo, 'programa', n.programa, 'nivel', n.nombre,
        'modalidad', m.nombre, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin,
        'profesor', p.nombres || ' ' || p.apellidos, 'sucursal', s.nombre,
        'fecha_inicio', g.fecha_inicio, 'fecha_termino', g.fecha_termino, 'estado_acta', g.estado_acta,
        'estado_inscripcion', i.estado_inscripcion, 'parciales', coalesce(r.parciales, '[]'::jsonb),
        'nota_final', r.nota_final, 'provisional', r.provisional, 'estado_academico', r.estado_academico,
        'condicionado', r.condicionado, 'justificacion_condicionado', r.justificacion_condicionado,
        'factura', interno.factura_json(f))
        order by g.fecha_inicio, g.codigo_grupo)
      from public.inscripcion i
      join public.grupo g on g.id = i.grupo_id
      join public.nivel n on n.id = g.nivel_id
      join public.horario h on h.id = g.horario_id
      join public.modalidad m on m.id = h.modalidad_id
      join public.profesor p on p.id = g.profesor_id
      join public.sucursal s on s.id = g.sucursal_id
      left join public.resultado_academico r on r.inscripcion_id = i.id
      left join public.factura f on f.inscripcion_id = i.id
      where i.estudiante_id = p_estudiante), '[]'::jsonb),
    -- CE-65: todas las facturas que lo amparan, también las familiares.
    'facturas', coalesce((
      select jsonb_agg(interno.factura_json(f) || jsonb_build_object(
               'codigo_grupo', (select g.codigo_grupo from public.inscripcion i join public.grupo g on g.id = i.grupo_id
                                where i.id = f.inscripcion_id),
               'amparados', (select count(*) from public.factura_estudiante x where x.factura_id = f.id),
               'otros_amparados', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'codigo_adei', o.codigo_adei,
                                     'nombre', o.apellidos || ', ' || o.nombres) order by o.codigo_adei), '[]'::jsonb)
                                   from public.factura_estudiante x join public.estudiante o on o.id = x.estudiante_id
                                   where x.factura_id = f.id and x.estudiante_id <> p_estudiante))
             order by f.fecha_emision desc, f.serie, f.numero desc)
      from public.factura f join public.factura_estudiante fe on fe.factura_id = f.id
      where fe.estudiante_id = p_estudiante), '[]'::jsonb));
end $$;

-- Respuestas: ok | denegado. Solo la Asistente (CE-51).
create function public.hoja_matricula(p_inscripcion uuid) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_est uuid;
  v_alumno jsonb; v_tutor jsonb; v_extra int; v_academia jsonb;
begin
  perform interno.exigir_acceso();
  if not public.tiene_rol('asistente') then
    perform public.registrar_evento('Denegación', 'hoja_matricula', p_inscripcion::text);
    return jsonb_build_object('estado', 'denegado');
  end if;
  select i.estudiante_id into v_est from public.inscripcion i where i.id = p_inscripcion and i.organizacion_id = v_org;
  if v_est is null then raise exception 'La inscripción no existe.' using errcode = 'PT404'; end if;

  select jsonb_build_object('nombres', e.nombres, 'apellidos', e.apellidos, 'fecha_nacimiento', e.fecha_nacimiento,
           'edad', public.edad(e.fecha_nacimiento, public.hoy_managua()), 'direccion', e.direccion, 'cedula', e.cedula,
           'telefono', e.telefono, 'correo', e.correo, 'contacto_emergencia', e.contacto_emergencia,
           'codigo_adei', e.codigo_adei, 'id', e.id,
           'fecha_ingreso', (e.creado_en at time zone 'America/Managua')::date)
    into v_alumno
  from public.estudiante e where e.id = v_est;

  -- CE-49: el primer tutor vinculado (según la bitácora) y cuántos más hay.
  select to_jsonb(x) - 'orden', (count(*) over ()) - 1
    into v_tutor, v_extra
  from (
    select t.nombre_completo, t.cedula, t.telefono,
           (select min(a.id) from public.auditoria a
            where a.entidad = 'estudiante_tutor' and a.tipo_accion = 'Creación'
              and a.registro_afectado = et.estudiante_id || ':' || et.tutor_id) as orden
    from public.estudiante_tutor et join public.tutor t on t.id = et.tutor_id
    where et.estudiante_id = v_est
  ) x
  order by x.orden nulls last, x.nombre_completo
  limit 1;

  select jsonb_build_object('nivel', n.nombre, 'curso', n.programa, 'modalidad', m.nombre,
           'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin, 'fecha_inicio', g.fecha_inicio,
           'fecha_termino', g.fecha_termino, 'profesor', p.nombres || ' ' || p.apellidos,
           'sucursal', s.nombre, 'codigo_grupo', g.codigo_grupo, 'grupo_id', g.id,
           'inscrito_por', (select u.nombre_usuario from public.auditoria a join public.usuario u on u.id = a.usuario_id
                            where a.entidad = 'inscripcion' and a.tipo_accion = 'Creación' and a.registro_afectado = i.id::text
                            order by a.id limit 1),
           'recibo', case when f.id is not null then f.serie || '-' || f.numero end,
           'paga', case when f.id is not null then jsonb_build_object('monto', f.monto, 'moneda', f.moneda) end)
    into v_academia
  from public.inscripcion i
  join public.grupo g on g.id = i.grupo_id
  join public.nivel n on n.id = g.nivel_id
  join public.horario h on h.id = g.horario_id
  join public.modalidad m on m.id = h.modalidad_id
  join public.profesor p on p.id = g.profesor_id
  join public.sucursal s on s.id = g.sucursal_id
  left join public.factura f on f.inscripcion_id = i.id
  where i.id = p_inscripcion;

  perform public.registrar_evento('Consulta', 'hoja_matricula', p_inscripcion::text);         -- CE-50
  return jsonb_build_object('estado', 'ok', 'alumno', v_alumno, 'tutor', v_tutor,
    'tutores_adicionales', coalesce(v_extra, 0), 'academia', v_academia);
end $$;

-- -----------------------------------------------------------------------------
-- 6. Panel de entrega de actas (CE-75 a CE-80, RF-20).
-- -----------------------------------------------------------------------------

-- Período: el mes en curso si no se da (CE-76, CE-83); el final no antes que el inicio.
create function interno.periodo(p_desde date, p_hasta date, out desde date, out hasta date)
language plpgsql stable
set search_path = ''
as $$
declare v_mes date := date_trunc('month', public.hoy_managua())::date;
begin
  desde := coalesce(p_desde, v_mes);
  hasta := coalesce(p_hasta, (v_mes + interval '1 month - 1 day')::date);
  if hasta < desde then
    raise exception 'La fecha final del período no puede ser anterior a la inicial.' using errcode = 'check_violation';
  end if;
end $$;

-- Respuestas: ok | incompleto | denegado
create function public.panel_actas(p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_p record;
  v_hoy date := public.hoy_managua();
  v_profesores jsonb; v_totales jsonb; v_suma jsonb;
begin
  perform interno.exigir_acceso();
  if not (public.tiene_rol('asistente') or public.tiene_rol('direccion')) then
    perform public.registrar_evento('Denegación', 'panel_actas');
    return jsonb_build_object('estado', 'denegado');
  end if;
  select * into v_p from interno.periodo(p_desde, p_hasta);

  -- Una sola consulta: los renglones por profesor y el total salen del mismo instante (CE-79, D36).
  with g as (
    select g.*, n.nombre as nivel, h.hora_inicio, h.hora_fin, m.nombre as modalidad,
           g.estado_acta = 'Entregada' as entregada,
           g.estado_acta = 'Abierta' and g.fecha_termino < v_hoy as vencida,
           (select count(*) from public.inscripcion i
            where i.grupo_id = g.id and i.estado_inscripcion not in ('Retirada', 'Trasladada')
              and (select count(*) from public.parcial p where p.inscripcion_id = i.id) = 3)::int as completas,
           (select count(*) from public.inscripcion i
            where i.grupo_id = g.id and i.estado_inscripcion not in ('Retirada', 'Trasladada'))::int as total
    from public.grupo g
    join public.nivel n on n.id = g.nivel_id
    join public.horario h on h.id = g.horario_id
    join public.modalidad m on m.id = h.modalidad_id
    where g.organizacion_id = public.mi_organizacion()
      and g.fecha_termino between v_p.desde and v_p.hasta                                     -- CE-75 (A9)
  ),
  por_profesor as (
    -- CE-80: el profesor actual del grupo.
    select p.id as profesor_id, p.nombres || ' ' || p.apellidos as profesor, p.apellidos, p.nombres,
           count(*)::int as grupos, count(*) filter (where g.entregada)::int as entregadas,
           count(*) filter (where not g.entregada)::int as pendientes, count(*) filter (where g.vencida)::int as vencidas,
           jsonb_agg(jsonb_build_object('grupo_id', g.id, 'codigo_grupo', g.codigo_grupo, 'nivel', g.nivel,
             'modalidad', g.modalidad, 'hora_inicio', g.hora_inicio, 'hora_fin', g.hora_fin,
             'fecha_inicio', g.fecha_inicio, 'fecha_termino', g.fecha_termino, 'estado_acta', g.estado_acta,
             'fecha_entrega_acta', g.fecha_entrega_acta, 'vencida', g.vencida,
             'completas', g.completas, 'total', g.total) order by g.fecha_termino, g.codigo_grupo) as detalle
    from g join public.profesor p on p.id = g.profesor_id
    group by p.id
  )
  select
    coalesce((select jsonb_agg(to_jsonb(x) - 'apellidos' - 'nombres'
                               order by x.vencidas desc, x.pendientes desc, public.normalizar(x.apellidos), public.normalizar(x.nombres))
              from por_profesor x), '[]'::jsonb),
    (select jsonb_build_object('grupos', count(*)::int, 'entregadas', count(*) filter (where entregada)::int,
                               'pendientes', count(*) filter (where not entregada)::int,
                               'vencidas', count(*) filter (where vencida)::int) from g),
    (select jsonb_build_object('grupos', coalesce(sum(grupos), 0)::int, 'entregadas', coalesce(sum(entregadas), 0)::int,
                               'pendientes', coalesce(sum(pendientes), 0)::int, 'vencidas', coalesce(sum(vencidas), 0)::int)
     from por_profesor)
  into v_profesores, v_totales, v_suma;

  if v_totales <> v_suma then                                                                -- CE-79
    perform public.registrar_evento('Incidente', 'panel_actas', null,
      jsonb_build_object('totales', v_totales, 'suma', v_suma)::text);
    return jsonb_build_object('estado', 'incompleto');
  end if;
  perform public.registrar_evento('Consulta', 'panel_actas', null,
    jsonb_build_object('desde', v_p.desde, 'hasta', v_p.hasta)::text);
  return jsonb_build_object('estado', 'ok', 'desde', v_p.desde, 'hasta', v_p.hasta, 'hoy', v_hoy,
    'totales', v_totales, 'profesores', v_profesores);
end $$;

-- -----------------------------------------------------------------------------
-- 7. Reporte por sucursal (CE-81 a CE-88, RF-21). Por la sucursal del estudiante
-- (A2), para que cada cifra coincida con la vista Estudiantes del filtrado (CE-88).
-- -----------------------------------------------------------------------------
create function public.reporte_sucursales(p_desde date default null, p_hasta date default null, p_sucursal uuid default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_p record;
  v_filas jsonb; v_totales jsonb; v_suma jsonb;
begin
  perform interno.exigir_acceso();
  if not (public.tiene_rol('asistente') or public.tiene_rol('direccion')) then
    perform public.registrar_evento('Denegación', 'reporte_sucursales');
    return jsonb_build_object('estado', 'denegado');
  end if;
  select * into v_p from interno.periodo(p_desde, p_hasta);
  if p_sucursal is not null and not exists (select 1 from public.sucursal where id = p_sucursal and organizacion_id = v_org) then
    raise exception 'La sucursal no existe.' using errcode = 'PT404';
  end if;

  with e as (
    select x.sucursal_id, x.estado_matricula,
           (x.creado_en at time zone 'America/Managua')::date between v_p.desde and v_p.hasta as registrado,
           x.fecha_cambio_estado between v_p.desde and v_p.hasta as cambio_en_periodo
    from public.estudiante x
    where x.organizacion_id = v_org and (p_sucursal is null or x.sucursal_id = p_sucursal)
  ),
  filas as (
    select s.id as sucursal_id, s.nombre as sucursal, s.es_central,
           count(e.*) filter (where e.estado_matricula = 'Activo')::int as activos,
           count(e.*) filter (where e.estado_matricula = 'Desertor')::int as desertores,
           count(e.*) filter (where e.estado_matricula = 'Egresado')::int as egresados,
           count(e.*)::int as total,
           count(e.*) filter (where e.registrado)::int as registrados,
           count(e.*) filter (where e.estado_matricula = 'Desertor' and e.cambio_en_periodo)::int as a_desertor,
           count(e.*) filter (where e.estado_matricula = 'Egresado' and e.cambio_en_periodo)::int as a_egresado
    from public.sucursal s left join e on e.sucursal_id = s.id
    where s.organizacion_id = v_org and (p_sucursal is null or s.id = p_sucursal)
    group by s.id
  )
  select
    coalesce((select jsonb_agg(to_jsonb(f) - 'es_central' order by f.es_central desc, f.sucursal) from filas f), '[]'::jsonb),
    (select jsonb_build_object('activos', count(*) filter (where estado_matricula = 'Activo')::int,
       'desertores', count(*) filter (where estado_matricula = 'Desertor')::int,
       'egresados', count(*) filter (where estado_matricula = 'Egresado')::int, 'total', count(*)::int,
       'registrados', count(*) filter (where registrado)::int,
       'a_desertor', count(*) filter (where estado_matricula = 'Desertor' and cambio_en_periodo)::int,
       'a_egresado', count(*) filter (where estado_matricula = 'Egresado' and cambio_en_periodo)::int) from e),
    (select jsonb_build_object('activos', coalesce(sum(activos), 0)::int, 'desertores', coalesce(sum(desertores), 0)::int,
       'egresados', coalesce(sum(egresados), 0)::int, 'total', coalesce(sum(total), 0)::int,
       'registrados', coalesce(sum(registrados), 0)::int, 'a_desertor', coalesce(sum(a_desertor), 0)::int,
       'a_egresado', coalesce(sum(a_egresado), 0)::int) from filas)
  into v_filas, v_totales, v_suma;

  if v_totales <> v_suma then                                                                -- CE-86
    perform public.registrar_evento('Incidente', 'reporte_sucursales', null,
      jsonb_build_object('totales', v_totales, 'suma', v_suma)::text);
    return jsonb_build_object('estado', 'incompleto');
  end if;
  perform public.registrar_evento('Consulta', 'reporte_sucursales', p_sucursal::text,
    jsonb_build_object('desde', v_p.desde, 'hasta', v_p.hasta)::text);
  return jsonb_build_object('estado', 'ok', 'desde', v_p.desde, 'hasta', v_p.hasta, 'sucursales', v_filas,
    'totales', v_totales,
    'sin_datos', (v_totales ->> 'total')::int = 0 and (v_totales ->> 'registrados')::int = 0);   -- CE-85
end $$;

-- -----------------------------------------------------------------------------
-- 8. Bitácora (CE-89 a CE-94, RF-15, CU-04). Solo Dirección. Se enmascara al
-- leer, nunca al guardar (D37).
-- -----------------------------------------------------------------------------
create function interno.enmascarar(p_texto text) returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(p_texto, '\d{3}-\d{6}-\d(\d{3}[A-Za-z])', '***-******-*\1', 'g'),   -- cédula
           '(?<![0-9A-Za-z-])\d{4}(\d{4})(?![0-9A-Za-z-])', '****\1', 'g')                     -- teléfono
$$;

create function interno.enmascarar_valor(p_campo text, p_valor jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case
    when p_valor is null then null
    when p_campo = 'id' or p_campo like '%\_id' then p_valor      -- los identificadores no se tocan
    when jsonb_typeof(p_valor) = 'string' then to_jsonb(interno.enmascarar(p_valor #>> '{}'))
    else p_valor end
$$;

-- CE-91: los campos que cambiaron (en una creación, todos; en una eliminación, todos los que había).
create function interno.cambios(p_anterior jsonb, p_nuevo jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('campo', k,
           'anterior', interno.enmascarar_valor(k, p_anterior -> k),
           'nuevo', interno.enmascarar_valor(k, p_nuevo -> k)) order by k), '[]'::jsonb)
  from (select jsonb_object_keys(coalesce(p_anterior, '{}'::jsonb) || coalesce(p_nuevo, '{}'::jsonb)) as k) x
  where k not in ('version', 'organizacion_id', 'busqueda', 'creado_en')
    and (p_anterior -> k) is distinct from (p_nuevo -> k)
$$;

-- Respuestas: ok | criterios_invalidos | denegado
create function public.bitacora(p_filtros jsonb default '{}', p_pagina int default 1) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  c_por_pagina constant int := 50;
  c jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_org uuid := public.mi_organizacion();
  v_pagina int := greatest(coalesce(p_pagina, 1), 1);
  v_desde date; v_hasta date; v_usuario uuid;
  v_tipo text := nullif(c ->> 'tipo_accion', '');
  v_entidad text := nullif(c ->> 'entidad', '');
  k text;
  v_total int; v_filas jsonb;
begin
  perform interno.exigir_acceso();
  if not public.tiene_rol('direccion') then                                                   -- CE-93
    perform public.registrar_evento('Denegación', 'bitacora');
    return jsonb_build_object('estado', 'denegado');
  end if;
  for k in select jsonb_object_keys(c) loop
    if not k = any(array['desde', 'hasta', 'usuario_id', 'tipo_accion', 'entidad']) then
      return jsonb_build_object('estado', 'criterios_invalidos', 'campo', k, 'mensaje', 'Ese filtro no existe.');
    end if;
  end loop;
  if v_tipo is not null and v_tipo not in ('Consulta', 'Creación', 'Modificación', 'Eliminación', 'Acceso', 'Denegación', 'Incidente') then
    return jsonb_build_object('estado', 'criterios_invalidos', 'campo', 'tipo_accion', 'mensaje', 'Ese tipo de acción no existe.');
  end if;
  begin
    v_desde := interno.fecha_criterio(c ->> 'desde', 'desde');
    v_hasta := interno.fecha_criterio(c ->> 'hasta', 'hasta');
  exception when invalid_datetime_format then
    get stacked diagnostics k = pg_exception_detail;
    return jsonb_build_object('estado', 'criterios_invalidos', 'campo', k, 'mensaje', sqlerrm);
  end;
  if v_desde is not null and v_hasta is not null and v_hasta < v_desde then
    return jsonb_build_object('estado', 'criterios_invalidos', 'campo', 'hasta', 'mensaje', 'La fecha final no puede ser anterior a la inicial.');
  end if;
  if nullif(c ->> 'usuario_id', '') is not null then
    begin
      v_usuario := (c ->> 'usuario_id')::uuid;
    exception when others then
      return jsonb_build_object('estado', 'criterios_invalidos', 'campo', 'usuario_id', 'mensaje', 'Ese usuario no existe.');
    end;
  end if;

  select coalesce(max(x.total), 0)::int,
         coalesce(jsonb_agg(x.fila order by x.orden)
                  filter (where x.orden between (v_pagina - 1) * c_por_pagina + 1 and v_pagina * c_por_pagina), '[]'::jsonb)
    into v_total, v_filas
  from (
    select count(*) over () as total, row_number() over (order by a.id desc) as orden,
           jsonb_build_object('id', a.id, 'fecha_hora', a.fecha_hora, 'usuario', u.nombre_usuario,
             'tipo_accion', a.tipo_accion, 'entidad', a.entidad, 'registro_afectado', a.registro_afectado,
             'detalle', interno.enmascarar(a.detalle),                                         -- CE-94
             'cambios', interno.cambios(a.valor_anterior, a.valor_nuevo)) as fila
    from public.auditoria a left join public.usuario u on u.id = a.usuario_id
    where a.organizacion_id = v_org
      and (v_desde is null or (a.fecha_hora at time zone 'America/Managua')::date >= v_desde)
      and (v_hasta is null or (a.fecha_hora at time zone 'America/Managua')::date <= v_hasta)
      and (v_usuario is null or a.usuario_id = v_usuario)
      and (v_tipo is null or a.tipo_accion = v_tipo)
      and (v_entidad is null or a.entidad = v_entidad)
  ) x;

  perform public.registrar_evento('Consulta', 'bitacora', null, left(c::text, 1000));
  return jsonb_build_object('estado', 'ok', 'total', v_total, 'pagina', v_pagina, 'por_pagina', c_por_pagina,
    'filas', v_filas,
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nombre_usuario', u.nombre_usuario) order by u.nombre_usuario)
                          from public.usuario u where u.organizacion_id = v_org), '[]'::jsonb),
    'entidades', coalesce((select jsonb_agg(distinct a.entidad order by a.entidad)
                           from public.auditoria a where a.organizacion_id = v_org), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- 9. Respaldo completo (CE-31 a CE-35, RNF-08, CU-25). Solo la Asistente. Sin
-- cuentas ni bitácora (A4). Todo en UNA consulta: cada total se cuenta en el
-- mismo instante que sus filas (CE-32).
-- -----------------------------------------------------------------------------
create function interno.hoja(p_nombre text, p_filas jsonb, p_total bigint) returns jsonb
language sql immutable
set search_path = ''
as $$ select jsonb_build_object('nombre', p_nombre, 'total', p_total, 'filas', coalesce(p_filas, '[]'::jsonb)) $$;

-- Respuestas: ok | incompleto | denegado
create function public.respaldo() returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_hojas jsonb;
  v_conteo jsonb;
  v_falla text;
begin
  perform interno.exigir_acceso();
  if not public.tiene_rol('asistente') then                                                   -- CE-34
    perform public.registrar_evento('Denegación', 'respaldo');
    return jsonb_build_object('estado', 'denegado');
  end if;

  select jsonb_build_array(
    interno.hoja('estudiantes',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' - 'busqueda' order by x.codigo_adei) from public.estudiante x where x.organizacion_id = v_org),
      (select count(*) from public.estudiante x where x.organizacion_id = v_org)),
    interno.hoja('tutores',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.nombre_completo) from public.tutor x where x.organizacion_id = v_org),
      (select count(*) from public.tutor x where x.organizacion_id = v_org)),
    interno.hoja('estudiante_tutor',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id') from public.estudiante_tutor x where x.organizacion_id = v_org),
      (select count(*) from public.estudiante_tutor x where x.organizacion_id = v_org)),
    interno.hoja('grupos',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.codigo_grupo) from public.grupo x where x.organizacion_id = v_org),
      (select count(*) from public.grupo x where x.organizacion_id = v_org)),
    interno.hoja('inscripciones',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.fecha_inscripcion, x.id) from public.inscripcion x where x.organizacion_id = v_org),
      (select count(*) from public.inscripcion x where x.organizacion_id = v_org)),
    interno.hoja('parciales',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.inscripcion_id, x.numero) from public.parcial x where x.organizacion_id = v_org),
      (select count(*) from public.parcial x where x.organizacion_id = v_org)),
    interno.hoja('resultados',
      (select jsonb_agg(jsonb_build_object('inscripcion_id', r.inscripcion_id, 'nota_exacta', r.nota_exacta,
                'nota_final', r.nota_final, 'provisional', r.provisional, 'estado_academico', r.estado_academico,
                'condicionado', r.condicionado, 'justificacion_condicionado', r.justificacion_condicionado,
                'aviso_inasistencia', r.aviso_inasistencia, 'baja_inasistencia', r.baja_inasistencia,
                'regla_id', r.regla_id, 'sin_regla', r.sin_regla) order by r.fecha_inscripcion, r.inscripcion_id)
       from public.resultado_academico r where r.organizacion_id = v_org),
      (select count(*) from public.resultado_academico r where r.organizacion_id = v_org)),
    interno.hoja('facturas',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.serie, x.numero) from public.factura x where x.organizacion_id = v_org),
      (select count(*) from public.factura x where x.organizacion_id = v_org)),
    interno.hoja('factura_estudiante',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id') from public.factura_estudiante x where x.organizacion_id = v_org),
      (select count(*) from public.factura_estudiante x where x.organizacion_id = v_org)),
    interno.hoja('sucursales',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.nombre) from public.sucursal x where x.organizacion_id = v_org),
      (select count(*) from public.sucursal x where x.organizacion_id = v_org)),
    interno.hoja('niveles',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.programa, x.orden) from public.nivel x where x.organizacion_id = v_org),
      (select count(*) from public.nivel x where x.organizacion_id = v_org)),
    interno.hoja('modalidades',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.nombre) from public.modalidad x where x.organizacion_id = v_org),
      (select count(*) from public.modalidad x where x.organizacion_id = v_org)),
    interno.hoja('horarios',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.hora_inicio) from public.horario x where x.organizacion_id = v_org),
      (select count(*) from public.horario x where x.organizacion_id = v_org)),
    interno.hoja('profesores',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.apellidos, x.nombres) from public.profesor x where x.organizacion_id = v_org),
      (select count(*) from public.profesor x where x.organizacion_id = v_org)),
    interno.hoja('reglas',
      (select jsonb_agg(to_jsonb(x) - 'organizacion_id' order by x.programa, x.nivel_desde, x.vigente_desde) from public.regla_aprobacion x where x.organizacion_id = v_org),
      (select count(*) from public.regla_aprobacion x where x.organizacion_id = v_org))
  ) into v_hojas;

  select jsonb_object_agg(h ->> 'nombre', (h ->> 'total')::int),
         string_agg(h ->> 'nombre', ', ') filter (where jsonb_array_length(h -> 'filas') <> (h ->> 'total')::int)
    into v_conteo, v_falla
  from jsonb_array_elements(v_hojas) h;
  if v_falla is not null then                                                                -- CE-32
    perform public.registrar_evento('Incidente', 'respaldo', null, 'No cuadran: ' || v_falla);
    return jsonb_build_object('estado', 'incompleto', 'hojas', v_falla);
  end if;

  perform public.registrar_evento('Consulta', 'respaldo', null, v_conteo::text);              -- CE-35
  return jsonb_build_object('estado', 'ok',
    'generado', jsonb_build_object('fecha_hora', now(),
                  'usuario', (select nombre_usuario from public.usuario where id = auth.uid())),
    'hojas', v_hojas);
end $$;

-- =============================================================================
-- Permisos de ejecución: solo las operaciones públicas. Las de interno las usan
-- funciones SECURITY DEFINER.
-- =============================================================================
grant execute on function
  public.registrar_factura(jsonb, boolean), public.corregir_factura(uuid, int, jsonb, text, boolean),
  public.anular_factura(uuid, text), public.cambiar_estado_matricula(uuid, text, date, text, boolean),
  public.filtrar(jsonb, text, int, text), public.historial_academico(uuid), public.hoja_matricula(uuid),
  public.panel_actas(date, date), public.reporte_sucursales(date, date, uuid), public.bitacora(jsonb, int),
  public.respaldo()
  to authenticated;

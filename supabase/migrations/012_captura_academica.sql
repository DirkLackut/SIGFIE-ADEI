-- =============================================================================
-- 012 · Captura académica: regla de aprobación, parciales, resultado y acta
-- Spec 002: CE-1 a CE-62 · Plan 002 §3 a §5, D24 a D29
--
-- Tres tablas nuevas y una vista:
--   regla_aprobacion   la regla de ADEI como datos (programa, niveles, vigencia)
--   parcial            un parcial con condición; sin fila = sin condición (D27)
--   calificacion       lo que decide la Asistente sobre la inscripción y la versión
--   resultado_academico  nota y estado, calculados al leer (D24)
--
-- Nadie escribe directo en las tablas nuevas: solo tienen políticas de lectura.
-- Toda escritura pasa por las funciones de la sección 5, que comprueban rol,
-- grupo, estado del acta y fecha de término (D26).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Programas del catálogo (respuestas de la cliente, 1 y 2-nov-2026): el curso
-- principal va del nivel 1 al 16 para todas las edades, y el curso de niños es un
-- programa aparte. Los nombres anteriores se siguen aceptando para los niveles que
-- ya existen; la 013 mueve los de la semilla al curso principal.
-- -----------------------------------------------------------------------------
alter table public.nivel drop constraint nivel_programa_check;
alter table public.nivel add constraint nivel_programa_check check (programa in
  ('Curso principal', 'Conversation', 'Conversation Avanzada', 'Especial', 'Curso de niños',
   'Principiante', 'Beginners', 'Intermediate', 'Advanced'));
alter table public.nivel drop constraint nivel_publico_check;
alter table public.nivel add constraint nivel_publico_check check (publico in ('Todos', 'Adultos', 'Niños'));

-- -----------------------------------------------------------------------------
-- 1. Regla de aprobación (CE-20, CE-24 a CE-28)
-- -----------------------------------------------------------------------------
create table public.regla_aprobacion (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null default public.mi_organizacion() references public.organizacion(id),
  programa           text not null check (length(btrim(programa)) between 2 and 60),
  nivel_desde        smallint not null check (nivel_desde between 1 and 99),
  nivel_hasta        smallint not null check (nivel_hasta between 1 and 99),
  vigente_desde      date not null,
  nota_minima        smallint not null check (nota_minima between 0 and 100),
  condicionado_desde smallint check (condicionado_desde between 0 and 100),
  nota_condicion     smallint check (nota_condicion between 0 and 100),
  provisional        boolean not null default true,
  creado_en          timestamptz not null default now(),
  unique (organizacion_id, id),
  constraint regla_rango_niveles check (nivel_desde <= nivel_hasta),
  -- La franja de Condicionado y la nota que exige van juntas, y la franja queda
  -- por debajo de la mínima (77–79 bajo 80).
  constraint regla_franja_coherente check (
    (condicionado_desde is null) = (nota_condicion is null)
    and (condicionado_desde is null or condicionado_desde < nota_minima))
);

-- CE-26: dos reglas del mismo programa con la misma fecha de vigencia no pueden
-- cubrir el mismo nivel. Y el programa debe existir en el catálogo de niveles,
-- para que un error de escritura no deje una regla que nunca se aplica.
create function public.revisar_regla() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.nivel n
                 where n.organizacion_id = new.organizacion_id and n.programa = new.programa) then
    raise exception 'No hay niveles del programa «%» en el catálogo.', new.programa
      using errcode = 'check_violation', constraint = 'regla_programa_existe';
  end if;
  if exists (select 1 from public.regla_aprobacion r
             where r.organizacion_id = new.organizacion_id and r.id <> new.id
               and r.programa = new.programa and r.vigente_desde = new.vigente_desde
               and r.nivel_desde <= new.nivel_hasta and new.nivel_desde <= r.nivel_hasta) then
    raise exception 'Ya hay una regla de % con la misma fecha de vigencia que cubre alguno de esos niveles.', new.programa
      using errcode = 'check_violation', constraint = 'regla_superpuesta';
  end if;
  return new;
end $$;
create trigger revisar before insert or update on public.regla_aprobacion
  for each row execute function public.revisar_regla();

-- CE-27, CE-28: solo una regla provisional se corrige o se borra. Confirmarla
-- (provisional → no provisional) es una corrección más, y es la última.
create function public.proteger_regla() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not old.provisional then
    raise exception 'Esta regla ya está confirmada: no se modifica ni se borra. Para cambiarla, registre una nueva con una fecha de vigencia posterior.'
      using errcode = 'check_violation', constraint = 'regla_confirmada';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger proteger before update or delete on public.regla_aprobacion
  for each row execute function public.proteger_regla();

create trigger auditar after insert or update or delete on public.regla_aprobacion
  for each row execute function public.registrar_cambio();

-- -----------------------------------------------------------------------------
-- 2. Parciales y calificación (CE-7 a CE-10, CE-35, CE-37 a CE-40)
-- -----------------------------------------------------------------------------
create table public.parcial (
  id                        uuid primary key default gen_random_uuid(),
  organizacion_id           uuid not null default public.mi_organizacion() references public.organizacion(id),
  inscripcion_id            uuid not null,
  numero                    smallint not null check (numero between 1 and 3),
  condicion                 text not null check (condicion in ('Registrado', 'No presentado', 'Justificado', 'Reprogramado')),
  valor                     smallint,
  reprogramacion_autorizada timestamptz,                               -- CE-32
  recibo_reprogramacion     text check (length(recibo_reprogramacion) <= 40),
  unique (organizacion_id, id),
  constraint parcial_unico unique (inscripcion_id, numero),
  constraint parcial_valor_rango check (valor between 0 and 100),                           -- RN-03, CE-8
  constraint parcial_valor_segun_condicion                                                   -- CE-9, CE-10
    check ((condicion in ('Registrado', 'Reprogramado')) = (valor is not null)),
  constraint parcial_reprogramado_autorizado                                                 -- CE-35
    check (condicion <> 'Reprogramado' or reprogramacion_autorizada is not null),
  -- Sin cascada: anular una inscripción que ya tiene parciales falla (001·CE-60).
  foreign key (organizacion_id, inscripcion_id) references public.inscripcion (organizacion_id, id)
);
create index parcial_por_inscripcion on public.parcial (inscripcion_id);

create table public.calificacion (
  inscripcion_id             uuid primary key,
  organizacion_id            uuid not null default public.mi_organizacion() references public.organizacion(id),
  condicionado               boolean not null default false,                               -- CE-29
  justificacion_condicionado text check (length(justificacion_condicionado) <= 300),
  aviso_inasistencia         text check (length(aviso_inasistencia) <= 300),               -- CE-37
  aviso_inasistencia_en      timestamptz,
  baja_inasistencia          boolean not null default false,                               -- CE-39
  version                    int not null default 1,                                       -- CE-12
  constraint calificacion_justificacion
    check (not condicionado or coalesce(length(btrim(justificacion_condicionado)), 0) >= 5),
  constraint calificacion_aviso_coherente check ((aviso_inasistencia is null) = (aviso_inasistencia_en is null)),
  foreign key (organizacion_id, inscripcion_id) references public.inscripcion (organizacion_id, id)
);

create trigger auditar after insert or update or delete on public.parcial
  for each row execute function public.registrar_cambio();
-- La versión sube en cada cambio de la inscripción; ese cambio solo no se audita.
create trigger auditar_alta after insert or delete on public.calificacion
  for each row execute function public.registrar_cambio('inscripcion_id');
create trigger auditar_cambio after update on public.calificacion
  for each row
  when ((old.condicionado, old.justificacion_condicionado, old.aviso_inasistencia, old.baja_inasistencia)
        is distinct from (new.condicionado, new.justificacion_condicionado, new.aviso_inasistencia, new.baja_inasistencia))
  execute function public.registrar_cambio('inscripcion_id');

-- -----------------------------------------------------------------------------
-- 3. Ruta de un nivel (D28): el curso principal va del 1 al 16; Conversation sigue
-- con Conversation Avanzada; cada otro programa es su propia ruta.
-- -----------------------------------------------------------------------------
create function interno.ruta(p_programa text) returns text
language sql immutable
set search_path = ''
as $$ select case when p_programa in ('Conversation', 'Conversation Avanzada') then 'Conversation' else p_programa end $$;

create function interno.posicion(p_programa text, p_orden int) returns int
language sql immutable
set search_path = ''
as $$ select case when p_programa = 'Conversation Avanzada' then 100 + p_orden else p_orden end $$;

-- -----------------------------------------------------------------------------
-- 4. Resultado académico, calculado al leer (D24). security_invoker: cada quien
-- ve solo las filas que sus políticas le dejan ver.
--
-- Orden de las reglas de estado (plan §3):
--   Retirada o Trasladada → sin nota ni estado
--   baja por inasistencia → Reprobado
--   parcial sin condición o tres Justificados → Pendiente
--   sin regla → Pendiente
--   Condicionado → Condicionado
--   nota redondeada ≥ mínima → Aprobado; si no, Reprobado
-- -----------------------------------------------------------------------------
create view public.resultado_academico with (security_invoker = true) as
with base as (
  select
    i.id as inscripcion_id, i.organizacion_id, i.grupo_id, i.estudiante_id,
    i.estado_inscripcion, i.observaciones, i.fecha_inscripcion,
    g.fecha_inicio, g.fecha_termino, g.estado_acta,
    n.id as nivel_id, n.nombre as nivel, n.programa, n.orden,
    interno.ruta(n.programa) as ruta, interno.posicion(n.programa, n.orden) as posicion,
    coalesce(c.condicionado, false) as condicionado, c.justificacion_condicionado,
    c.aviso_inasistencia, c.aviso_inasistencia_en, coalesce(c.baja_inasistencia, false) as baja_inasistencia,
    coalesce(c.version, 0) as version,
    p.parciales, coalesce(p.filas, 0) as filas, coalesce(p.justificados, 0) as justificados,
    coalesce(p.considerados, 0) as considerados, coalesce(p.suma, 0) as suma, p.faltan,
    r.id as regla_id, r.nota_minima, r.condicionado_desde, r.nota_condicion,
    r.provisional as regla_provisional
  from public.inscripcion i
  join public.grupo g on g.id = i.grupo_id
  join public.nivel n on n.id = g.nivel_id
  left join public.calificacion c on c.inscripcion_id = i.id
  left join lateral (
    select
      jsonb_agg(jsonb_build_object(
        'numero', x.numero, 'condicion', x.condicion, 'valor', x.valor,
        'reprogramacion_autorizada', x.reprogramacion_autorizada, 'recibo', x.recibo_reprogramacion)
        order by x.numero) as parciales,
      count(*)::int as filas,
      count(*) filter (where x.condicion = 'Justificado')::int as justificados,
      count(*) filter (where x.condicion <> 'Justificado')::int as considerados,
      coalesce(sum(x.valor), 0)::int as suma,          -- No presentado y Justificado no tienen valor
      array(select s from generate_series(1, 3) s
            where s not in (select y.numero from public.parcial y where y.inscripcion_id = i.id)
            order by s) as faltan
    from public.parcial x where x.inscripcion_id = i.id
  ) p on true
  -- CE-20: la regla del programa y del nivel vigente en la fecha de inicio del grupo.
  left join lateral (
    select r.* from public.regla_aprobacion r
    where r.organizacion_id = i.organizacion_id and r.programa = n.programa
      and n.orden between r.nivel_desde and r.nivel_hasta
      and r.vigente_desde <= g.fecha_inicio
    order by r.vigente_desde desc
    limit 1
  ) r on true
),
calculo as (
  select b.*,
    b.estado_inscripcion in ('Retirada', 'Trasladada') as excluida,
    b.filas = 3 and b.justificados = 3 as requiere_retiro,                                    -- CE-18
    b.filas < 3 as provisional,                                                                -- CE-16
    case when b.considerados > 0 then round(b.suma::numeric / b.considerados, 2) end as nota_exacta  -- CE-14
  from base b
)
select c.*,
  case when c.excluida or c.requiere_retiro then null
       else round(c.nota_exacta)::int end as nota_final,                                       -- CE-17
  c.regla_id is null as sin_regla,                                                             -- CE-23
  case
    when c.excluida then null
    when c.baja_inasistencia then 'Reprobado'                                                  -- CE-39
    when c.provisional or c.requiere_retiro or c.nota_exacta is null then 'Pendiente'          -- CE-21
    when c.regla_id is null then 'Pendiente'                                                   -- CE-23
    when c.condicionado then 'Condicionado'                                                    -- CE-29
    when round(c.nota_exacta) >= c.nota_minima then 'Aprobado'                                 -- CE-19
    else 'Reprobado'
  end as estado_academico,
  (not c.excluida and not c.provisional and c.nota_exacta is not null
   and c.condicionado_desde is not null
   and round(c.nota_exacta) between c.condicionado_desde and c.nota_minima - 1) as en_franja    -- CE-30
from calculo c;

-- -----------------------------------------------------------------------------
-- RLS: solo lectura (D26).
-- -----------------------------------------------------------------------------
alter table public.regla_aprobacion enable row level security;
alter table public.parcial          enable row level security;
alter table public.calificacion     enable row level security;

create policy leer on public.regla_aprobacion for select to authenticated
  using (organizacion_id = (select public.mi_organizacion()) and (select public.acceso_habilitado()));

-- CE-58, CE-59: Asistente y Dirección ven todo; el Profesor, lo de sus grupos.
do $$
declare t text;
begin
  foreach t in array array['parcial', 'calificacion'] loop
    execute format($p$
      create policy leer on public.%1$I for select to authenticated
        using (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and ((select public.tiene_rol('asistente'))
                    or (select public.tiene_rol('direccion'))
                    or ((select public.tiene_rol('profesor')) and exists (
                          select 1 from public.inscripcion i join public.grupo g on g.id = i.grupo_id
                          where i.id = inscripcion_id and g.profesor_id = (select public.mi_profesor_id())))));
    $p$, t);
  end loop;
end $$;

-- Por si el proyecto volviera a exponer las tablas nuevas automáticamente: se
-- quita todo y se da solo la lectura.
revoke all on public.regla_aprobacion, public.parcial, public.calificacion, public.resultado_academico
  from anon, authenticated, service_role;
grant select on public.regla_aprobacion, public.parcial, public.calificacion, public.resultado_academico to authenticated;

-- =============================================================================
-- 5. Operaciones (plan §4). Todas SECURITY DEFINER: leen y escriben sin pasar
-- por RLS, así que cada una comprueba a mano la organización, la puerta de
-- acceso y el rol. «No existe» responde PT404 (001·CE-101).
-- =============================================================================

create function interno.exigir_acceso() returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not public.acceso_habilitado() then
    raise exception 'Sin acceso.' using errcode = 'insufficient_privilege';
  end if;
end $$;

create function interno.es_profesor_del_grupo(p_grupo uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select public.tiene_rol('profesor') and exists (
    select 1 from public.grupo g where g.id = p_grupo and g.profesor_id = public.mi_profesor_id())
$$;

-- La inscripción y su grupo, solo si son de la organización de quien llama.
create function interno.contexto(p_inscripcion uuid,
  out grupo_id uuid, out estado_acta text, out fecha_termino date, out estado_inscripcion text)
language plpgsql stable
set search_path = ''
as $$
begin
  select g.id, g.estado_acta, g.fecha_termino, i.estado_inscripcion
    into grupo_id, estado_acta, fecha_termino, estado_inscripcion
  from public.inscripcion i join public.grupo g on g.id = i.grupo_id
  where i.id = p_inscripcion and i.organizacion_id = public.mi_organizacion();
  if grupo_id is null then
    raise exception 'La inscripción no existe.' using errcode = 'PT404';
  end if;
end $$;

-- CE-12: cada cambio de una inscripción sube su versión.
create function interno.tocar(p_inscripcion uuid) returns int
language sql volatile
set search_path = ''
as $$
  insert into public.calificacion (inscripcion_id, organizacion_id)
  values (p_inscripcion, (select organizacion_id from public.inscripcion where id = p_inscripcion))
  on conflict (inscripcion_id) do update set version = public.calificacion.version + 1
  returning version
$$;

create function interno.resultado(p_inscripcion uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'inscripcion_id', r.inscripcion_id, 'version', r.version, 'parciales', coalesce(r.parciales, '[]'::jsonb),
    'faltan', to_jsonb(r.faltan), 'nota_exacta', r.nota_exacta, 'nota_final', r.nota_final,
    'provisional', r.provisional, 'requiere_retiro', r.requiere_retiro, 'estado', r.estado_academico,
    'sin_regla', r.sin_regla, 'regla_provisional', r.regla_provisional, 'nota_minima', r.nota_minima,
    'condicionado_desde', r.condicionado_desde, 'en_franja', r.en_franja,
    'condicionado', r.condicionado, 'justificacion_condicionado', r.justificacion_condicionado,
    'aviso_inasistencia', r.aviso_inasistencia, 'baja_inasistencia', r.baja_inasistencia,
    'estado_inscripcion', r.estado_inscripcion, 'observaciones', r.observaciones)
  from public.resultado_academico r where r.inscripcion_id = p_inscripcion
$$;

-- -----------------------------------------------------------------------------
-- Regla de aprobación (CE-25 a CE-28). p_datos: id (para corregir), programa,
-- nivel_desde, nivel_hasta, vigente_desde, nota_minima, condicionado_desde,
-- nota_condicion, provisional.
-- -----------------------------------------------------------------------------
create function public.guardar_regla(p_datos jsonb) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_id uuid := nullif(p_datos ->> 'id', '')::uuid; v_org uuid := public.mi_organizacion();
begin
  perform interno.exigir_asistente();
  if v_id is null then
    insert into public.regla_aprobacion (organizacion_id, programa, nivel_desde, nivel_hasta, vigente_desde,
      nota_minima, condicionado_desde, nota_condicion, provisional)
    values (v_org, btrim(p_datos ->> 'programa'), (p_datos ->> 'nivel_desde')::smallint, (p_datos ->> 'nivel_hasta')::smallint,
      (p_datos ->> 'vigente_desde')::date, (p_datos ->> 'nota_minima')::smallint,
      nullif(p_datos ->> 'condicionado_desde', '')::smallint, nullif(p_datos ->> 'nota_condicion', '')::smallint,
      coalesce((p_datos ->> 'provisional')::boolean, true))
    returning id into v_id;
    return jsonb_build_object('estado', 'creada', 'id', v_id);
  end if;
  update public.regla_aprobacion set
    programa = btrim(p_datos ->> 'programa'), nivel_desde = (p_datos ->> 'nivel_desde')::smallint,
    nivel_hasta = (p_datos ->> 'nivel_hasta')::smallint, vigente_desde = (p_datos ->> 'vigente_desde')::date,
    nota_minima = (p_datos ->> 'nota_minima')::smallint,
    condicionado_desde = nullif(p_datos ->> 'condicionado_desde', '')::smallint,
    nota_condicion = nullif(p_datos ->> 'nota_condicion', '')::smallint,
    provisional = coalesce((p_datos ->> 'provisional')::boolean, true)
  where id = v_id and organizacion_id = v_org;
  if not found then raise exception 'La regla no existe.' using errcode = 'PT404'; end if;
  return jsonb_build_object('estado', 'corregida', 'id', v_id);
end $$;

create function public.eliminar_regla(p_id uuid) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform interno.exigir_asistente();
  delete from public.regla_aprobacion where id = p_id and organizacion_id = public.mi_organizacion();
  if not found then raise exception 'La regla no existe.' using errcode = 'PT404'; end if;
end $$;

-- -----------------------------------------------------------------------------
-- CE-1 a CE-3: los grupos del profesor, con el avance de su acta.
-- -----------------------------------------------------------------------------
create function public.mis_grupos() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform interno.exigir_acceso();
  if not public.tiene_rol('profesor') then
    raise exception 'Solo un profesor tiene grupos asignados.' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'codigo_grupo', g.codigo_grupo, 'nivel', n.nombre, 'modalidad', m.nombre,
      'dias_de_clase', m.dias_de_clase, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin,
      'sucursal', s.nombre, 'fecha_inicio', g.fecha_inicio, 'fecha_termino', g.fecha_termino,
      'estado_acta', g.estado_acta,
      'completas', (select count(*) from public.inscripcion i
                    where i.grupo_id = g.id and i.estado_inscripcion not in ('Retirada', 'Trasladada')
                      and (select count(*) from public.parcial p where p.inscripcion_id = i.id) = 3),
      'total', (select count(*) from public.inscripcion i
                where i.grupo_id = g.id and i.estado_inscripcion not in ('Retirada', 'Trasladada')))
      order by g.fecha_inicio desc, g.codigo_grupo)
    from public.grupo g
    join public.nivel n on n.id = g.nivel_id
    join public.horario h on h.id = g.horario_id
    join public.modalidad m on m.id = h.modalidad_id
    join public.sucursal s on s.id = g.sucursal_id
    where g.organizacion_id = public.mi_organizacion() and g.profesor_id = public.mi_profesor_id()
  ), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- CE-4 a CE-6, CE-42, CE-58 (D29): el acta completa. De cada estudiante solo
-- nombres, apellidos y código (CE-5). Si quien pide no tiene acceso al grupo,
-- registra la denegación y responde "denegado" sin error, para que el registro
-- no se deshaga (igual que buscar_estudiantes en la 001).
-- -----------------------------------------------------------------------------
create function public.acta_del_grupo(p_grupo uuid) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_g record;
  v_asistente boolean := public.tiene_rol('asistente');
  v_direccion boolean := public.tiene_rol('direccion');
  v_profesor  boolean;
  v_filas jsonb;
begin
  perform interno.exigir_acceso();
  select g.*, n.nombre as nivel, n.programa, n.orden, m.nombre as modalidad, m.dias_de_clase,
         h.hora_inicio, h.hora_fin, s.nombre as sucursal, s.direccion as sucursal_direccion,
         p.nombres || ' ' || p.apellidos as profesor
    into v_g
  from public.grupo g
  join public.nivel n on n.id = g.nivel_id
  join public.horario h on h.id = g.horario_id
  join public.modalidad m on m.id = h.modalidad_id
  join public.sucursal s on s.id = g.sucursal_id
  join public.profesor p on p.id = g.profesor_id
  where g.id = p_grupo and g.organizacion_id = public.mi_organizacion();
  if not found then raise exception 'El grupo no existe.' using errcode = 'PT404'; end if;

  v_profesor := interno.es_profesor_del_grupo(p_grupo);
  if not (v_asistente or v_direccion or v_profesor) then
    perform public.registrar_evento('Denegación', 'acta', p_grupo::text, 'Acta de un grupo no asignado');   -- CE-4
    return jsonb_build_object('estado', 'denegado');
  end if;

  select coalesce(jsonb_agg(interno.resultado(i.id) || jsonb_build_object(
           'codigo_adei', e.codigo_adei, 'nombres', e.nombres, 'apellidos', e.apellidos)
         order by public.normalizar(e.apellidos), public.normalizar(e.nombres)), '[]'::jsonb)
    into v_filas
  from public.inscripcion i join public.estudiante e on e.id = i.estudiante_id
  where i.grupo_id = p_grupo;

  return jsonb_build_object(
    'estado', 'ok',
    'grupo', jsonb_build_object(
      'id', v_g.id, 'codigo_grupo', v_g.codigo_grupo, 'nivel', v_g.nivel, 'programa', v_g.programa,
      'orden', v_g.orden, 'modalidad', v_g.modalidad, 'dias_de_clase', v_g.dias_de_clase,
      'hora_inicio', v_g.hora_inicio, 'hora_fin', v_g.hora_fin, 'sucursal', v_g.sucursal,
      'sucursal_direccion', v_g.sucursal_direccion, 'profesor', v_g.profesor,
      'fecha_inicio', v_g.fecha_inicio, 'fecha_termino', v_g.fecha_termino,
      'estado_acta', v_g.estado_acta, 'fecha_entrega_acta', v_g.fecha_entrega_acta),
    'permisos', jsonb_build_object(
      'capturar', v_profesor and v_g.estado_acta = 'Abierta',
      'entregar', v_profesor and v_g.estado_acta = 'Abierta',
      'asistente', v_asistente,
      'modificar_entregada', v_asistente and v_g.estado_acta = 'Entregada',
      'reprogramar', v_asistente and v_g.fecha_termino >= public.hoy_managua()),
    'filas', v_filas,
    'resumen', interno.resumen_acta(p_grupo));
end $$;

-- CE-42: inscritos, aprobados, reprobados, pendientes, retirados, trasladados y promedio.
create function interno.resumen_acta(p_grupo uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'inscritos',     count(*),
    'aprobados',     count(*) filter (where estado_academico = 'Aprobado'),
    'reprobados',    count(*) filter (where estado_academico = 'Reprobado'),
    'condicionados', count(*) filter (where estado_academico = 'Condicionado'),
    'pendientes',    count(*) filter (where estado_academico = 'Pendiente'),
    'retirados',     count(*) filter (where estado_inscripcion = 'Retirada'),
    'trasladados',   count(*) filter (where estado_inscripcion = 'Trasladada'),
    'promedio',      round(avg(nota_final) filter (where nota_final is not null), 2))
  from public.resultado_academico where grupo_id = p_grupo
$$;

-- -----------------------------------------------------------------------------
-- CE-7 a CE-13, CE-34 a CE-36, CE-47 a CE-49: guardar los parciales de una
-- inscripción. p_parciales: [{numero, condicion, valor}]; condición vacía = sin
-- condición. El profesor del grupo, con el acta Abierta; la Asistente, con el acta
-- Entregada y un motivo. Si otra sesión cambió la inscripción, responde
-- "conflicto" y no escribe (CE-12).
-- -----------------------------------------------------------------------------
create function public.guardar_parciales(p_inscripcion uuid, p_parciales jsonb, p_version int, p_motivo text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_ctx record; v_actual int; v_p jsonb; v_num int; v_cond text; v_valor int; v_fila public.parcial;
  v_es_asistente_entregada boolean;
begin
  perform interno.exigir_acceso();
  select * into v_ctx from interno.contexto(p_inscripcion);

  v_es_asistente_entregada := v_ctx.estado_acta = 'Entregada' and public.tiene_rol('asistente');
  if v_es_asistente_entregada then
    perform interno.anotar_motivo(interno.exigir_motivo(p_motivo));                                -- CE-48
  elsif not interno.es_profesor_del_grupo(v_ctx.grupo_id) then
    raise exception 'Solo el profesor del grupo registra sus parciales.' using errcode = 'insufficient_privilege';
  elsif v_ctx.estado_acta <> 'Abierta' then
    raise exception 'El acta ya fue entregada: solo la Asistente de Dirección puede modificarla.'   -- CE-47
      using errcode = 'insufficient_privilege';
  end if;
  if v_ctx.estado_inscripcion in ('Retirada', 'Trasladada') then
    raise exception 'La inscripción está %: no lleva parciales.', v_ctx.estado_inscripcion using errcode = 'check_violation';  -- CE-13
  end if;
  if not v_es_asistente_entregada
     and exists (select 1 from public.calificacion where inscripcion_id = p_inscripcion and baja_inasistencia) then
    raise exception 'La Asistente registró una baja por inasistencia: los parciales ya no se modifican.' using errcode = 'check_violation';
  end if;

  select coalesce(max(version), 0) into v_actual from public.calificacion where inscripcion_id = p_inscripcion;
  if v_actual <> coalesce(p_version, 0) then
    return jsonb_build_object('estado', 'conflicto', 'resultado', interno.resultado(p_inscripcion));   -- CE-12
  end if;

  for v_p in select * from jsonb_array_elements(coalesce(p_parciales, '[]'::jsonb)) loop
    v_num := (v_p ->> 'numero')::int;
    v_cond := nullif(btrim(v_p ->> 'condicion'), '');
    if v_num is null or v_num not between 1 and 3 then
      raise exception 'El número de parcial debe ser 1, 2 o 3.' using errcode = 'check_violation';
    end if;
    select * into v_fila from public.parcial where inscripcion_id = p_inscripcion and numero = v_num;

    if v_cond is null then                                                     -- sin condición: se borra la fila
      if v_fila.reprogramacion_autorizada is not null then
        raise exception 'El parcial % tiene una reprogramación autorizada: indique su condición.', v_num using errcode = 'check_violation';
      end if;
      delete from public.parcial where inscripcion_id = p_inscripcion and numero = v_num;
      continue;
    end if;

    if v_cond not in ('Registrado', 'No presentado', 'Justificado', 'Reprogramado') then
      -- Antes de tocar la tabla: el error de su restricción devolvería la fila entera.
      raise exception 'La condición del parcial % no es válida.', v_num using errcode = 'check_violation';
    end if;
    v_valor := null;
    if v_cond in ('Registrado', 'Reprogramado') then
      -- RN-03, CE-8: un entero entre 0 y 100; "85.5", "abc" o 769 se rechazan.
      if jsonb_typeof(v_p -> 'valor') is distinct from 'number'
         or (v_p ->> 'valor') !~ '^\d{1,3}$' or (v_p ->> 'valor')::int > 100 then
        raise exception 'El parcial % debe ser un número entero entre 0 y 100.', v_num
          using errcode = 'check_violation', constraint = 'parcial_valor_rango';
      end if;
      v_valor := (v_p ->> 'valor')::int;
    elsif v_p ? 'valor' and jsonb_typeof(v_p -> 'valor') <> 'null' then                           -- CE-10
      raise exception 'Un parcial % no lleva nota.', lower(v_cond) using errcode = 'check_violation',
        constraint = 'parcial_valor_segun_condicion';
    end if;
    if v_cond = 'Reprogramado' and v_fila.reprogramacion_autorizada is null then                   -- CE-35
      raise exception 'El parcial % no tiene una reprogramación autorizada por la Asistente.', v_num
        using errcode = 'check_violation', constraint = 'parcial_reprogramado_autorizado';
    end if;

    insert into public.parcial (organizacion_id, inscripcion_id, numero, condicion, valor,
                                reprogramacion_autorizada, recibo_reprogramacion)
    values (public.mi_organizacion(), p_inscripcion, v_num, v_cond, v_valor,
            v_fila.reprogramacion_autorizada, v_fila.recibo_reprogramacion)
    on conflict (inscripcion_id, numero) do update set condicion = excluded.condicion, valor = excluded.valor;
  end loop;

  perform interno.tocar(p_inscripcion);
  return jsonb_build_object('estado', 'guardado', 'resultado', interno.resultado(p_inscripcion));
end $$;

-- -----------------------------------------------------------------------------
-- CE-32, CE-33: la Asistente autoriza reprogramar un parcial No presentado,
-- mientras no pase la fecha de término del grupo.
-- -----------------------------------------------------------------------------
create function public.autorizar_reprogramacion(p_inscripcion uuid, p_numero int, p_recibo text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_ctx record;
begin
  perform interno.exigir_asistente();
  select * into v_ctx from interno.contexto(p_inscripcion);
  if v_ctx.fecha_termino < public.hoy_managua() then
    raise exception 'El nivel ya terminó: no se pueden autorizar reprogramaciones.' using errcode = 'check_violation';
  end if;
  update public.parcial
     set reprogramacion_autorizada = now(), recibo_reprogramacion = nullif(btrim(p_recibo), '')
   where inscripcion_id = p_inscripcion and numero = p_numero and condicion = 'No presentado';
  if not found then
    raise exception 'Solo se reprograma un parcial marcado como No presentado.' using errcode = 'check_violation';
  end if;
  perform interno.tocar(p_inscripcion);
  return jsonb_build_object('estado', 'autorizada', 'resultado', interno.resultado(p_inscripcion));
end $$;

-- -----------------------------------------------------------------------------
-- CE-37: el profesor avisa que un estudiante dejó de asistir; decide la Asistente.
-- -----------------------------------------------------------------------------
create function public.avisar_inasistencia(p_inscripcion uuid, p_observacion text) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_ctx record; v_obs text;
begin
  perform interno.exigir_acceso();
  select * into v_ctx from interno.contexto(p_inscripcion);
  if not interno.es_profesor_del_grupo(v_ctx.grupo_id) then
    raise exception 'Solo el profesor del grupo puede avisar una inasistencia.' using errcode = 'insufficient_privilege';
  end if;
  if v_ctx.estado_acta <> 'Abierta' then
    raise exception 'El acta ya fue entregada.' using errcode = 'insufficient_privilege';
  end if;
  if v_ctx.estado_inscripcion <> 'En curso' then
    raise exception 'La inscripción ya no está En curso.' using errcode = 'check_violation';
  end if;
  v_obs := left(interno.exigir_motivo(p_observacion), 300);
  perform interno.tocar(p_inscripcion);
  update public.calificacion set aviso_inasistencia = v_obs, aviso_inasistencia_en = now()
   where inscripcion_id = p_inscripcion;
  return jsonb_build_object('estado', 'avisado', 'resultado', interno.resultado(p_inscripcion));
end $$;

-- -----------------------------------------------------------------------------
-- CE-38 a CE-41: la Asistente decide retiro, baja por inasistencia o traslado.
-- Con parciales que ya tienen nota, primero advierte (CE-41). «continua» descarta
-- un aviso de inasistencia cuando el estudiante volvió (CE-37: la decisión es suya).
-- -----------------------------------------------------------------------------
create function public.decidir_salida(p_inscripcion uuid, p_decision text, p_motivo text, p_confirmar boolean default false)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_ctx record; v_motivo text; v_con_nota int;
begin
  perform interno.exigir_asistente();
  select * into v_ctx from interno.contexto(p_inscripcion);
  if v_ctx.estado_acta <> 'Abierta' then
    raise exception 'El acta ya fue entregada: no se cambia la situación de la inscripción.' using errcode = 'check_violation';
  end if;
  if v_ctx.estado_inscripcion <> 'En curso' then
    raise exception 'La inscripción ya no está En curso.' using errcode = 'check_violation';
  end if;
  if p_decision is null or p_decision not in ('retiro', 'baja', 'traslado', 'continua') then
    raise exception 'La decisión debe ser retiro, baja, traslado o continua.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.calificacion where inscripcion_id = p_inscripcion and baja_inasistencia) then
    raise exception 'Ya se registró una baja por inasistencia.' using errcode = 'check_violation';
  end if;
  v_motivo := left(interno.exigir_motivo(p_motivo), 300);

  if p_decision in ('retiro', 'traslado') and not coalesce(p_confirmar, false) then
    select count(*) into v_con_nota from public.parcial
     where inscripcion_id = p_inscripcion and valor is not null;
    if v_con_nota > 0 then
      return jsonb_build_object('estado', 'advertir', 'parciales_con_nota', v_con_nota);              -- CE-41
    end if;
  end if;

  perform interno.anotar_motivo(v_motivo);
  perform interno.tocar(p_inscripcion);
  case p_decision
    when 'retiro', 'traslado' then                                                                 -- CE-38, CE-40
      update public.inscripcion
         set estado_inscripcion = case p_decision when 'retiro' then 'Retirada' else 'Trasladada' end,
             observaciones = v_motivo
       where id = p_inscripcion;
    when 'baja' then
      -- CE-39 (y clarificación C1): los parciales que faltan quedan No presentado.
      insert into public.parcial (organizacion_id, inscripcion_id, numero, condicion)
      select public.mi_organizacion(), p_inscripcion, s, 'No presentado' from generate_series(1, 3) s
      where not exists (select 1 from public.parcial where inscripcion_id = p_inscripcion and numero = s);
      update public.calificacion set baja_inasistencia = true where inscripcion_id = p_inscripcion;
    else
      update public.calificacion set aviso_inasistencia = null, aviso_inasistencia_en = null
       where inscripcion_id = p_inscripcion;
  end case;
  return jsonb_build_object('estado', 'decidido', 'resultado', interno.resultado(p_inscripcion));
end $$;

-- -----------------------------------------------------------------------------
-- CE-29 a CE-31: Condicionado, solo dentro de la franja de la regla.
-- -----------------------------------------------------------------------------
create function public.condicionar(p_inscripcion uuid, p_justificacion text) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_r record; v_just text;
begin
  perform interno.exigir_asistente();
  perform interno.contexto(p_inscripcion);
  v_just := left(interno.exigir_motivo(p_justificacion), 300);
  select * into v_r from public.resultado_academico where inscripcion_id = p_inscripcion;
  if not coalesce(v_r.en_franja, false) then
    raise exception '%', case
      when v_r.condicionado_desde is null then 'La regla aplicable no tiene franja de Condicionado.'
      else format('Solo se condiciona una nota final entre %s y %s.', v_r.condicionado_desde, v_r.nota_minima - 1) end
      using errcode = 'check_violation', constraint = 'condicionado_en_franja';
  end if;
  perform interno.tocar(p_inscripcion);
  update public.calificacion set condicionado = true, justificacion_condicionado = v_just
   where inscripcion_id = p_inscripcion;
  return jsonb_build_object('estado', 'condicionado', 'resultado', interno.resultado(p_inscripcion));
end $$;

create function public.quitar_condicionado(p_inscripcion uuid, p_motivo text) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform interno.exigir_asistente();
  perform interno.contexto(p_inscripcion);
  perform interno.anotar_motivo(interno.exigir_motivo(p_motivo));
  perform interno.tocar(p_inscripcion);
  update public.calificacion set condicionado = false, justificacion_condicionado = null
   where inscripcion_id = p_inscripcion;
  return jsonb_build_object('estado', 'sin_condicionado', 'resultado', interno.resultado(p_inscripcion));
end $$;

-- -----------------------------------------------------------------------------
-- CE-42 a CE-46: entregar el acta. Sin confirmar, devuelve el resumen o lo que
-- falta; confirmada, entrega todo en esta transacción o nada (CE-46).
-- -----------------------------------------------------------------------------
create function public.entregar_acta(p_grupo uuid, p_confirmar boolean default false) returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_estado text; v_faltan jsonb; v_fecha timestamptz;
begin
  perform interno.exigir_acceso();
  select estado_acta into v_estado from public.grupo
   where id = p_grupo and organizacion_id = public.mi_organizacion();
  if v_estado is null then raise exception 'El grupo no existe.' using errcode = 'PT404'; end if;
  if not interno.es_profesor_del_grupo(p_grupo) then
    raise exception 'Solo el profesor del grupo entrega su acta.' using errcode = 'insufficient_privilege';
  end if;
  if v_estado <> 'Abierta' then
    raise exception 'El acta ya fue entregada.' using errcode = 'check_violation';
  end if;

  -- CE-44: sin ninguna calificación, eso es lo que se dice (antes que listar todo como faltante).
  if not exists (select 1 from public.parcial p join public.inscripcion i on i.id = p.inscripcion_id
                 where i.grupo_id = p_grupo) then
    return jsonb_build_object('estado', 'sin_calificaciones');
  end if;
  -- CE-43: parciales sin condición, avisos sin decidir o tres Justificados.
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo_adei', e.codigo_adei, 'nombres', e.nombres, 'apellidos', e.apellidos,
           'faltan', to_jsonb(r.faltan),
           'aviso_sin_decidir', r.aviso_inasistencia is not null and not r.baja_inasistencia,
           'requiere_retiro', r.requiere_retiro)
         order by public.normalizar(e.apellidos), public.normalizar(e.nombres)), '[]'::jsonb)
    into v_faltan
  from public.resultado_academico r join public.estudiante e on e.id = r.estudiante_id
  where r.grupo_id = p_grupo and r.estado_inscripcion = 'En curso'
    and (r.provisional or r.requiere_retiro or (r.aviso_inasistencia is not null and not r.baja_inasistencia));
  if jsonb_array_length(v_faltan) > 0 then
    return jsonb_build_object('estado', 'incompleta', 'faltan', v_faltan);
  end if;
  if not coalesce(p_confirmar, false) then
    return jsonb_build_object('estado', 'resumen', 'resumen', interno.resumen_acta(p_grupo));
  end if;

  v_fecha := now();
  update public.grupo set estado_acta = 'Entregada', fecha_entrega_acta = v_fecha where id = p_grupo;   -- CE-45
  update public.inscripcion set estado_inscripcion = 'Completada'
   where grupo_id = p_grupo and estado_inscripcion = 'En curso';
  return jsonb_build_object('estado', 'entregada', 'fecha_entrega_acta', v_fecha,
                            'resumen', interno.resumen_acta(p_grupo));
end $$;

-- -----------------------------------------------------------------------------
-- 001·CE-58 a CE-60: anular una inscripción. Con parciales, no se puede; si solo
-- tiene un aviso de inasistencia, el aviso se va con ella. Pasa a SECURITY DEFINER
-- porque borra en calificacion, que nadie escribe directo (D26); por eso filtra
-- a mano por la organización de quien llama.
-- -----------------------------------------------------------------------------
drop function public.anular_inscripcion(uuid, text);
create function public.anular_inscripcion(p_inscripcion uuid, p_motivo text) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_motivo text; v_estado text;
begin
  perform interno.exigir_asistente();
  v_motivo := interno.exigir_motivo(p_motivo);
  select g.estado_acta into v_estado
  from public.inscripcion i join public.grupo g on g.id = i.grupo_id
  where i.id = p_inscripcion and i.organizacion_id = public.mi_organizacion();
  if v_estado is null then raise exception 'La inscripción no existe.' using errcode = 'PT404'; end if;
  if v_estado <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no se puede anular la inscripción.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.parcial where inscripcion_id = p_inscripcion) then              -- 001·CE-60
    raise exception 'Esta inscripción ya tiene parciales registrados: no se puede anular.' using errcode = 'check_violation';
  end if;
  perform interno.anotar_motivo(v_motivo);
  delete from public.calificacion where inscripcion_id = p_inscripcion;
  delete from public.inscripcion where id = p_inscripcion;
end $$;

-- -----------------------------------------------------------------------------
-- CE-54 a CE-56: antecedentes al inscribir. Devuelve los que aplican al grupo.
--   · reprobado: el último resultado del estudiante en la misma ruta es Reprobado
--     y el grupo nuevo está en una posición superior (CE-54);
--   · condición no cumplida: un Condicionado en la posición p cuyo resultado
--     siguiente en la ruta, en p + 1, no alcanzó la nota exigida; se advierte si el
--     grupo nuevo está por encima de p − 1, dos niveles bajo p + 1 (CE-55).
-- Corre con los permisos de quien llama (lo llama inscribir, de la Asistente).
-- -----------------------------------------------------------------------------
create function interno.antecedentes(p_estudiante uuid, p_grupo uuid) returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare v_destino record; v_ultimo record; v_res jsonb := '[]'::jsonb; v_c record;
begin
  select interno.ruta(n.programa) as ruta, interno.posicion(n.programa, n.orden) as posicion
    into v_destino
  from public.grupo g join public.nivel n on n.id = g.nivel_id where g.id = p_grupo;

  select r.*, gg.codigo_grupo into v_ultimo
  from public.resultado_academico r join public.grupo gg on gg.id = r.grupo_id
  where r.estudiante_id = p_estudiante and r.ruta = v_destino.ruta
    and r.estado_academico in ('Aprobado', 'Reprobado', 'Condicionado')
  order by r.fecha_inicio desc, r.fecha_inscripcion desc
  limit 1;
  if v_ultimo.estado_academico = 'Reprobado' and v_destino.posicion > v_ultimo.posicion then
    v_res := v_res || jsonb_build_object('tipo', 'reprobado', 'codigo_grupo', v_ultimo.codigo_grupo,
                                         'nivel', v_ultimo.nivel, 'nota_final', v_ultimo.nota_final);
  end if;

  for v_c in
    select c.posicion, c.nivel, c.nota_condicion, s.nota_final as nota_siguiente, s.nivel as nivel_siguiente
    from public.resultado_academico c
    join lateral (
      select x.* from public.resultado_academico x
      where x.estudiante_id = c.estudiante_id and x.ruta = c.ruta and x.posicion = c.posicion + 1
        and x.fecha_inicio > c.fecha_inicio and x.nota_final is not null and not x.provisional
      order by x.fecha_inicio limit 1) s on true
    where c.estudiante_id = p_estudiante and c.ruta = v_destino.ruta and c.estado_academico = 'Condicionado'
      and s.nota_final < c.nota_condicion
    order by c.fecha_inicio desc limit 1
  loop
    if v_destino.posicion > v_c.posicion - 1 then
      v_res := v_res || jsonb_build_object('tipo', 'condicion_no_cumplida', 'nivel', v_c.nivel,
                                           'nivel_siguiente', v_c.nivel_siguiente,
                                           'nota_siguiente', v_c.nota_siguiente, 'nota_exigida', v_c.nota_condicion);
    end if;
  end loop;
  return v_res;
end $$;

-- 001·CE-54 a CE-57, CE-84, CE-93 y ahora CE-54 a CE-56 de la 002.
-- Respuestas: inscrito | ya_inscrito | antecedente | superposicion
drop function public.inscribir(uuid, uuid, boolean);
create function public.inscribir(p_estudiante uuid, p_grupo uuid, p_confirmar boolean default false, p_motivo text default null)
returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare v_grupo record; v_choques jsonb; v_antecedentes jsonb; v_id uuid; v_notas text[] := '{}';
begin
  perform interno.exigir_asistente();

  select g.estado_acta, g.fecha_inicio, g.fecha_termino, h.modalidad_id, h.hora_inicio, h.hora_fin
    into v_grupo
  from public.grupo g join public.horario h on h.id = g.horario_id where g.id = p_grupo;
  if v_grupo is null then raise exception 'El grupo no existe.' using errcode = 'PT404'; end if;

  if not exists (select 1 from public.estudiante where id = p_estudiante and estado_matricula = 'Activo') then
    raise exception 'Solo se puede inscribir a un estudiante en estado Activo.' using errcode = 'check_violation';  -- 001·CE-55
  end if;
  if v_grupo.estado_acta <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no admite inscripciones.' using errcode = 'check_violation'; -- 001·CE-57
  end if;
  if v_grupo.fecha_termino < public.hoy_managua() then
    raise exception 'Este grupo ya terminó: no admite inscripciones.' using errcode = 'check_violation';  -- 001·CE-93
  end if;
  if exists (select 1 from public.inscripcion where estudiante_id = p_estudiante and grupo_id = p_grupo) then
    return jsonb_build_object('estado', 'ya_inscrito');                                                    -- 001·CE-56
  end if;

  -- CE-54, CE-55: antecedentes; se inscribe solo con un motivo.
  v_antecedentes := interno.antecedentes(p_estudiante, p_grupo);
  if jsonb_array_length(v_antecedentes) > 0 then
    if p_motivo is null or length(btrim(p_motivo)) < 5 then
      return jsonb_build_object('estado', 'antecedente', 'antecedentes', v_antecedentes);
    end if;
    v_notas := v_notas || ('Inscrito pese a antecedente: ' || btrim(p_motivo));
  end if;

  -- 001·CE-84: la misma regla que dominio/superposicion.ts.
  select coalesce(jsonb_agg(jsonb_build_object('grupo_id', g.id, 'codigo_grupo', g.codigo_grupo)), '[]'::jsonb)
    into v_choques
  from public.inscripcion i
  join public.grupo g on g.id = i.grupo_id
  join public.horario h on h.id = g.horario_id
  where i.estudiante_id = p_estudiante and i.estado_inscripcion = 'En curso'
    and h.modalidad_id = v_grupo.modalidad_id
    and g.fecha_inicio <= v_grupo.fecha_termino and v_grupo.fecha_inicio <= g.fecha_termino
    and h.hora_inicio < v_grupo.hora_fin and v_grupo.hora_inicio < h.hora_fin;
  if jsonb_array_length(v_choques) > 0 and not p_confirmar then
    return jsonb_build_object('estado', 'superposicion', 'grupos', v_choques);
  end if;
  if jsonb_array_length(v_choques) > 0 then
    v_notas := v_notas || ('Inscrito pese a superposición con: ' ||
      (select string_agg(c ->> 'codigo_grupo', ', ') from jsonb_array_elements(v_choques) c));
  end if;
  if array_length(v_notas, 1) > 0 then
    perform interno.anotar_motivo(array_to_string(v_notas, ' · '));
  end if;

  insert into public.inscripcion (estudiante_id, grupo_id) values (p_estudiante, p_grupo) returning id into v_id;
  return jsonb_build_object('estado', 'inscrito', 'id', v_id);
end $$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución. Las auxiliares de interno que usa una función que corre
-- con los permisos de quien llama (inscribir) necesitan el permiso; las demás las
-- llaman funciones SECURITY DEFINER.
-- -----------------------------------------------------------------------------
grant execute on function
  public.guardar_regla(jsonb), public.eliminar_regla(uuid), public.mis_grupos(),
  public.acta_del_grupo(uuid), public.guardar_parciales(uuid, jsonb, int, text),
  public.autorizar_reprogramacion(uuid, int, text), public.avisar_inasistencia(uuid, text),
  public.decidir_salida(uuid, text, text, boolean), public.condicionar(uuid, text),
  public.quitar_condicionado(uuid, text), public.entregar_acta(uuid, boolean),
  public.anular_inscripcion(uuid, text), public.inscribir(uuid, uuid, boolean, text)
  to authenticated;
grant execute on function interno.antecedentes(uuid, uuid), interno.ruta(text), interno.posicion(text, int)
  to authenticated;

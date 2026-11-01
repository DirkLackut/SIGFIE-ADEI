-- =============================================================================
-- 006 · Grupos e inscripciones
-- Spec 001: CE-47 a CE-60, CE-84, CE-91 a CE-93, CE-95, CE-97 · RN-06 a RN-09
--
-- El grupo NO guarda la modalidad: la deduce del horario, que pertenece a una sola
-- modalidad (decisión D10). Un grupo con un horario de otra modalidad no se puede
-- representar.
-- =============================================================================

create table public.grupo (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null default public.mi_organizacion() references public.organizacion(id),
  codigo_grupo       text not null constraint grupo_codigo_formato check (codigo_grupo ~ '^G-\d{4}-\d{4}$'),
  nivel_id           uuid not null,
  horario_id         uuid not null,
  profesor_id        uuid not null,
  sucursal_id        uuid not null,
  fecha_inicio       date not null,
  fecha_termino      date not null,
  estado_acta        text not null default 'Abierta' check (estado_acta in ('Abierta', 'Entregada')),
  fecha_entrega_acta timestamptz,
  unique (organizacion_id, id),
  constraint grupo_codigo_unico unique (organizacion_id, codigo_grupo),
  constraint grupo_termino_despues_de_inicio check (fecha_termino > fecha_inicio),        -- CE-50, RN-08
  constraint grupo_entrega_coherente check ((estado_acta = 'Entregada') = (fecha_entrega_acta is not null)),
  -- RN-06: exactamente un nivel, un horario, un profesor y una sucursal; de su organización (CE-97).
  foreign key (organizacion_id, nivel_id)    references public.nivel    (organizacion_id, id),
  foreign key (organizacion_id, horario_id)  references public.horario  (organizacion_id, id),
  foreign key (organizacion_id, profesor_id) references public.profesor (organizacion_id, id),
  foreign key (organizacion_id, sucursal_id) references public.sucursal (organizacion_id, id)
);
create index grupo_por_profesor on public.grupo (profesor_id);   -- RLS del profesor (007)

create table public.inscripcion (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null default public.mi_organizacion() references public.organizacion(id),
  estudiante_id      uuid not null,
  grupo_id           uuid not null,
  fecha_inscripcion  date not null default public.hoy_managua(),                          -- CE-54, CE-77
  estado_inscripcion text not null default 'En curso'
                     check (estado_inscripcion in ('En curso', 'Completada', 'Retirada', 'Trasladada')),
  observaciones      text check (length(observaciones) <= 300),
  unique (organizacion_id, id),
  constraint inscripcion_unica unique (estudiante_id, grupo_id),                          -- CE-56, RN-09
  constraint inscripcion_observacion_obligatoria
    -- coalesce: con observaciones NULL, length(NULL) > 0 da NULL, y un CHECK que da
    -- NULL se acepta. Sin el coalesce, una Retirada sin observación pasaba.
    check (estado_inscripcion not in ('Retirada', 'Trasladada') or coalesce(length(btrim(observaciones)), 0) > 0),
  foreign key (organizacion_id, estudiante_id) references public.estudiante (organizacion_id, id),
  foreign key (organizacion_id, grupo_id)      references public.grupo      (organizacion_id, id)
);
create index inscripcion_por_grupo on public.inscripcion (grupo_id);

create trigger auditar after insert or update or delete on public.grupo       for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.inscripcion for each row execute function public.registrar_cambio();

-- Las reglas de negocio de abrir, cambiar profesor, inscribir y anular (acta
-- Abierta, valores activos, fechas, motivo) viven en las funciones de 008. Las
-- tablas solo garantizan lo que nunca puede ser falso.
grant select, insert, update on public.grupo to authenticated;
grant select, insert, update, delete on public.inscripcion to authenticated;

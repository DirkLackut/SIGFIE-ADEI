-- =============================================================================
-- 004 · Auditoría (bitácora inalterable)
-- Spec 001: CE-17 a CE-20, CE-59, CE-68 · RF-15, RN-15 · Plan §8
--
-- Tipos de acción: los cinco del diccionario de datos (Consulta, Creación,
-- Modificación, Acceso, Denegación) más "Eliminación", que hace falta para anular
-- una inscripción hecha por error (P6). Se anota en el impacto al documento.
-- =============================================================================

create table public.auditoria (
  id                bigint generated always as identity primary key,
  organizacion_id   uuid references public.organizacion(id),   -- nula: ingreso fallido de un usuario inexistente
  fecha_hora        timestamptz not null default now(),
  usuario_id        uuid,                                        -- nulo: acción sin sesión
  tipo_accion       text not null check (tipo_accion in
                      ('Consulta', 'Creación', 'Modificación', 'Eliminación', 'Acceso', 'Denegación')),
  entidad           text not null check (length(entidad) <= 40),
  registro_afectado text check (length(registro_afectado) <= 120),
  valor_anterior    jsonb,
  valor_nuevo       jsonb,
  detalle           text check (length(detalle) <= 1000)
);
create index auditoria_por_organizacion on public.auditoria (organizacion_id, fecha_hora desc);

-- -----------------------------------------------------------------------------
-- Inalterable (RN-15, CE-19): nadie la modifica ni la borra. Dos candados:
-- 1. ningún rol de la API tiene permiso de UPDATE, DELETE ni TRUNCATE;
-- 2. un trigger lo rechaza incluso para el dueño de la tabla.
-- -----------------------------------------------------------------------------
create function public.auditoria_inalterable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La auditoría es inalterable: sus registros no se modifican ni se eliminan.'
    using errcode = 'insufficient_privilege';
end $$;

create trigger auditoria_sin_cambios before update or delete on public.auditoria
  for each row execute function public.auditoria_inalterable();
create trigger auditoria_sin_vaciar before truncate on public.auditoria
  for each statement execute function public.auditoria_inalterable();

revoke all on public.auditoria from anon, authenticated, service_role;
grant select on public.auditoria to authenticated;   -- qué filas: lo decide RLS en 007 (solo Dirección)

-- -----------------------------------------------------------------------------
-- Trigger genérico para cada tabla de datos (CE-17). Corre en la MISMA
-- transacción que el cambio: si no se puede registrar, el cambio no se aplica
-- (CE-20). Usa to_jsonb para no depender de los campos de cada tabla.
--
-- Argumentos opcionales: las columnas que identifican la fila, si no es "id"
-- (por ejemplo usuario_rol se identifica por usuario_id y rol).
--
-- El motivo de una acción (cambiar profesor, anular una inscripción) llega por
-- set_config('sigfie.motivo', …, true), que vive solo durante la transacción.
-- -----------------------------------------------------------------------------
create function public.registrar_cambio() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ant  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_nue  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila jsonb := coalesce(v_nue, v_ant);
  v_id   text;
  v_org  uuid;
begin
  if tg_op = 'UPDATE' and v_ant = v_nue then return null; end if;  -- nada cambió

  if tg_nargs = 0 then
    v_id := v_fila ->> 'id';
  else
    select string_agg(v_fila ->> a, ':') into v_id from unnest(tg_argv) a;
  end if;

  v_org := coalesce((v_fila ->> 'organizacion_id')::uuid,
                    case when tg_table_name = 'organizacion' then (v_fila ->> 'id')::uuid end);

  insert into public.auditoria
    (organizacion_id, usuario_id, tipo_accion, entidad, registro_afectado, valor_anterior, valor_nuevo, detalle)
  values
    (v_org, auth.uid(),
     case tg_op when 'INSERT' then 'Creación' when 'UPDATE' then 'Modificación' else 'Eliminación' end,
     tg_table_name, v_id, v_ant, v_nue,
     nullif(current_setting('sigfie.motivo', true), ''));
  return null;
end $$;

create trigger auditar after insert or update or delete on public.organizacion for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.sucursal     for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.modalidad    for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.horario      for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.nivel        for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.profesor     for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.usuario      for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.usuario_rol  for each row execute function public.registrar_cambio('usuario_id', 'rol');

-- -----------------------------------------------------------------------------
-- Eventos que no cambian tablas (CE-18): un ingreso, una consulta.
-- El usuario y su organización salen del token: nadie registra a nombre de otro.
-- -----------------------------------------------------------------------------
create function public.registrar_evento(p_tipo text, p_entidad text, p_registro text default null, p_detalle text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Solo un usuario con sesión puede registrar eventos.' using errcode = 'insufficient_privilege';
  end if;
  -- Denegación: la registra el propio sistema cuando le niega algo al usuario (CE-46).
  -- Queda siempre a nombre de quien llama, así que nadie puede culpar a otro.
  if p_tipo not in ('Acceso', 'Consulta', 'Denegación') then
    raise exception 'Tipo de evento no permitido: %', p_tipo using errcode = 'invalid_parameter_value';
  end if;
  insert into public.auditoria (organizacion_id, usuario_id, tipo_accion, entidad, registro_afectado, detalle)
  values (public.mi_organizacion(), auth.uid(), p_tipo, p_entidad, p_registro, p_detalle);
end $$;
grant execute on function public.registrar_evento(text, text, text, text) to authenticated;

-- Ingreso denegado (CE-3, CE-18): ocurre SIN sesión, así que lo registra el
-- servidor con la clave de servicio. Si el nombre de usuario existe, queda
-- asociado a su cuenta y a su organización; si no, queda sin organización.
create function public.registrar_ingreso_denegado(p_nombre_usuario text, p_detalle text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_usuario uuid; v_org uuid;
begin
  select u.id, u.organizacion_id into v_usuario, v_org
  from public.usuario u where u.nombre_usuario = lower(btrim(p_nombre_usuario));
  insert into public.auditoria (organizacion_id, usuario_id, tipo_accion, entidad, registro_afectado, detalle)
  values (v_org, v_usuario, 'Denegación', 'ingreso', left(lower(btrim(p_nombre_usuario)), 120), p_detalle);
end $$;
grant execute on function public.registrar_ingreso_denegado(text, text) to service_role;

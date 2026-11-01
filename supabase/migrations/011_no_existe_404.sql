-- =============================================================================
-- 011 · «No existe» responde 404, no 500
-- Spec 001: CE-101 · Plan D22 · Hallazgo de las pruebas de seguridad (T34, A10)
--
-- Cinco funciones avisaban «X no existe» con el código no_data_found (P0002).
-- PostgREST no conoce ese código y lo devolvía como 500 (error del servidor),
-- aunque el problema fuera del pedido: por ejemplo, una Asistente de otra
-- organización que pide inscribir en un grupo que para ella no existe.
-- Con el código PT404, PostgREST responde 404. El mensaje no cambia, y la app
-- traduce los errores por el mensaje y la restricción, no por el código.
--
-- Solo reemplaza funciones (create or replace): no toca tablas ni datos, y los
-- permisos (grant execute) se conservan.
-- =============================================================================

-- Igual que en 008_*.sql; solo cambia el código del error «no existe».
create or replace function public.actualizar_estudiante(p_id uuid, p_version int, p_datos jsonb)
returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare
  v_campos text[] := array['cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'telefono', 'correo',
                           'direccion', 'contacto_emergencia', 'sucursal_id'];
  v_extra  text[];
  v_cedula text := nullif(upper(btrim(p_datos ->> 'cedula')), '');
  v_otro   record;
  v_fila   public.estudiante;
  v_avisos text[] := '{}';
begin
  perform interno.exigir_asistente();

  select array_agg(k) into v_extra from jsonb_object_keys(p_datos) k where k <> all (v_campos);
  if v_extra is not null then
    raise exception 'Estos datos no se pueden modificar: %', array_to_string(v_extra, ', ')
      using errcode = 'insufficient_privilege';
  end if;

  if p_datos ? 'cedula' and v_cedula is not null then
    select e.id, e.codigo_adei, e.nombres, e.apellidos into v_otro from public.estudiante e
    where e.organizacion_id = public.mi_organizacion() and e.cedula = v_cedula and e.id <> p_id;
    if found then
      return jsonb_build_object('estado', 'cedula_existente', 'expediente', to_jsonb(v_otro));
    end if;
  end if;

  update public.estudiante e set
    cedula              = case when p_datos ? 'cedula' then v_cedula else e.cedula end,
    nombres             = case when p_datos ? 'nombres' then regexp_replace(btrim(p_datos ->> 'nombres'), '\s+', ' ', 'g') else e.nombres end,
    apellidos           = case when p_datos ? 'apellidos' then regexp_replace(btrim(p_datos ->> 'apellidos'), '\s+', ' ', 'g') else e.apellidos end,
    fecha_nacimiento    = case when p_datos ? 'fecha_nacimiento' then (p_datos ->> 'fecha_nacimiento')::date else e.fecha_nacimiento end,
    telefono            = case when p_datos ? 'telefono' then nullif(btrim(p_datos ->> 'telefono'), '') else e.telefono end,
    correo              = case when p_datos ? 'correo' then nullif(lower(btrim(p_datos ->> 'correo')), '') else e.correo end,
    direccion           = case when p_datos ? 'direccion' then nullif(btrim(p_datos ->> 'direccion'), '') else e.direccion end,
    contacto_emergencia = case when p_datos ? 'contacto_emergencia' then nullif(btrim(p_datos ->> 'contacto_emergencia'), '') else e.contacto_emergencia end,
    sucursal_id         = case when p_datos ? 'sucursal_id' then (p_datos ->> 'sucursal_id')::uuid else e.sucursal_id end
  where e.id = p_id and e.version = p_version
  returning * into v_fila;

  if not found then
    -- O cambió mientras tanto (CE-86), o no existe / no es visible para quien llama.
    if exists (select 1 from public.estudiante where id = p_id) then
      return jsonb_build_object('estado', 'conflicto');
    end if;
    raise exception 'El estudiante no existe.' using errcode = 'PT404';
  end if;

  -- CE-80: un adulto sin teléfono se advierte, no se bloquea.
  if public.edad(v_fila.fecha_nacimiento, public.hoy_managua()) >= 18 and v_fila.telefono is null then
    v_avisos := array_append(v_avisos, 'telefono_faltante');
  end if;
  return jsonb_build_object('estado', 'actualizado', 'version', v_fila.version, 'advertencias', to_jsonb(v_avisos));
end $$;

-- Igual que en 008_*.sql; solo cambia el código del error «no existe».
create or replace function public.cambiar_profesor(p_grupo uuid, p_profesor uuid, p_motivo text) returns void
language plpgsql volatile
set search_path = ''
as $$
declare v_motivo text; v_estado text;
begin
  perform interno.exigir_asistente();
  v_motivo := interno.exigir_motivo(p_motivo);
  select estado_acta into v_estado from public.grupo where id = p_grupo;
  if v_estado is null then raise exception 'El grupo no existe.' using errcode = 'PT404'; end if;
  if v_estado <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no se puede cambiar el profesor.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profesor where id = p_profesor and activo) then
    raise exception 'El profesor nuevo debe estar activo.' using errcode = 'check_violation';
  end if;
  perform interno.anotar_motivo(v_motivo);
  update public.grupo set profesor_id = p_profesor where id = p_grupo;
end $$;

-- Igual que en 008_*.sql; solo cambia el código del error «no existe».
create or replace function public.inscribir(p_estudiante uuid, p_grupo uuid, p_confirmar boolean default false) returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare v_grupo record; v_choques jsonb; v_id uuid;
begin
  perform interno.exigir_asistente();

  select g.estado_acta, g.fecha_inicio, g.fecha_termino, h.modalidad_id, h.hora_inicio, h.hora_fin
    into v_grupo
  from public.grupo g join public.horario h on h.id = g.horario_id where g.id = p_grupo;
  if v_grupo is null then raise exception 'El grupo no existe.' using errcode = 'PT404'; end if;

  if not exists (select 1 from public.estudiante where id = p_estudiante and estado_matricula = 'Activo') then
    raise exception 'Solo se puede inscribir a un estudiante en estado Activo.' using errcode = 'check_violation';  -- CE-55
  end if;
  if v_grupo.estado_acta <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no admite inscripciones.' using errcode = 'check_violation'; -- CE-57
  end if;
  if v_grupo.fecha_termino < public.hoy_managua() then
    raise exception 'Este grupo ya terminó: no admite inscripciones.' using errcode = 'check_violation';  -- CE-93
  end if;
  if exists (select 1 from public.inscripcion where estudiante_id = p_estudiante and grupo_id = p_grupo) then
    return jsonb_build_object('estado', 'ya_inscrito');                                                    -- CE-56
  end if;

  -- CE-84: la misma regla que dominio/superposicion.ts. Misma modalidad, fechas
  -- que comparten un día (rango cerrado) y horas que se pisan (semiabierto).
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
    perform interno.anotar_motivo('Inscrito pese a superposición con: ' ||
      (select string_agg(c ->> 'codigo_grupo', ', ') from jsonb_array_elements(v_choques) c));
  end if;

  insert into public.inscripcion (estudiante_id, grupo_id) values (p_estudiante, p_grupo) returning id into v_id;
  return jsonb_build_object('estado', 'inscrito', 'id', v_id);
end $$;

-- Igual que en 008_*.sql; solo cambia el código del error «no existe».
create or replace function public.anular_inscripcion(p_inscripcion uuid, p_motivo text) returns void
language plpgsql volatile
set search_path = ''
as $$
declare v_motivo text; v_estado text;
begin
  perform interno.exigir_asistente();
  v_motivo := interno.exigir_motivo(p_motivo);
  select g.estado_acta into v_estado
  from public.inscripcion i join public.grupo g on g.id = i.grupo_id where i.id = p_inscripcion;
  if v_estado is null then raise exception 'La inscripción no existe.' using errcode = 'PT404'; end if;
  if v_estado <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no se puede anular la inscripción.' using errcode = 'check_violation';
  end if;
  perform interno.anotar_motivo(v_motivo);
  delete from public.inscripcion where id = p_inscripcion;
end $$;

-- Igual que en 010_*.sql; solo cambia el código del error «no existe».
create or replace function public.asignar_roles(p_usuario uuid, p_roles public.rol[], p_profesor uuid)
returns void
language plpgsql volatile
set search_path = ''
as $$
begin
  perform interno.exigir_asistente();
  if coalesce(array_length(p_roles, 1), 0) = 0 then
    raise exception 'Elija al menos un rol.' using errcode = 'check_violation';
  end if;
  update public.usuario set profesor_id = case when 'profesor' = any (p_roles) then p_profesor end where id = p_usuario;
  if not found then raise exception 'La cuenta no existe.' using errcode = 'PT404'; end if;
  -- Primero se agregan y después se quitan: si la Asistente se quitara su propio
  -- rol primero, RLS ya no la dejaría agregar los otros.
  insert into public.usuario_rol (organizacion_id, usuario_id, rol)
  select public.mi_organizacion(), p_usuario, r from unnest(p_roles) r
  on conflict do nothing;
  delete from public.usuario_rol where usuario_id = p_usuario and rol <> all (p_roles);
end $$;

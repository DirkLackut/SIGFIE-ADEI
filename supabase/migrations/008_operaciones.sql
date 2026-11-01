-- =============================================================================
-- 008 · Operaciones de negocio
-- Spec 001: CE-16, CE-18, CE-29 a CE-60, CE-79 a CE-86, CE-91 a CE-93 · Plan §6, §7
--
-- Cada operación con más de un paso es UNA función: corre en una sola
-- transacción, así que no queda nada a medias. Son SECURITY INVOKER: se ejecutan
-- con los permisos de quien llama y RLS sigue aplicando (plan §6). Validan además
-- el rol de forma explícita, para responder un mensaje claro en vez de un
-- "permiso denegado".
--
-- Las respuestas son jsonb con un campo "estado". Lo que la Asistente debe
-- DECIDIR (coincidencias, superposición) se responde como estado, no como error:
-- la función solo inserta si se la vuelve a llamar confirmando.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Códigos asignados por la base (CE-29, CE-48, CE-99). Una persona con sesión no
-- puede elegir el código: si lo manda, se rechaza. La migración del acervo (spec
-- posterior) entra con la clave de servicio y sí conserva el año de origen.
-- -----------------------------------------------------------------------------
create function public.asignar_codigo() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_anio int := extract(year from public.hoy_managua())::int; v_n int; v_prefijo text;
begin
  if tg_table_name = 'estudiante' then
    if new.codigo_adei is not null then
      if coalesce(auth.role(), '') = 'authenticated' then
        raise exception 'El código ADEI lo asigna el sistema.' using errcode = 'insufficient_privilege';
      end if;
      return new;
    end if;
    select o.codigo into v_prefijo from public.organizacion o where o.id = new.organizacion_id;
    v_n := public.siguiente_correlativo(new.organizacion_id, 'estudiante', v_anio);
    if v_n > 99999 then raise exception 'Se agotaron los códigos de estudiante del año %.', v_anio; end if;
    new.codigo_adei := v_prefijo || '-' || v_anio || '-' || lpad(v_n::text, 5, '0');
  else
    if new.codigo_grupo is not null then
      if coalesce(auth.role(), '') = 'authenticated' then
        raise exception 'El código de grupo lo asigna el sistema.' using errcode = 'insufficient_privilege';
      end if;
      return new;
    end if;
    v_n := public.siguiente_correlativo(new.organizacion_id, 'grupo', v_anio);
    if v_n > 9999 then raise exception 'Se agotaron los códigos de grupo del año %.', v_anio; end if;
    new.codigo_grupo := 'G-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  end if;
  return new;
end $$;

-- El nombre empieza con "a" para correr antes del trigger "validar" (orden alfabético).
create trigger asignar_codigo before insert on public.estudiante for each row execute function public.asignar_codigo();
create trigger asignar_codigo before insert on public.grupo      for each row execute function public.asignar_codigo();

-- -----------------------------------------------------------------------------
-- Auxiliares en el esquema "interno": las operaciones las llaman con los permisos
-- de quien llama, así que el usuario necesita poder ejecutarlas; pero Supabase
-- solo publica en la API el esquema "public", así que nadie puede llamarlas
-- directamente desde fuera. Superficie de la API = solo las operaciones.
-- -----------------------------------------------------------------------------
create schema interno;
grant usage on schema interno to authenticated;
alter default privileges in schema interno revoke execute on functions from anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Comprobación común: la operación la hace una Asistente con acceso habilitado.
-- -----------------------------------------------------------------------------
create function interno.exigir_asistente() returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not (public.acceso_habilitado() and public.tiene_rol('asistente')) then
    raise exception 'Solo la Asistente de Dirección puede hacer esta operación.'
      using errcode = 'insufficient_privilege';
  end if;
end $$;

create function interno.exigir_motivo(p_motivo text) returns text
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_motivo is null or length(btrim(p_motivo)) < 5 then
    raise exception 'Hay que indicar el motivo (al menos 5 caracteres).' using errcode = 'check_violation';
  end if;
  return btrim(p_motivo);
end $$;

-- Deja el motivo para el trigger de auditoría, solo durante esta transacción.
create function interno.anotar_motivo(p_motivo text) returns void
language sql volatile
set search_path = ''
as $$ select set_config('sigfie.motivo', p_motivo, true) $$;

-- Escapa los comodines de LIKE en lo que escribe el usuario: sin esto, buscar
-- "%" devolvería a todos los estudiantes y "_" funcionaría como comodín.
create function interno.escapar_like(p text) returns text
language sql immutable strict
set search_path = ''
as $$ select replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_') $$;

-- =============================================================================
-- T12 · Estudiantes y tutores
-- =============================================================================

-- Estudiantes que parecen la misma persona: mismo nombre completo y fecha de
-- nacimiento, sin distinguir mayúsculas ni tildes (CE-31, CE-79).
create function interno.candidatos_mismo_estudiante(p_nombres text, p_apellidos text, p_nacimiento date, p_solo_sin_cedula boolean)
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'codigo_adei', e.codigo_adei, 'nombres', e.nombres, 'apellidos', e.apellidos,
           'cedula', e.cedula, 'fecha_nacimiento', e.fecha_nacimiento) order by e.codigo_adei), '[]'::jsonb)
  from public.estudiante e
  where e.organizacion_id = public.mi_organizacion()
    and public.normalizar(e.nombres) = public.normalizar(p_nombres)
    and public.normalizar(e.apellidos) = public.normalizar(p_apellidos)
    and e.fecha_nacimiento = p_nacimiento
    and (not p_solo_sin_cedula or e.cedula is null)
$$;

-- Vincula un tutor: el existente si se indica su id o si ya hay uno con esa
-- cédula (CE-38: un tutor, un registro); si no, lo crea.
create function public.vincular_tutor(p_estudiante uuid, p_tutor jsonb) returns uuid
language plpgsql volatile
set search_path = ''
as $$
declare v_tutor uuid; v_cedula text := upper(btrim(p_tutor ->> 'cedula'));
begin
  perform interno.exigir_asistente();
  if p_tutor ? 'id' then
    v_tutor := (p_tutor ->> 'id')::uuid;
  else
    select t.id into v_tutor from public.tutor t
    where t.organizacion_id = public.mi_organizacion() and t.cedula = v_cedula;
    if v_tutor is null then
      insert into public.tutor (nombre_completo, cedula, telefono)
      values (regexp_replace(btrim(p_tutor ->> 'nombre_completo'), '\s+', ' ', 'g'), v_cedula, btrim(p_tutor ->> 'telefono'))
      returning id into v_tutor;
    end if;
  end if;
  insert into public.estudiante_tutor (estudiante_id, tutor_id) values (p_estudiante, v_tutor)
  on conflict do nothing;
  return v_tutor;
end $$;

-- CE-82: desvincular. Si era el único tutor de un menor, el trigger diferido de
-- 005 lo rechaza al final de la transacción.
create function public.desvincular_tutor(p_estudiante uuid, p_tutor uuid) returns void
language plpgsql volatile
set search_path = ''
as $$
begin
  perform interno.exigir_asistente();
  delete from public.estudiante_tutor where estudiante_id = p_estudiante and tutor_id = p_tutor;
end $$;

-- RF-01, CE-29 a CE-38, CE-79.
-- p_datos: cedula, nombres, apellidos, fecha_nacimiento, telefono, correo,
--          direccion, contacto_emergencia, sucursal_id, tutores[]
-- Respuestas: registrado | cedula_existente | coincidencias | completar
create function public.registrar_estudiante(p_datos jsonb, p_confirmar_distinto boolean default false)
returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare
  v_cedula    text := nullif(upper(btrim(p_datos ->> 'cedula')), '');     -- CE-76
  v_nombres   text := regexp_replace(btrim(p_datos ->> 'nombres'),   '\s+', ' ', 'g');
  v_apellidos text := regexp_replace(btrim(p_datos ->> 'apellidos'), '\s+', ' ', 'g');
  v_nac       date := (p_datos ->> 'fecha_nacimiento')::date;
  v_existente record;
  v_cand      jsonb;
  v_id        uuid;
  v_codigo    text;
  v_tutor     jsonb;
begin
  perform interno.exigir_asistente();

  if v_cedula is not null then
    -- CE-30: la cédula ya pertenece a otro estudiante → se muestra su expediente.
    select e.id, e.codigo_adei, e.nombres, e.apellidos into v_existente
    from public.estudiante e where e.organizacion_id = public.mi_organizacion() and e.cedula = v_cedula;
    if found then
      return jsonb_build_object('estado', 'cedula_existente', 'expediente', to_jsonb(v_existente));
    end if;
    -- CE-79: la misma persona registrada antes sin cédula → completar su expediente.
    v_cand := interno.candidatos_mismo_estudiante(v_nombres, v_apellidos, v_nac, true);
    if jsonb_array_length(v_cand) > 0 and not p_confirmar_distinto then
      return jsonb_build_object('estado', 'completar', 'candidatos', v_cand);
    end if;
  else
    -- CE-31: sin cédula, se busca por nombre completo y fecha de nacimiento.
    v_cand := interno.candidatos_mismo_estudiante(v_nombres, v_apellidos, v_nac, false);
    if jsonb_array_length(v_cand) > 0 and not p_confirmar_distinto then
      return jsonb_build_object('estado', 'coincidencias', 'candidatos', v_cand);
    end if;
  end if;

  -- CE-32: la decisión de que es otra persona queda en la auditoría.
  if p_confirmar_distinto and jsonb_array_length(coalesce(v_cand, '[]')) > 0 then
    perform interno.anotar_motivo('Confirmado como persona distinta de: ' ||
      (select string_agg(c ->> 'codigo_adei', ', ') from jsonb_array_elements(v_cand) c));
  end if;

  begin
    insert into public.estudiante
      (cedula, nombres, apellidos, fecha_nacimiento, telefono, correo, direccion, contacto_emergencia, sucursal_id)
    values
      (v_cedula, v_nombres, v_apellidos, v_nac,
       nullif(btrim(p_datos ->> 'telefono'), ''), nullif(lower(btrim(p_datos ->> 'correo')), ''),
       nullif(btrim(p_datos ->> 'direccion'), ''), nullif(btrim(p_datos ->> 'contacto_emergencia'), ''),
       (p_datos ->> 'sucursal_id')::uuid)
    returning id, codigo_adei into v_id, v_codigo;
  exception when unique_violation then
    -- Dos registros simultáneos con la misma cédula (spec, casos límite): el
    -- segundo choca con el índice único y recibe la misma respuesta que CE-30.
    select e.id, e.codigo_adei, e.nombres, e.apellidos into v_existente
    from public.estudiante e where e.organizacion_id = public.mi_organizacion() and e.cedula = v_cedula;
    if v_existente.id is null then raise; end if;
    return jsonb_build_object('estado', 'cedula_existente', 'expediente', to_jsonb(v_existente));
  end;

  perform interno.anotar_motivo('');
  for v_tutor in select * from jsonb_array_elements(coalesce(p_datos -> 'tutores', '[]'::jsonb)) loop
    perform public.vincular_tutor(v_id, v_tutor);
  end loop;

  return jsonb_build_object('estado', 'registrado', 'id', v_id, 'codigo_adei', v_codigo);
end $$;

-- RF-12, CE-40, CE-41, CE-80, CE-81, CE-86.
-- Solo cambia los campos que vienen en p_datos. El código ADEI no está entre
-- ellos (y el trigger de 005 lo rechazaría igual).
-- p_version: la versión que la Asistente tenía en pantalla. Si otra sesión lo
-- cambió mientras tanto, no se sobrescribe (CE-86).
-- Respuestas: actualizado | conflicto | cedula_existente
create function public.actualizar_estudiante(p_id uuid, p_version int, p_datos jsonb)
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
    raise exception 'El estudiante no existe.' using errcode = 'no_data_found';
  end if;

  -- CE-80: un adulto sin teléfono se advierte, no se bloquea.
  if public.edad(v_fila.fecha_nacimiento, public.hoy_managua()) >= 18 and v_fila.telefono is null then
    v_avisos := array_append(v_avisos, 'telefono_faltante');
  end if;
  return jsonb_build_object('estado', 'actualizado', 'version', v_fila.version, 'advertencias', to_jsonb(v_avisos));
end $$;

-- =============================================================================
-- T13 · Grupos e inscripciones
-- =============================================================================

-- CE-47 a CE-50, CE-91, CE-92. p_datos: nivel_id, modalidad_id, horario_id,
-- profesor_id, sucursal_id, fecha_inicio, fecha_termino.
create function public.abrir_grupo(p_datos jsonb) returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare
  v_horario public.horario;
  v_termino date := (p_datos ->> 'fecha_termino')::date;
  v_id uuid; v_codigo text;
begin
  perform interno.exigir_asistente();

  select * into v_horario from public.horario where id = (p_datos ->> 'horario_id')::uuid;
  -- CE-49: el horario debe ser de la modalidad elegida.
  if v_horario.id is null or v_horario.modalidad_id <> (p_datos ->> 'modalidad_id')::uuid then
    raise exception 'El horario elegido no pertenece a la modalidad elegida.' using errcode = 'check_violation';
  end if;
  -- CE-47: nivel, horario y profesor activos (y la modalidad).
  if not v_horario.activo
     or not exists (select 1 from public.modalidad where id = v_horario.modalidad_id and activo)
     or not exists (select 1 from public.nivel where id = (p_datos ->> 'nivel_id')::uuid and activo)
     or not exists (select 1 from public.profesor where id = (p_datos ->> 'profesor_id')::uuid and activo) then
    raise exception 'El nivel, la modalidad, el horario y el profesor deben estar activos.' using errcode = 'check_violation';
  end if;
  -- CE-92: no se abre un grupo que ya terminó. Uno ya iniciado, sí (CE-91).
  if v_termino < public.hoy_managua() then
    raise exception 'No se puede abrir un grupo cuya fecha de término ya pasó.' using errcode = 'check_violation';
  end if;

  insert into public.grupo (nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino)
  values ((p_datos ->> 'nivel_id')::uuid, v_horario.id, (p_datos ->> 'profesor_id')::uuid,
          (p_datos ->> 'sucursal_id')::uuid, (p_datos ->> 'fecha_inicio')::date, v_termino)
  returning id, codigo_grupo into v_id, v_codigo;
  return jsonb_build_object('estado', 'abierto', 'id', v_id, 'codigo_grupo', v_codigo);
end $$;

-- CE-51 a CE-53.
create function public.cambiar_profesor(p_grupo uuid, p_profesor uuid, p_motivo text) returns void
language plpgsql volatile
set search_path = ''
as $$
declare v_motivo text; v_estado text;
begin
  perform interno.exigir_asistente();
  v_motivo := interno.exigir_motivo(p_motivo);
  select estado_acta into v_estado from public.grupo where id = p_grupo;
  if v_estado is null then raise exception 'El grupo no existe.' using errcode = 'no_data_found'; end if;
  if v_estado <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no se puede cambiar el profesor.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profesor where id = p_profesor and activo) then
    raise exception 'El profesor nuevo debe estar activo.' using errcode = 'check_violation';
  end if;
  perform interno.anotar_motivo(v_motivo);
  update public.grupo set profesor_id = p_profesor where id = p_grupo;
end $$;

-- CE-54 a CE-57, CE-84, CE-93. Respuestas: inscrito | ya_inscrito | superposicion
create function public.inscribir(p_estudiante uuid, p_grupo uuid, p_confirmar boolean default false) returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare v_grupo record; v_choques jsonb; v_id uuid;
begin
  perform interno.exigir_asistente();

  select g.estado_acta, g.fecha_inicio, g.fecha_termino, h.modalidad_id, h.hora_inicio, h.hora_fin
    into v_grupo
  from public.grupo g join public.horario h on h.id = g.horario_id where g.id = p_grupo;
  if v_grupo is null then raise exception 'El grupo no existe.' using errcode = 'no_data_found'; end if;

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

-- CE-58 a CE-60. Cuando exista la tabla de parciales (spec 002), su llave
-- foránea impedirá anular una inscripción que ya tenga notas (CE-60).
create function public.anular_inscripcion(p_inscripcion uuid, p_motivo text) returns void
language plpgsql volatile
set search_path = ''
as $$
declare v_motivo text; v_estado text;
begin
  perform interno.exigir_asistente();
  v_motivo := interno.exigir_motivo(p_motivo);
  select g.estado_acta into v_estado
  from public.inscripcion i join public.grupo g on g.id = i.grupo_id where i.id = p_inscripcion;
  if v_estado is null then raise exception 'La inscripción no existe.' using errcode = 'no_data_found'; end if;
  if v_estado <> 'Abierta' then
    raise exception 'El acta de este grupo ya fue entregada: no se puede anular la inscripción.' using errcode = 'check_violation';
  end if;
  perform interno.anotar_motivo(v_motivo);
  delete from public.inscripcion where id = p_inscripcion;
end $$;

-- =============================================================================
-- T14 · Búsqueda y aviso
-- =============================================================================

-- Por qué hay un paso previo: con RLS activa, PostgreSQL evalúa primero las
-- políticas y solo después los filtros del usuario que no son "leakproof", como
-- LIKE. Eso le impide usar el índice de trigramas y lo obliga a recorrer la tabla
-- entera (CE-45). Esta función hace solo la parte que necesita el índice: corre
-- con los permisos del dueño de la tabla, repite a mano los mismos filtros que la
-- política (organización, acceso, rol) y devuelve únicamente ids. Las filas se leen
-- después, en buscar_estudiantes, CON RLS.
create function interno.estudiantes_que_coinciden(p_q text, p_q_sin text) returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select e.id from public.estudiante e
  where e.organizacion_id = public.mi_organizacion()
    and public.acceso_habilitado()
    and (public.tiene_rol('asistente') or public.tiene_rol('direccion'))
    and (e.busqueda like '%' || p_q || '%' or e.busqueda like '%' || p_q_sin || '%')
$$;

-- CE-42 a CE-46, CE-85, CE-18.
-- Respuestas: ok | texto_corto | denegado
-- Si se le niega a alguien, DEVUELVE "denegado" en vez de lanzar un error: un
-- error desharía la transacción, y con ella el registro de la denegación (plan §6).
create function public.buscar_estudiantes(p_texto text, p_pagina int default 1) returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare
  c_por_pagina constant int := 50;
  v_texto  text := btrim(coalesce(p_texto, ''));
  v_q      text;
  v_q_sin  text;
  v_pagina int := greatest(coalesce(p_pagina, 1), 1);
  v_total  int := 0;
  v_filas  jsonb;
begin
  if not public.acceso_habilitado() then
    raise exception 'Sin acceso.' using errcode = 'insufficient_privilege';
  end if;
  if not (public.tiene_rol('asistente') or public.tiene_rol('direccion')) then
    perform public.registrar_evento('Denegación', 'busqueda_estudiantes', null, left(v_texto, 200));  -- CE-46
    return jsonb_build_object('estado', 'denegado');
  end if;
  if length(v_texto) < 3 then
    return jsonb_build_object('estado', 'texto_corto', 'minimo', 3);                                 -- CE-43
  end if;

  v_q     := interno.escapar_like(public.normalizar(v_texto));
  v_q_sin := interno.escapar_like(replace(public.normalizar(v_texto), '-', ''));   -- cédula sin guiones (CE-42)

  -- Total y página en UNA consulta con count(*) over(): salen del mismo instante,
  -- no pueden no coincidir (CE-85, principio 6).
  select coalesce(max(total), 0),
         coalesce(jsonb_agg(fila order by orden) filter (where fila is not null), '[]'::jsonb)
    into v_total, v_filas
  from (
    select count(*) over () as total,
           row_number() over (order by e.apellidos, e.nombres, e.codigo_adei) as orden,
           jsonb_build_object('id', e.id, 'codigo_adei', e.codigo_adei, 'nombres', e.nombres,
                              'apellidos', e.apellidos, 'cedula', e.cedula,
                              'estado_matricula', e.estado_matricula, 'sucursal', s.nombre) as fila
    from public.estudiante e join public.sucursal s on s.id = e.sucursal_id
    where e.id in (select interno.estudiantes_que_coinciden(v_q, v_q_sin))
  ) r
  where r.orden > (v_pagina - 1) * c_por_pagina and r.orden <= v_pagina * c_por_pagina
     or r.orden is null;

  -- Si la página pedida está más allá de la última, el filtro dejó cero filas y
  -- con ellas el total: se cuenta aparte, siempre sobre el mismo criterio.
  if v_total = 0 and v_pagina > 1 then
    select count(*) into v_total from public.estudiante e
    where e.id in (select interno.estudiantes_que_coinciden(v_q, v_q_sin));
  end if;

  perform public.registrar_evento('Consulta', 'busqueda_estudiantes', null, left(v_texto, 200));     -- CE-18
  return jsonb_build_object('estado', 'ok', 'total', v_total, 'pagina', v_pagina,
                            'por_pagina', c_por_pagina, 'resultados', v_filas);
end $$;

-- CE-16. SECURITY DEFINER porque nadie inserta directo en aceptacion_privacidad;
-- el usuario, la organización y la sesión salen del token, no de los parámetros.
create function public.aceptar_aviso(p_version text) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_org uuid := public.mi_organizacion(); v_sesion uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null or v_sesion is null or v_org is null then
    raise exception 'Hace falta una sesión iniciada.' using errcode = 'insufficient_privilege';
  end if;
  if p_version is distinct from public.aviso_vigente(v_org) then
    raise exception 'Esa no es la versión vigente del aviso.' using errcode = 'check_violation';
  end if;
  insert into public.aceptacion_privacidad (organizacion_id, usuario_id, sesion, version)
  values (v_org, auth.uid(), v_sesion, p_version);
end $$;

grant execute on function
  public.registrar_estudiante(jsonb, boolean), public.actualizar_estudiante(uuid, int, jsonb),
  public.vincular_tutor(uuid, jsonb), public.desvincular_tutor(uuid, uuid),
  public.abrir_grupo(jsonb), public.cambiar_profesor(uuid, uuid, text),
  public.inscribir(uuid, uuid, boolean), public.anular_inscripcion(uuid, text),
  public.buscar_estudiantes(text, int), public.aceptar_aviso(text)
  to authenticated;

grant execute on function
  interno.exigir_asistente(), interno.exigir_motivo(text), interno.anotar_motivo(text),
  interno.escapar_like(text), interno.candidatos_mismo_estudiante(text, text, date, boolean),
  interno.estudiantes_que_coinciden(text, text)
  to authenticated;

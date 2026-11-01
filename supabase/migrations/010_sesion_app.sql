-- =============================================================================
-- 010 · Lo que la aplicación necesita para guiar la sesión (bloque 3)
-- Spec 001: CE-1, CE-4, CE-9, CE-14, CE-15, CE-70, CE-78 · Plan §5.1, §5.3, §5.4
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Estado de acceso del usuario actual, en UNA consulta.
--
-- proxy.ts y el menú lo necesitan en cada navegación para saber a dónde mandar
-- a la persona: cambiar la contraseña temporal (CE-9), aceptar el aviso de esta
-- sesión (CE-14, CE-15) o seguir. SECURITY DEFINER porque usa aviso_vigente(),
-- que el usuario no ejecuta; pero todo lo que devuelve sale de la fila
-- u.id = auth.uid(): la propia cuenta, sus roles y sus aceptaciones, lo mismo
-- que RLS ya le deja leer (plan §5.6). No decide el acceso a los datos: eso lo
-- sigue haciendo acceso_habilitado() en cada política.
-- -----------------------------------------------------------------------------
create function public.mi_estado_acceso() returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case when u.id is null then jsonb_build_object('cuenta', false)
  else jsonb_build_object(
    'cuenta',          true,
    'activo',          u.estado = 'activo',
    'debe_cambiar',    u.debe_cambiar_contrasena,
    'nombre_usuario',  u.nombre_usuario,
    'organizacion',    o.nombre,
    'profesor_id',     u.profesor_id,
    'roles',           coalesce((select jsonb_agg(r.rol order by r.rol)
                                 from public.usuario_rol r where r.usuario_id = u.id), '[]'::jsonb),
    'version_aviso',   public.aviso_vigente(u.organizacion_id),
    'aviso_aceptado',  exists (
                         select 1 from public.aceptacion_privacidad a
                         where a.usuario_id = u.id
                           and a.sesion = nullif(auth.jwt() ->> 'session_id', '')::uuid
                           and a.version = public.aviso_vigente(u.organizacion_id)))
  end
  from (select 1) uno
  left join public.usuario u on u.id = auth.uid()
  left join public.organizacion o on o.id = u.organizacion_id
$$;
grant execute on function public.mi_estado_acceso() to authenticated;

-- -----------------------------------------------------------------------------
-- Lo que el servidor de la app hace con la clave de servicio (plan §5.1, §5.2).
--
-- Quitar la marca de contraseña temporal NO puede hacerlo el propio usuario
-- (probado en T11: si pudiera, se saltaría CE-9 sin cambiar nada). Lo hace el
-- servidor, y solo después de que Supabase Auth confirmó el cambio de contraseña.
-- Por eso service_role puede actualizar estas tres columnas y ninguna otra.
-- -----------------------------------------------------------------------------
grant update (debe_cambiar_contrasena, contrasena_temporal_emitida, ultimo_acceso)
  on public.usuario to service_role;

-- -----------------------------------------------------------------------------
-- Cuentas (T20 · CE-5, CE-6, CE-13). Crear la fila de la cuenta y sus roles, o
-- cambiar sus roles, en UNA transacción (plan D4): nunca queda una cuenta sin
-- roles ni un profesor sin vínculo. SECURITY INVOKER: RLS exige que quien llama
-- sea Asistente con acceso, y los triggers diferidos de 003 revisan al final
-- (profesor vinculado, que quede al menos una Asistente activa).
--
-- El usuario de Supabase Auth lo crea antes el servidor con la clave de servicio
-- (la contraseña temporal la guarda Auth con bcrypt, CE-12); si esta función
-- falla, el servidor lo borra.
-- -----------------------------------------------------------------------------
create function public.crear_cuenta(p_id uuid, p_nombre_usuario text, p_correo text, p_profesor uuid, p_roles public.rol[])
returns void
language plpgsql volatile
set search_path = ''
as $$
begin
  perform interno.exigir_asistente();
  if coalesce(array_length(p_roles, 1), 0) = 0 then
    raise exception 'Elija al menos un rol.' using errcode = 'check_violation';
  end if;
  insert into public.usuario (id, organizacion_id, nombre_usuario, correo, profesor_id, debe_cambiar_contrasena, contrasena_temporal_emitida)
  values (p_id, public.mi_organizacion(), lower(btrim(p_nombre_usuario)), nullif(lower(btrim(p_correo)), ''),
          case when 'profesor' = any (p_roles) then p_profesor end, true, now());
  insert into public.usuario_rol (organizacion_id, usuario_id, rol)
  select public.mi_organizacion(), p_id, r from unnest(p_roles) r;
end $$;

create function public.asignar_roles(p_usuario uuid, p_roles public.rol[], p_profesor uuid)
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
  if not found then raise exception 'La cuenta no existe.' using errcode = 'no_data_found'; end if;
  -- Primero se agregan y después se quitan: si la Asistente se quitara su propio
  -- rol primero, RLS ya no la dejaría agregar los otros.
  insert into public.usuario_rol (organizacion_id, usuario_id, rol)
  select public.mi_organizacion(), p_usuario, r from unnest(p_roles) r
  on conflict do nothing;
  delete from public.usuario_rol where usuario_id = p_usuario and rol <> all (p_roles);
end $$;

grant execute on function public.crear_cuenta(uuid, text, text, uuid, public.rol[]),
                          public.asignar_roles(uuid, public.rol[], uuid) to authenticated;

-- =============================================================================
-- 007 · Permisos: funciones de permiso y políticas RLS de todas las tablas
-- Spec 001: CE-2, CE-7, CE-9, CE-15, CE-46, CE-52, CE-61, CE-62, CE-78, CE-94,
--           CE-96, CE-100 · RNF-05 · Plan §5.4, §5.5, §5.6
--
-- Cada política sigue la misma forma:
--   organización propia  +  puerta de acceso  +  rol que corresponde.
-- Las funciones se llaman como (select f()) para que PostgreSQL las evalúe una
-- vez por consulta y no una vez por fila.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funciones de permiso. SECURITY DEFINER: leen usuario y usuario_rol sin pasar
-- por sus propias políticas (si no, una política consultaría una tabla cuya
-- política consulta la primera, sin fin).
-- -----------------------------------------------------------------------------

-- Rol del usuario actual, solo si su cuenta está activa (CE-2: con varios roles,
-- cada política pregunta por el que necesita y los permisos se suman).
create function public.tiene_rol(p_rol public.rol) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuario u join public.usuario_rol r on r.usuario_id = u.id
    where u.id = auth.uid() and u.estado = 'activo' and r.rol = p_rol)
$$;

-- La puerta de acceso a los datos (plan §5.4). Verdadera solo si la cuenta está
-- activa (CE-7), no tiene una contraseña temporal pendiente (CE-9) y aceptó el
-- aviso vigente EN ESTA SESIÓN (CE-15). La sesión sale del token, así que no
-- se puede saltar llamando a la API sin pasar por la aplicación (CE-62).
-- La duración máxima de 12 horas (CE-90) se agrega aquí en la spec 004.
create function public.acceso_habilitado() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuario u
    where u.id = auth.uid()
      and u.estado = 'activo'
      and not u.debe_cambiar_contrasena
      and exists (
        select 1 from public.aceptacion_privacidad a
        where a.usuario_id = u.id
          and a.sesion = nullif(auth.jwt() ->> 'session_id', '')::uuid
          and a.version = public.aviso_vigente(u.organizacion_id)))
$$;

create function public.mi_profesor_id() returns uuid
language sql stable security definer
set search_path = ''
as $$ select u.profesor_id from public.usuario u where u.id = auth.uid() $$;

grant execute on function public.tiene_rol(public.rol), public.acceso_habilitado(), public.mi_profesor_id()
  to authenticated;

-- -----------------------------------------------------------------------------
-- RLS encendida en todas las tablas. El proyecto ya lo hace solo ("Enable
-- automatic RLS"); se repite aquí para no depender de esa casilla.
-- -----------------------------------------------------------------------------
alter table public.organizacion          enable row level security;
alter table public.correlativo           enable row level security;
alter table public.sucursal              enable row level security;
alter table public.modalidad             enable row level security;
alter table public.horario               enable row level security;
alter table public.nivel                 enable row level security;
alter table public.profesor              enable row level security;
alter table public.usuario               enable row level security;
alter table public.usuario_rol           enable row level security;
alter table public.aviso_privacidad      enable row level security;
alter table public.aceptacion_privacidad enable row level security;
alter table public.auditoria             enable row level security;
alter table public.estudiante            enable row level security;
alter table public.tutor                 enable row level security;
alter table public.estudiante_tutor      enable row level security;
alter table public.grupo                 enable row level security;
alter table public.inscripcion           enable row level security;
-- correlativo: RLS sin ninguna política = nadie lo ve desde la API. A propósito.

-- -----------------------------------------------------------------------------
-- Organización: cada quien ve la suya (sin pedir el aviso: la pantalla del aviso
-- necesita el nombre de la academia).
-- -----------------------------------------------------------------------------
create policy ver_propia on public.organizacion for select to authenticated
  using (id = (select public.mi_organizacion()));

-- -----------------------------------------------------------------------------
-- Catálogos: todos los roles leen; solo la Asistente escribe (CE-21, CE-61).
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sucursal', 'modalidad', 'horario', 'nivel', 'profesor'] loop
    execute format($p$
      create policy leer on public.%1$I for select to authenticated
        using (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado()));
      create policy escribir on public.%1$I for all to authenticated
        using (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and (select public.tiene_rol('asistente')))
        with check (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and (select public.tiene_rol('asistente')));
    $p$, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Estudiantes y tutores: los leen la Asistente y Dirección; el Profesor no, en
-- esta spec (CE-46). Solo la Asistente escribe (CE-61).
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['estudiante', 'tutor', 'estudiante_tutor'] loop
    execute format($p$
      create policy leer on public.%1$I for select to authenticated
        using (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and ((select public.tiene_rol('asistente')) or (select public.tiene_rol('direccion'))));
      create policy escribir on public.%1$I for all to authenticated
        using (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and (select public.tiene_rol('asistente')))
        with check (organizacion_id = (select public.mi_organizacion())
               and (select public.acceso_habilitado())
               and (select public.tiene_rol('asistente')));
    $p$, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Grupos: Asistente y Dirección ven todos; el Profesor, solo los suyos. Como la
-- condición se evalúa en cada consulta, cambiar el profesor de un grupo le quita
-- el acceso al anterior en la consulta siguiente (CE-52).
-- -----------------------------------------------------------------------------
create policy leer on public.grupo for select to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado())
         and ((select public.tiene_rol('asistente'))
              or (select public.tiene_rol('direccion'))
              or ((select public.tiene_rol('profesor')) and profesor_id = (select public.mi_profesor_id()))));
create policy escribir on public.grupo for all to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')))
  with check (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')));

create policy leer on public.inscripcion for select to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado())
         and ((select public.tiene_rol('asistente'))
              or (select public.tiene_rol('direccion'))
              or ((select public.tiene_rol('profesor')) and exists (
                    select 1 from public.grupo g
                    where g.id = grupo_id and g.profesor_id = (select public.mi_profesor_id())))));
create policy escribir on public.inscripcion for all to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')))
  with check (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')));

-- -----------------------------------------------------------------------------
-- Cuentas: la Asistente administra las de su organización (CE-5 a CE-8). Cada
-- usuario ve su propia cuenta y sus roles aunque todavía no haya aceptado el aviso
-- o deba cambiar su contraseña: la aplicación lo necesita para saber a qué
-- pantalla mandarlo (CE-78).
-- -----------------------------------------------------------------------------
create policy leer on public.usuario for select to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (id = (select auth.uid())
              or ((select public.acceso_habilitado()) and (select public.tiene_rol('asistente')))));
create policy escribir on public.usuario for all to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')))
  with check (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')));

create policy leer on public.usuario_rol for select to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (usuario_id = (select auth.uid())
              or ((select public.acceso_habilitado()) and (select public.tiene_rol('asistente')))));
create policy escribir on public.usuario_rol for all to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')))
  with check (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado()) and (select public.tiene_rol('asistente')));
grant delete on public.usuario_rol to authenticated;

-- -----------------------------------------------------------------------------
-- Aviso de privacidad: se lee ANTES de tener acceso (es lo que hay que aceptar).
-- La aceptación se registra con aceptar_aviso() (008); cada quien ve las suyas.
-- -----------------------------------------------------------------------------
create policy leer on public.aviso_privacidad for select to authenticated
  using (organizacion_id = (select public.mi_organizacion()));
create policy leer_propias on public.aceptacion_privacidad for select to authenticated
  using (usuario_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Auditoría: solo Dirección, y solo la de su organización (CE-94, K3). Nadie
-- escribe directamente: los registros los crean los triggers y las funciones.
-- -----------------------------------------------------------------------------
create policy leer on public.auditoria for select to authenticated
  using (organizacion_id = (select public.mi_organizacion())
         and (select public.acceso_habilitado())
         and (select public.tiene_rol('direccion')));

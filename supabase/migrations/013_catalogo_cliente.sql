-- =============================================================================
-- 013 · Catálogo con las respuestas de la cliente (Doña Aura, 29-oct y 1-nov-2026)
-- Spec 002: tabla «Valores iniciales de la regla de aprobación» · Plan 002 §6
--
-- Solo datos, y solo de la organización con código ADEI: en un banco sin la
-- semilla no hace nada. Se puede volver a correr sin duplicar nada.
--
--   1. Beginners, Intermediate y Advanced pasan a ser los niveles 1–2, 6–11 y
--      12–13 del Curso principal (todas las edades); se agregan los niveles 3–5 y
--      14–16 con el nombre «Nivel N», que la Asistente puede cambiar.
--   2. Los niveles «Principiante» se borran si ningún grupo los usa; si alguno se
--      usó, se desactiva (001·RN-22).
--   3. Direcciones completas de las sucursales, solo si siguen con la de la semilla.
--   4. Reglas de aprobación desde 2023 y la regla de antes (75, provisional).
-- =============================================================================
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizacion where codigo = 'ADEI';
  if v_org is null then return; end if;

  -- 1. Curso principal de 16 niveles -------------------------------------------
  update public.nivel n
     set programa = 'Curso principal', publico = 'Todos',
         orden = case n.programa when 'Beginners' then n.orden when 'Intermediate' then n.orden + 5 else n.orden + 11 end
   where n.organizacion_id = v_org
     and ((n.programa = 'Beginners' and n.orden between 1 and 2)
       or (n.programa = 'Intermediate' and n.orden between 1 and 6)
       or (n.programa = 'Advanced' and n.orden between 1 and 2));

  insert into public.nivel (organizacion_id, codigo, nombre, programa, orden, publico)
  select v_org, 'CP-' || lpad(i::text, 2, '0'), 'Nivel ' || i, 'Curso principal', i, 'Todos'
  from unnest(array[3, 4, 5, 14, 15, 16]) i
  where not exists (select 1 from public.nivel x
                    where x.organizacion_id = v_org and x.programa = 'Curso principal' and x.orden = i)
    and not exists (select 1 from public.nivel x
                    where x.organizacion_id = v_org and public.normalizar(x.nombre) = public.normalizar('Nivel ' || i));

  -- 2. Principiante ----------------------------------------------------------------
  update public.nivel n set activo = false
   where n.organizacion_id = v_org and n.programa = 'Principiante' and n.activo
     and exists (select 1 from public.grupo g where g.nivel_id = n.id);
  delete from public.nivel n
   where n.organizacion_id = v_org and n.programa = 'Principiante'
     and not exists (select 1 from public.grupo g where g.nivel_id = n.id);

  -- 3. Direcciones -----------------------------------------------------------------
  update public.sucursal s set direccion = d.direccion
  from (values
    ('Altamira', 'Altamira, Managua',
     'Calle Principal de Altamira, frente a la Ferretería Roberto Morales Cuadra (453 C. Principal), segundo piso, Managua'),
    ('Don Bosco', 'Don Bosco, Managua',
     'De la Cruz Roja Don Bosco ½ c. arriba, frente a la Parroquia Don Bosco, casa F-454, Managua'),
    ('Multicentro Las Brisas', 'Multicentro Las Brisas, Managua',
     'Multicentro Las Brisas, Módulo B-27, de los semáforos de Linda Vista 6 c. al oeste, Managua')
  ) as d(nombre, de_semilla, direccion)
  where s.organizacion_id = v_org and s.nombre = d.nombre and s.direccion = d.de_semilla;

  -- 4. Reglas de aprobación (spec 002) --------------------------------------------
  insert into public.regla_aprobacion (organizacion_id, programa, nivel_desde, nivel_hasta, vigente_desde,
                                       nota_minima, condicionado_desde, nota_condicion, provisional)
  select v_org, r.programa, r.desde, r.hasta, r.vigente::date, r.minima, r.minima - 3, r.minima, r.provisional
  from (values
    ('Curso principal',        1,  2, '2023-01-01', 75, false),
    ('Curso principal',        3,  5, '2023-01-01', 75, true),
    ('Curso principal',        6, 11, '2023-01-01', 80, false),
    ('Curso principal',       12, 13, '2023-01-01', 80, false),
    ('Curso principal',       14, 16, '2023-01-01', 90, true),
    ('Conversation',           1, 99, '2023-01-01', 80, false),
    ('Conversation Avanzada',  1, 99, '2023-01-01', 80, false),
    ('Especial',               1, 99, '2023-01-01', 80, true),
    -- Antes de 2023 la cliente recuerda 75 para todos; la fecha del cambio es un supuesto.
    ('Curso principal',        1, 99, '2000-01-01', 75, true),
    ('Conversation',           1, 99, '2000-01-01', 75, true),
    ('Conversation Avanzada',  1, 99, '2000-01-01', 75, true),
    ('Especial',               1, 99, '2000-01-01', 75, true)
  ) as r(programa, desde, hasta, vigente, minima, provisional)
  where exists (select 1 from public.nivel n where n.organizacion_id = v_org and n.programa = r.programa)
    and not exists (select 1 from public.regla_aprobacion x
                    where x.organizacion_id = v_org and x.programa = r.programa and x.vigente_desde = r.vigente::date
                      and x.nivel_desde <= r.hasta and r.desde <= x.nivel_hasta);
end $$;

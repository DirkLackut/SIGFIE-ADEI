-- =============================================================================
-- 009 · Semilla: la organización ADEI y sus catálogos
-- Plan §4 · Spec 001 CE-21 a CE-28 · Fase 1 §2.4 (catálogos medidos en 2021)
--
-- Sin profesores ni estudiantes (principio 3: ningún dato personal real en el
-- repositorio). Los profesores los registra la Asistente; los estudiantes llegan
-- por captura o por la migración del acervo (spec posterior).
--
-- PROVISIONAL, pendiente de validar con la Asistente de Dirección antes de operar
-- (supuesto del SRS: "la Asistente valida los catálogos antes de la migración"):
--   · los niveles: reconstruidos de las 94 variantes de escritura de 2021;
--     falta el catálogo infantil fuera de Principiante;
--   · los días de clase de la modalidad Diario;
--   · las direcciones de las sucursales (solo el sector);
--   · el texto del aviso de privacidad (borrador del equipo, Ley 787).
-- Todo es dato: se corrige desde la aplicación, sin otra migración.
-- =============================================================================

do $$
declare
  v_org uuid;
  v_mod uuid;
  r record;
begin
  insert into public.organizacion (codigo, nombre)
  values ('ADEI', 'Academia de Enseñanza en Inglés ADEI')
  returning id into v_org;

  -- Sucursales (CE-21, C2). Teléfonos publicados por la academia.
  insert into public.sucursal (organizacion_id, nombre, direccion, telefono, es_central) values
    (v_org, 'Altamira',               'Altamira, Managua',               '22525945', true),
    (v_org, 'Don Bosco',              'Don Bosco, Managua',              '22529357', false),
    (v_org, 'Multicentro Las Brisas', 'Multicentro Las Brisas, Managua', '22316118', false);

  -- Modalidades y sus horarios (CE-26, CE-27). Los 11 horarios reales de 2021,
  -- en 24 horas. El 14:00–17:00 existe en Sabatino y en Viernino: son dos filas.
  for r in
    select * from (values
      ('Diario',    'Lunes a jueves', array['07:00-08:00','08:00-09:30','09:30-11:00','13:30-15:00','15:00-16:30','16:30-18:00','18:00-19:30']),
      ('Sabatino',  'Sábado',         array['07:30-11:00','11:00-14:00','14:00-17:00']),
      ('Dominical', 'Domingo',        array['08:00-12:00']),
      ('Viernino',  'Viernes',        array['14:00-17:00'])
    ) as m(nombre, dias, horarios)
  loop
    insert into public.modalidad (organizacion_id, nombre, dias_de_clase)
    values (v_org, r.nombre, r.dias) returning id into v_mod;
    insert into public.horario (organizacion_id, modalidad_id, hora_inicio, hora_fin)
    select v_org, v_mod, split_part(h, '-', 1)::time, split_part(h, '-', 2)::time
    from unnest(r.horarios) h;
  end loop;

  -- Niveles (CE-22 a CE-25). "orden" es la secuencia dentro del programa y del
  -- público; la regla de aprobación de la spec 002 se apoya en él.
  insert into public.nivel (organizacion_id, codigo, nombre, programa, orden, publico)
  select v_org, n.codigo, n.nombre, n.programa, n.orden, n.publico
  from (values
    ('BEG-1',   'Beginners I',               'Beginners',             1, 'Adultos'),
    ('BEG-2',   'Beginners II',              'Beginners',             2, 'Adultos'),
    ('INT-11',  'Intermediate I-I',          'Intermediate',          1, 'Adultos'),
    ('INT-12',  'Intermediate I-II',         'Intermediate',          2, 'Adultos'),
    ('INT-21',  'Intermediate II-I',         'Intermediate',          3, 'Adultos'),
    ('INT-22',  'Intermediate II-II',        'Intermediate',          4, 'Adultos'),
    ('INT-31',  'Intermediate III-I',        'Intermediate',          5, 'Adultos'),
    ('INT-32',  'Intermediate III-II',       'Intermediate',          6, 'Adultos'),
    ('CONV-11', 'Conversation I-I',          'Conversation',          1, 'Adultos'),
    ('CONV-12', 'Conversation I-II',         'Conversation',          2, 'Adultos'),
    ('CONV-21', 'Conversation II-I',         'Conversation',          3, 'Adultos'),
    ('CONV-22', 'Conversation II-II',        'Conversation',          4, 'Adultos'),
    ('CONV-23', 'Conversation II-III',       'Conversation',          5, 'Adultos'),
    ('CONV-24', 'Conversation II-IV',        'Conversation',          6, 'Adultos'),
    ('CONV-25', 'Conversation II-V',         'Conversation',          7, 'Adultos'),
    ('CONVA-1', 'Conversation Avanzada I',   'Conversation Avanzada', 1, 'Adultos'),
    ('CONVA-2', 'Conversation Avanzada II',  'Conversation Avanzada', 2, 'Adultos'),
    ('ADV-1',   'Advanced I',                'Advanced',              1, 'Adultos'),
    ('ADV-2',   'Advanced II',               'Advanced',              2, 'Adultos'),
    ('ESP-REF', 'Conversation Reinforcement','Especial',              1, 'Adultos')
  ) as n(codigo, nombre, programa, orden, publico)
  union all
  -- Principiante: niveles 1 a 16 (regla de aprobación informada el 29-oct).
  select v_org, 'PRI-' || lpad(i::text, 2, '0'), 'Principiante ' || i, 'Principiante', i, 'Niños'
  from generate_series(1, 16) i;

  -- Aviso de privacidad (CE-15, CE-16). Borrador v0.1 del equipo; la dirección
  -- publica la versión final como v1.0 y todos lo vuelven a aceptar.
  insert into public.aviso_privacidad (organizacion_id, version, texto, vigente_desde) values (v_org, 'v0.1',
'AVISO DE PRIVACIDAD (borrador v0.1, pendiente de aprobación por la dirección)

La Academia de Enseñanza en Inglés ADEI, con sede central en Altamira, Managua, es responsable del tratamiento de los datos personales que se registran en este sistema, conforme a la Ley N.º 787, Ley de Protección de Datos Personales de Nicaragua.

Datos que se tratan: nombres y apellidos, cédula, fecha de nacimiento, teléfono, correo, dirección y contacto de emergencia de los estudiantes; nombre, cédula y teléfono de los tutores de estudiantes menores de edad; y la información académica (niveles, grupos y calificaciones). No se registran datos de salud ni estado civil.

Finalidad: administrar la matrícula, los grupos y el historial académico de los estudiantes. Los datos no se usan para otros fines ni se ceden a terceros, salvo obligación legal.

Acceso: solo el personal autorizado de la academia, cada quien según su función. Cada acceso, consulta y modificación queda registrado.

Derechos: el titular, o su tutor si es menor de edad, puede solicitar el acceso, la rectificación, la cancelación o la oposición al tratamiento de sus datos en la sucursal central o al teléfono 2252-5945.

Al continuar, usted declara haber leído este aviso y se compromete a usar la información solo para las funciones de su cargo.',
    now());
end $$;

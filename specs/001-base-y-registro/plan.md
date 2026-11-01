# Plan — Spec 001 Base y registro

**Estado:** aprobado (2026-10-29) · actualizado el mismo día con multi-tenant (acciones 2 y 6 del docente)
**Fecha:** 2026-10-29
**Entrada:** `docs/constitution.md`, `spec.md` (100 CE, clarificación cerrada)

Este documento es el CÓMO. Ninguna decisión aquí cambia el QUÉ de la spec; si
alguna lo necesitara, se detiene y se vuelve a la spec.

---

## 1. Hechos verificados que condicionan el diseño (2026-10-29)

| Hecho | Fuente | Consecuencia |
|---|---|---|
| El correo por defecto de Supabase solo envía a miembros del equipo, máx. 2 por hora, y no es para producción | Supabase Docs, *Auth SMTP* | CE-10 exige un SMTP propio (Resend o Brevo, ambos con capa gratuita) |
| El cierre por inactividad y la duración máxima de sesión de Supabase son solo del plan Pro | Supabase Docs, *Sessions* | CE-88 a CE-90 se implementan por nuestra cuenta |
| Cada token de acceso de Supabase trae un `session_id` | Supabase Docs, *Sessions* | El aviso por sesión (CE-15) se puede exigir **a nivel de base** |
| El hook de verificación de contraseña es solo de Team/Enterprise | Supabase Docs, *Auth Hooks* | El bloqueo (CE-63 a CE-68) se implementa en el servidor de la app |
| Un proyecto gratuito se pausa tras ~1 semana sin actividad; se reanuda desde el panel | Supabase Docs, *Project Pausing* | Riesgo para el proyecto de pruebas, no para producción (uso diario) |
| **El plan Hobby de Vercel es solo para uso personal no comercial**; anunciar la venta de un servicio cuenta como comercial | Vercel Docs, *Fair Use Guidelines* | Hobby sirve para desarrollo y prototipo académico, **no para la operación real de ADEI**. Ver R1 y D14 |
| Render gratuito se apaga tras 15 minutos sin tráfico, tarda cerca de 1 minuto en despertar y su propia documentación dice que no es para producción | Render Docs, *Deploy for Free* | Descartado para producción: el primer acceso del día violaría RNF-01 (< 2 s) |
| Netlify gratuito: 300 créditos al mes con límite duro; cada despliegue a producción cuesta 15 (máx. ~20 al mes); las vistas previas no consumen | Netlify Docs, *Credit-based pricing plans* | Candidato para la operación real. El uso comercial en el plan gratuito se confirma en sus términos en la spec de despliegue |

---

## 2. Arquitectura

```
 Navegador (PC de la central · celular del profesor)
        │  HTTPS
        ▼
 Vercel ── Next.js (App Router, TypeScript)
        │   proxy.ts ......... sesión: inactividad, 12 h, aviso, contraseña temporal
        │   Server Components  lectura
        │   Server Actions ... escritura e ingreso (las credenciales nunca llegan al navegador)
        ▼
 Supabase
    Auth ............ usuarios, contraseñas (bcrypt), sesiones
    PostgreSQL ...... tablas + CHECK + UNIQUE + FK + triggers + RLS + funciones de negocio
```

**Costo cero sin excepciones (constitución, principio 11):** ningún plan pago, ni
en desarrollo ni en producción. Las tres funciones de Supabase que solo existen en
planes pagos (sesiones, hook de contraseña, correo para producción) se resuelven
por cuenta propia o con un servicio gratuito, como se detalla abajo.

**Regla rectora (constitución, principio 1):** la base es la última defensa.
La app valida para avisar; Postgres valida para proteger. Toda regla que pueda
vivir en la base, vive ahí, aunque la app la repita para dar un mensaje claro.

---

## 3. Estructura del repositorio

```
src/
  app/
    (publico)/ingresar/  restablecer/  nueva-contrasena/
    (sistema)/aviso/  cambiar-contrasena/  inicio/
              estudiantes/  grupos/  catalogos/  cuentas/
  dominio/            lógica pura: sin red, sin base, sin fecha del sistema
    texto.ts            normalizar, comparar sin tildes ni mayúsculas
    cedula.ts           validar formato, normalizar letra, quitar guiones
    edad.ts             calcularEdad(fechaNacimiento, hoy), esMenor
    codigos.ts          formatear ADEI-AAAA-NNNNN y G-AAAA-NNNN
    bloqueo.ts          máquina de estados del bloqueo (CE-63 a CE-67)
    sesion.ts           evaluar inactividad y duración máxima (CE-88 a CE-90)
    contrasena.ts       generar temporal, evaluar vencimiento (CE-70)
    superposicion.ts    ¿se cruzan dos inscripciones? (CE-84)
  datos/              acceso a Supabase, solo servidor
  tipos/base-de-datos.ts   generado con `supabase gen types`
  proxy.ts
supabase/migrations/  001 … 009 (sección 4)
scripts/generar-sinteticos.ts
tests/
  dominio/            pruebas unitarias
  bd/                 pruebas de integración contra el proyecto de pruebas
```

---

## 4. Modelo de datos

Nombres en español, `snake_case`, igual que el diagrama de clases de la Fase 2.
Las migraciones se aplican en este orden:

| Migración | Contenido |
|---|---|
| `001_utilidades.sql` | Extensiones `unaccent` y `pg_trgm`; función `normalizar(texto)` inmutable; función `hoy_managua()`; tabla `organizacion` y función `mi_organizacion()`; tabla `correlativo` |
| `002_catalogos.sql` | `sucursal`, `modalidad`, `horario`, `nivel`, `profesor` |
| `003_cuentas.sql` | `usuario`, `usuario_rol`, `intento_ingreso`, `aviso_privacidad`, `aceptacion_privacidad` |
| `004_auditoria.sql` | `auditoria` y su trigger genérico |
| `005_estudiantes.sql` | `estudiante`, `tutor`, `estudiante_tutor` |
| `006_grupos.sql` | `grupo`, `inscripcion` |
| `007_permisos.sql` | Funciones de permiso y políticas RLS de todas las tablas |
| `008_operaciones.sql` | Funciones de negocio (sección 6) |
| `009_semilla.sql` | La organización ADEI; sus sucursales, modalidades, horarios y niveles. **Sin profesores ni estudiantes** |
| `010_sesion_app.sql` | Lo que la app necesita para guiar la sesión: `mi_estado_acceso()` (estado, roles y aviso en una consulta), `crear_cuenta()` y `asignar_roles()` (cuenta y roles en una transacción), y el permiso de `service_role` para quitar la marca de contraseña temporal. Agregada en el bloque 3 |
| `011_no_existe_404.sql` | Las cinco funciones que avisaban «no existe» usan el código `PT404`, que PostgREST devuelve como 404 y no como 500 (CE-101, D22). Solo reemplaza funciones: no toca tablas ni datos. |

### 4.1 Tablas y restricciones

| Tabla | Restricciones clave | CE |
|---|---|---|
| `sucursal` | `UNIQUE(normalizar(nombre))`; índice único parcial `WHERE es_central` (como máximo una); trigger que impide dejar ninguna | CE-22, CE-28 |
| `modalidad` | `UNIQUE(normalizar(nombre))`, `activo` | CE-22, CE-24 |
| `horario` | FK `modalidad_id`; `CHECK (hora_fin > hora_inicio)`; `UNIQUE(modalidad_id, hora_inicio, hora_fin)` | CE-26, CE-27, CE-74 |
| `nivel` | `UNIQUE(normalizar(nombre))`, `UNIQUE(codigo)`, `UNIQUE(programa, orden)` | CE-22, CE-74 |
| `profesor` | `CHECK` de formato en teléfono; **sin** unicidad de nombre (homónimos posibles) | CE-75 |
| `estudiante` | `UNIQUE(codigo_adei)`; `UNIQUE(cedula)`; `CHECK` de formato de cédula, teléfono y nombres; columna `busqueda` generada; columna `version` | CE-29, CE-30, CE-37, CE-41, CE-86 |
| `tutor` | `UNIQUE(cedula)`, cédula y teléfono obligatorios | CE-33, CE-38 |
| `estudiante_tutor` | PK compuesta; trigger diferido: un menor no queda sin tutor | CE-33, CE-81, CE-82 |
| `grupo` | `UNIQUE(codigo_grupo)`; FK a nivel, **horario**, profesor, sucursal; `CHECK (fecha_termino > fecha_inicio)` | CE-47, CE-48, CE-50 |
| `inscripcion` | `UNIQUE(estudiante_id, grupo_id)` | CE-56 |
| `usuario` | PK = `auth.users.id`; `UNIQUE(lower(nombre_usuario))`; `UNIQUE(profesor_id)`; `debe_cambiar_contrasena`, `contrasena_temporal_vence` | CE-5, CE-6, CE-9, CE-69, CE-70 |
| `auditoria` | Solo inserción: sin permisos de `UPDATE`/`DELETE` para ningún rol, más un trigger que lo rechaza | CE-19 |

**El grupo no guarda la modalidad: la deduce del horario.** Como cada horario
pertenece a una sola modalidad, un grupo con un horario de otra modalidad
**no se puede representar**. RN-07 deja de ser una validación y pasa a ser una
propiedad del modelo. Es lo que ya dibuja el diagrama de clases (Modalidad 1—1..*
Horario 1—0..* Grupo). La función de abrir grupo igual recibe la modalidad
elegida y rechaza la combinación incoherente, para cumplir CE-49 con un mensaje.

**Reglas que dependen de "hoy" no van en `CHECK`.** Postgres exige que un
`CHECK` sea inmutable, y la edad o "fecha de término pasada" cambian con el
calendario. Esas van en triggers o en las funciones de negocio, usando
`hoy_managua()` = `(now() AT TIME ZONE 'America/Managua')::date` (CE-77).

### 4.2 Organización: aislamiento multi-tenant (CE-95 a CE-100)

**Modelo elegido: una sola base, tablas compartidas, columna `organizacion_id` y RLS.**

- Tabla `organizacion(id, codigo, nombre)`. ADEI tiene código `ADEI`.
- **Todas** las tablas de datos llevan `organizacion_id NOT NULL`, con valor por
  defecto `mi_organizacion()`: la app nunca lo envía, y nadie puede escribir en otra
  organización poniendo otro número.
- Las `UNIQUE` incluyen la organización: `UNIQUE(organizacion_id, cedula)`,
  `UNIQUE(organizacion_id, normalizar(nombre))`, etc. La misma persona podría estudiar
  en dos academias sin chocar (CE-98). Excepción: el nombre de usuario es único en
  todo el sistema, porque el ingreso lo usa para encontrar la cuenta.
- **Las relaciones entre tablas no pueden cruzar organizaciones**, y no por
  validación: cada tabla tiene `UNIQUE(organizacion_id, id)` y cada llave foránea es
  compuesta, `FOREIGN KEY (organizacion_id, grupo_id) REFERENCES grupo(organizacion_id, id)`.
  Una inscripción con un estudiante de ADEI y un grupo de otra academia **no se puede
  representar** (CE-97). Es el mismo principio que D10.
- Cada política RLS agrega `organizacion_id = mi_organizacion()` a lo que ya exigía
  (CE-96, CE-100). La auditoría también: Dirección lee solo la de su organización.
- Los correlativos se llevan por `(organizacion_id, tipo, anio)` y el prefijo del
  código sale de `organizacion.codigo` (CE-99).

**Qué cambia para ADEI: nada visible.** Ningún flujo, pantalla ni criterio anterior
se modifica. El aislamiento existe aunque haya una sola organización, y se prueba
creando una segunda organización ficticia en el proyecto de pruebas.

### 4.3 Códigos correlativos (CE-29, CE-48)

Tabla `correlativo(tipo, anio, ultimo)` y una función que hace
`INSERT … ON CONFLICT DO UPDATE SET ultimo = ultimo + 1 RETURNING ultimo`.
Es atómica: dos registros simultáneos nunca reciben el mismo número, y si la
transacción falla el número no se consume. El año nuevo crea su fila sola, así
que el reinicio anual es automático.

### 4.4 Usuarios sin correo

Supabase Auth identifica por correo, pero el SRS identifica por nombre de
usuario y no todos los profesores tienen correo. Solución:

- Si el usuario tiene correo, ese es su correo en Auth (y puede restablecer solo: CE-10).
- Si no, se le asigna uno interno `u-<id>@sigfie.invalid`. El dominio `.invalid`
  está reservado por el estándar RFC 2606: nunca sale un correo hacia ahí.
- El ingreso busca el correo de Auth a partir del nombre de usuario, en el servidor.

---

## 5. Seguridad

### 5.1 Ingreso y bloqueo (CE-1 a CE-4, CE-63 a CE-69)

El ingreso es una Server Action que hace, en orden:

1. Normaliza el nombre de usuario a minúsculas (CE-69).
2. Consulta `intento_ingreso`. Si está bloqueado, responde el mensaje genérico **sin
   verificar la contraseña** (CE-64).
3. Busca la cuenta. Si no existe, **registra el fallo igual** que si existiera, para
   que el bloqueo no revele qué usuarios existen (CE-63).
4. Verifica estado Activo y vencimiento de la contraseña temporal (CE-4, CE-70).
5. Llama a Supabase Auth.
6. Actualiza el conteo con la lógica pura de `dominio/bloqueo.ts` (5 fallos en 15
   minutos → 15 minutos de bloqueo; éxito → reinicia).
7. Registra Acceso o Denegación en la auditoría (CE-18, CE-68). Nunca la contraseña.

**Limitación declarada.** Quien conozca el correo de una cuenta podría llamar
directamente a la API de Supabase Auth y saltarse nuestro conteo. Mitigan: los
correos internos son impredecibles, Supabase limita por dirección de red los
intentos de ingreso, y la única defensa completa (el hook de verificación) es de
un plan pago. Queda como riesgo R3.

### 5.2 Desactivar una cuenta (CE-7)

Se marca Inactiva **y** se suspende el usuario en Supabase Auth. Además, las
funciones de permiso comprueban el estado en cada consulta, así que el corte de
acceso a los datos es inmediato aunque el navegador conserve una sesión abierta.

### 5.3 Sesión (CE-88 a CE-90)

`proxy.ts` mantiene una cookie `httpOnly` firmada con HMAC (Web Crypto, sin
dependencias) que guarda el inicio de la sesión y la última actividad, y aplica
la lógica pura de `dominio/sesion.ts`. Un temporizador en el navegador muestra el
aviso a los 28 minutos (CE-89).

La duración máxima de 12 horas **también se exige en la base**: la función de
permiso compara la fecha de creación de la sesión en `auth.sessions`.

### 5.4 La puerta de acceso a los datos

Una función `acceso_habilitado()` que todas las políticas RLS exigen. Devuelve
verdadero solo si, para el usuario del token:

- su cuenta está Activa,
- no tiene contraseña temporal pendiente de cambio (CE-9),
- **aceptó el aviso vigente en esta misma sesión**, comparando el `session_id`
  del token con `aceptacion_privacidad` (CE-15),
- la sesión tiene menos de 12 horas (CE-90).

**Consecuencia:** aunque alguien use el token directamente contra la API, sin
pasar por la app, no ve un solo dato sin haber aceptado el aviso. RN-16 queda
cumplida a nivel de datos, no solo en pantalla (RNF-05, CE-62).

Aceptar el aviso y cambiar la propia contraseña quedan fuera de esa puerta, para
todos los roles (CE-78).

### 5.5 Dos candados, no uno

El proyecto se crea con **"Automatically expose new tables" desactivado** y
**"Enable automatic RLS" activado** (decisión al crear el proyecto, 29-oct). Eso
significa que una tabla nueva nace sin permisos y con RLS encendida: si una
migración olvida su política, la tabla no se ve, en vez de quedar expuesta. El
error cae del lado seguro.

Consecuencia para las migraciones: cada tabla necesita su `GRANT` explícito al rol
`authenticated`, además de sus políticas. **Y también a `service_role`** en las tablas
que use el servidor (auditoría, intentos de ingreso): la casilla apagada le quita los
permisos automáticos a los tres roles de la API, y saltarse RLS no es tener permiso
(verificado en el banco de pruebas, T2). Los tests de permisos (T11) lo verifican.

### 5.6 Matriz de permisos (RLS)

| Tabla | Asistente | Dirección | Profesor | CE |
|---|---|---|---|---|
| Catálogos | lee y escribe | lee | lee | CE-21, CE-61 |
| `estudiante`, `tutor` | lee y escribe | lee | **nada** en esta spec | CE-46, CE-61 |
| `grupo`, `inscripcion` | lee y escribe | lee | lee **solo** donde `grupo.profesor_id` es el suyo | CE-52, CE-61 |
| `usuario`, `usuario_rol` | lee y escribe | su propia fila | su propia fila | CE-5, CE-61 |
| `auditoria` | **nada** | lee | nada | CE-94 |

Los permisos de un usuario con varios roles son la unión de las filas (CE-2).
Como RLS lee `grupo.profesor_id` en cada consulta, cambiar el profesor de un
grupo le retira el acceso al anterior **en la consulta siguiente** (CE-52).

### 5.7 Encabezados de seguridad (CE-102, CE-103, D23)

Hallazgo de las pruebas de seguridad (T34). `src/dominio/seguridad.ts` define la
política y los encabezados, con sus pruebas:

- **CSP**, creada en `proxy.ts` con un nonce nuevo en cada respuesta: scripts solo con
  el nonce (`'strict-dynamic'`), conexiones solo al sitio y a Supabase,
  `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` y
  `form-action 'self'`.
- **Fijos**, en `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`. Además,
  `poweredByHeader: false`.
- El layout raíz llama a `connection()`: ninguna página se prearma, y todas llevan su nonce.

---

## 6. Operaciones de negocio

Cada operación con más de un paso es **una función de Postgres** que corre en una
sola transacción. Todas usan `SECURITY INVOKER`, es decir, se ejecutan con los
permisos de quien llama, así que RLS sigue aplicando.

| Función | Hace | CE |
|---|---|---|
| `registrar_estudiante` | Valida, busca coincidencias, genera código, inserta estudiante y tutores | CE-29 a CE-38, CE-79 |
| `actualizar_estudiante` | Valida, compara `version`, guarda | CE-40, CE-41, CE-80, CE-81, CE-86 |
| `vincular_tutor`, `desvincular_tutor` | | CE-38, CE-82 |
| `abrir_grupo` | Coherencia horario–modalidad, fechas, activos, código | CE-47 a CE-50, CE-91, CE-92 |
| `cambiar_profesor` | Acta Abierta, profesor activo, motivo | CE-51 a CE-53 |
| `inscribir` | Activo, no doble, acta Abierta, grupo no terminado, superposición | CE-54 a CE-57, CE-84, CE-93 |
| `anular_inscripcion` | Acta Abierta, motivo, conserva todo en auditoría | CE-58 a CE-60 |
| `buscar_estudiantes` | Búsqueda paginada con total, registra la consulta | CE-42 a CE-46, CE-85 |
| `aceptar_aviso` | Registra la aceptación con versión y sesión | CE-16 |

**Las coincidencias no se deciden en la pantalla.** `registrar_estudiante`
responde "hay coincidencias" con la lista de candidatos, y solo inserta si se le
vuelve a llamar con la confirmación. Así el control (CE-31, CE-79) no depende de
que la interfaz lo respete.

**El motivo llega a la auditoría sin parámetros extra.** La función guarda el
motivo con `set_config('sigfie.motivo', …, true)`, que vive solo durante esa
transacción, y el trigger de auditoría lo lee. El mismo mecanismo registra la
decisión "es otra persona" de CE-32.

**Una denegación no se puede registrar con un error.** Si `buscar_estudiantes`
lanzara una excepción al negarle el acceso a un profesor, la transacción se
desharía **y con ella el registro de la denegación**. Por eso devuelve un resultado
de "denegado" en vez de fallar, y así la auditoría de CE-46 queda guardada.

**Excepciones a `SECURITY INVOKER` (implementación, 2026-10-30).** Todas
justificadas y probadas en `tests/bd`:

- `aceptar_aviso`: nadie inserta directo en `aceptacion_privacidad`; el usuario, la
  organización y la sesión salen del token, no de los parámetros.
- El trigger que asigna los códigos: el usuario no puede ejecutar el correlativo.
- `interno.estudiantes_que_coinciden`, el paso previo de la búsqueda (sección 7).

Las auxiliares que las operaciones llaman (`exigir_asistente`, `exigir_motivo`,
`anotar_motivo`, `escapar_like`, …) están en el esquema `interno`, que Supabase no
publica: **la API ofrece solo las operaciones de la tabla de arriba.**

---

## 7. Búsqueda (CE-42 a CE-45, CE-73, CE-85)

- Columna generada `busqueda` = nombre completo normalizado + cédula sin guiones +
  código ADEI en minúsculas, con un índice GIN de trigramas (`pg_trgm`).
- Consulta: `busqueda LIKE '%' || normalizar(texto) || '%'`.
- **El índice de trigramas necesita al menos 3 caracteres para servir**, que es
  justo el mínimo de RF-09. El requisito y la técnica coinciden.
- Total y página en **una sola consulta** con `count(*) OVER()`, 50 resultados por
  página. El total y los datos salen del mismo instante: es la misma técnica que
  usará la spec 003 para el fallo de 2018.
- La pantalla espera a que el usuario deje de escribir (unos 300 ms) antes de
  buscar (CE-73).
- **RLS y el índice (hallazgo de T15).** Con RLS activa, PostgreSQL aplica primero
  las políticas y solo después los filtros que no son *leakproof*, como `LIKE`; por
  eso no puede usar el índice de trigramas. La búsqueda tiene un paso previo,
  `interno.estudiantes_que_coinciden`, que corre sin RLS, repite a mano los filtros
  de la política (organización, acceso, rol) y devuelve solo ids; las filas se leen
  después **con** RLS. Un error en ese paso solo podría ocultar resultados, nunca
  mostrar los de otra organización (D18).
- Los comodines `%` y `_` que escribe el usuario se escapan.
- Medido con 20,000 estudiantes sintéticos en PGlite: 5 a 44 ms por búsqueda.

---

## 8. Auditoría (CE-17 a CE-20, CE-59, CE-68, CE-94)

- Un trigger genérico `AFTER INSERT OR UPDATE OR DELETE` en todas las tablas de la
  sección 4.1 guarda `to_jsonb(OLD)` y `to_jsonb(NEW)`, el usuario (`auth.uid()`),
  la fecha-hora y el motivo si lo hay.
- **Va en la misma transacción** que el cambio: si la auditoría falla, el cambio no
  se aplica (CE-20) sin escribir una línea de código para eso.
- Los eventos que no modifican tablas (ingreso, denegación, búsqueda) se registran
  con una función `registrar_evento`.
- Los fallos de ingreso, que ocurren sin usuario autenticado, los registra la
  Server Action con la clave de servicio, que solo existe en el servidor.

---

## 9. Decisiones y alternativas descartadas

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D1 | Supabase Auth con correo interno `.invalid` para quien no tiene correo | Tabla de usuarios y contraseñas propia | Reimplementar autenticación es la fuente clásica de vulnerabilidades; Supabase ya cumple RNF-04 |
| D2 | Bloqueo en la Server Action | Hook de verificación de contraseña | Solo Team/Enterprise (costo). Limitación declarada en R3 |
| D3 | Roles leídos de la tabla en cada consulta | Roles dentro del token (hook de token, disponible gratis) | El token dura hasta 1 hora: quitar un rol o desactivar una cuenta tardaría hasta una hora en surtir efecto |
| D4 | Operaciones como funciones de Postgres | Varias llamadas desde la Server Action | Una función es una transacción: no hay estudiante a medio registrar sin su tutor |
| D5 | Auditoría por triggers | Registrar desde el código de la app | Un trigger no se olvida; la app sí |
| D6 | Aviso exigido en RLS por `session_id` | Solo redirección en `proxy.ts` | La redirección se salta llamando a la API directamente |
| D7 | Trigramas + columna generada | Búsqueda de texto completo (`tsvector`) | `tsvector` busca palabras, no fragmentos: "gutie" no encontraría "Gutiérrez" |
| D8 | Tabla de correlativos | `MAX(numero) + 1` | Dos registros simultáneos obtendrían el mismo número |
| D9 | Cookie firmada propia para la sesión | Configuración de sesiones de Supabase | Solo plan Pro |
| D10 | Grupo sin columna de modalidad | Guardar modalidad y validar contra el horario | Un estado inválido que no se puede representar no necesita validación |
| D11 | Tailwind con los colores y la tipografía de ADEI | Biblioteca de componentes (shadcn/ui u otra) | Da el aspecto genérico que el principio 9 quiere evitar, y suma dependencias |
| D12 | **Dos capas de pruebas de base:** PGlite (PostgreSQL 18 en Node, sin red) con un esquema `auth` simulado, en cada tarea; y el proyecto Supabase de pruebas, antes de cerrar la spec | Solo el proyecto Supabase, o Docker | Verificado el 29-oct: el entorno de trabajo de Claude no llega a Supabase ni a Vercel (solo a npm y PyPI). PGlite sí corre ahí, con `pg_trgm`, `unaccent`, roles y RLS. El proyecto real confirma lo que PGlite simula (Auth, `auth.sessions`). Docker no está instalado |
| D17 | `cacheComponents` y `partialPrefetching` desactivados | Dejarlos como los activa la plantilla de Next 16 | Cada pantalla muestra datos de un usuario, su organización y su rol. Una respuesta reutilizada entre usuarios sería una fuga de datos de estudiantes, incluidos menores (principio 3) |
| D18 | Paso previo `SECURITY DEFINER` que usa el índice de trigramas y devuelve ids; las filas se leen con RLS | Búsqueda solo con RLS (recorre la tabla entera: hoy rinde, crece lineal); función de búsqueda entera `SECURITY DEFINER` (sin la segunda barrera de RLS) | CE-45 a largo plazo sin renunciar a RLS como segunda barrera (principio 7) |
| D19 | `motion` para entrar y salir de elementos y cambios de altura | Solo CSS | CSS no anima la salida de un elemento que React quita (un aviso que se cierra, una inscripción anulada) ni la altura automática de un panel que se despliega. Se usa con `LazyMotion` para cargar solo lo necesario. Reglas de uso en §14 |
| D20 | `sonner` para confirmaciones pasajeras | Avisos hechos a mano, o mostrar todo en la página | Lo que se hizo en el lugar (copiar, vincular, guardar roles) se confirma sin mover la página. Los errores **no** van en toasts: quedan junto al campo (CE-37) |
| D21 | Libre Baskerville desde `@fontsource/libre-baskerville` | Baskerville Old Face del manual | Baskerville Old Face es comercial (Monotype/Microsoft) y no se puede publicar en la web; Libre Baskerville tiene licencia OFL. Mismo motivo que D16 para servirla desde el paquete |
| D22 | Código `PT404` en los errores «no existe» | `no_data_found` (P0002) | PostgREST no conoce P0002 y lo devolvía como 500: parecía una falla del servidor cuando era un pedido sobre algo inexistente o ajeno. `PTnnn` es la forma documentada de PostgREST de elegir el código HTTP. La app traduce los errores por mensaje y restricción, así que no cambia. |
| D23 | CSP con nonce por respuesta, creada en `proxy.ts`; los demás encabezados en `next.config.ts` | CSP fija con `'unsafe-inline'` en los scripts | Con nonce, un script inyectado no se ejecuta aunque llegue a la página. Exige que cada página se genere al pedirla, algo que estas pantallas ya hacían por la sesión. Los estilos sí llevan `'unsafe-inline'`, porque `motion` y `sonner` escriben estilos en los elementos, y un estilo no ejecuta código. |
| D16 | Montserrat desde el paquete npm `@fontsource/montserrat` | `next/font/google` | `next/font/google` descarga la fuente al compilar desde Google, que no es alcanzable desde el entorno de trabajo; además, servir la fuente propia evita enviar la IP de cada usuario a Google |
| D13 | Generador propio de datos sintéticos | Biblioteca de datos falsos (faker) | Una dependencia para generar nombres no se justifica (principio 7) |
| D15 | **Multi-tenant con tablas compartidas, `organizacion_id` y RLS** | Un esquema de Postgres por organización, o un proyecto de Supabase por organización | Un esquema por organización obliga a repetir cada migración N veces; un proyecto por organización choca con el límite de proyectos gratuitos. Con RLS, el aislamiento usa el mismo mecanismo que ya protege los roles |
| D14 | **Código portable: nada exclusivo de Vercel** (ni paquetes `@vercel/*`, ni su almacenamiento, ni sus tareas programadas). Solo lo estándar de Next.js | Aprovechar los servicios propios de Vercel | La operación real no puede ir en Vercel Hobby (R1); el código tiene que poder moverse a otro hosting gratuito sin reescribirse |

### Dependencias

| Paquete | Para qué |
|---|---|
| `next`, `react`, `react-dom` | La app |
| `@supabase/supabase-js`, `@supabase/ssr` | Cliente de Supabase y sesión en cookies con App Router |
| `tailwindcss` | Estilos con los tokens de ADEI |
| `vitest` (desarrollo) | Pruebas |
| `supabase` CLI (desarrollo) | Migraciones y tipos |
| `@fontsource/montserrat`, `@fontsource/libre-baskerville` | Tipografías de ADEI servidas desde la app (D16, D21) |
| `motion` | Movimiento de entrada, salida y altura (D19) |
| `sonner` | Confirmaciones pasajeras (D20) |
| `pg` (desarrollo) | Script de verificación de Supabase real (T16) |

Todas las dependencias llevan versión exacta en `package.json` (sin `^` ni `~`), y
`.npmrc` tiene `save-exact=true`: hallazgo H3 de T34. `package-lock.json` fija además
las dependencias de las dependencias.

---

## 10. Estrategia de pruebas

| Nivel | Qué prueba | Dónde | CE principales |
|---|---|---|---|
| Unitario | Lógica pura con la fecha inyectada | `tests/dominio`, sin red | CE-36, CE-63 a CE-67, CE-70, CE-76, CE-77, CE-84, CE-88 a CE-90 |
| Integración (rápida) | Restricciones, triggers, RLS por rol, funciones de negocio | `tests/bd`, en PGlite, en cada tarea |
| Integración (real) | Lo mismo más Supabase Auth | `tests/bd` contra el proyecto de pruebas, antes de cerrar la spec, desde la PC | La mayoría: CE-2, CE-13, CE-17 a CE-20, CE-22 a CE-62, CE-79 a CE-86, CE-91 a CE-94 |
| Rendimiento | Búsqueda con 20,000 estudiantes sintéticos | `tests/bd` | CE-45 |
| Manual | Lo que solo se ve en pantalla | Lista de comprobación de la spec | CE-14, CE-21, CE-37, CE-39, CE-73, CE-87, CE-89, CE-10 con un correo real |

- **Cuatro usuarios de prueba**: Asistente, Dirección, Profesor y un multirrol
  Dirección + Profesor (el caso real del Director, CE-2).
- **Una segunda organización ficticia** con su propia Asistente, para probar que
  ninguna de las dos ve, modifica ni puede relacionar datos de la otra (CE-95 a CE-100).
- **Cada test se nombra con su CE**: `test("CE-56 · RN-09: …")`. La validación final
  se arma leyendo esos nombres.
- **Las pruebas de permisos intentan lo prohibido**, no solo lo permitido: un
  profesor pidiendo estudiantes, Dirección intentando editar, alguien borrando la
  auditoría. El test pasa cuando la base **rechaza**.
- **La fecha nunca se lee del sistema** en la lógica pura: los 15 minutos de
  bloqueo, las 72 horas y las 12 horas se prueban adelantando un reloj inyectado.
- **CE-60** (no anular una inscripción con parciales) solo se puede verificar
  cuando exista la tabla de parciales, en la spec 002. Se deja marcado.
- **Datos 100 % sintéticos** (principio 3). Cada corrida usa un prefijo propio para
  no chocar con corridas anteriores, porque la auditoría de pruebas no se puede
  borrar.

---

## 11. Configuración externa y costo

| Servicio | Plan | Costo | Nota |
|---|---|---|---|
| Supabase, proyecto `sigfie-adei` | Free | US$0 | **Uno solo hasta que entren datos reales.** Supabase permite 2 proyectos gratuitos por usuario sumando todas sus organizaciones, y Dirk ya usa uno en otra organización (verificado 29-oct). Mientras solo haya datos sintéticos, pruebas y demo comparten este proyecto, separadas por la segunda organización ficticia y por prefijos |
| Supabase, segundo proyecto | Free | US$0 | Se crea antes de migrar datos reales de ADEI, cuando haya un cupo libre (un proyecto pausado no cuenta). A partir de ahí, producción y pruebas quedan separadas |
| Vercel | Hobby | US$0 | Desarrollo, vistas previas y prototipo para la defensa. Uso académico, no comercial |
| Hosting de la operación real | Gratuito con uso comercial permitido | US$0 | Se decide en la spec de despliegue. Candidato: Netlify Free. Descartado: Render Free (R1) |
| SMTP (Resend o Brevo) | Free | US$0 | El cupo diario exacto se confirma al configurarlo |

Mismo centro de datos para Vercel y Supabase, para que cada consulta no cruce el
continente y se cumpla RNF-01.

---

## 12. Riesgos

| # | Riesgo | Impacto | Respuesta |
|---|---|---|---|
| **R1** | **Vercel Hobby prohíbe el uso comercial.** Un sistema que opera una academia, y más una landing que anuncia sus cursos, probablemente lo sea | Sin plan pago (principio 11), la operación real necesita otro hosting | Prototipo y defensa en Hobby. Operación real en un hosting gratuito con uso comercial permitido; candidato Netlify Free, a confirmar en sus términos. Render Free descartado (no apto para producción, 1 minuto para despertar). D14 garantiza que el código se pueda mover. **El OPEX de la Fase 1 se mantiene en cero de hosting** |
| R5 | Netlify Free permite ~20 despliegues a producción al mes | Desplegar a producción en cada cambio agotaría el cupo | Durante el desarrollo se trabaja en Vercel o en vistas previas, que no consumen; a producción solo van versiones cerradas |
| R2 | El proyecto de pruebas se pausa | Las pruebas de integración fallan sin que haya un error real | Reanudarlo desde el panel; el primer paso de cada sesión de trabajo es verificar que responda |
| R3 | Una llamada directa a la API de Auth salta el bloqueo propio | Ataque de fuerza bruta más lento, no imposible | Correos internos impredecibles + límite por red de Supabase; documentado para la defensa |
| R4 | Cupo diario del SMTP gratuito | Un restablecimiento por correo podría no llegar | Con 17 profesores el volumen es mínimo; la Asistente puede restablecer (CE-8) |

---

## 13. Impacto en el modelo del SRS

Se agregan al diagrama de clases cuando llegue la Fase 2 corregida:

- `Usuario`: `correo` (opcional), `debeCambiarContrasena`, `contrasenaTemporalVence`.
- Clases nuevas de soporte: `AvisoPrivacidad` (texto versionado), `IntentoIngreso`, `Correlativo`.
- `AceptacionPrivacidad`: atributo `sesion`.
- `Grupo` confirma lo que el diagrama ya muestra: la modalidad se obtiene a través del horario.
- Clase nueva `Organizacion` (código, nombre), asociada 1 — 0..* con `Sucursal`, `Usuario` y
  cada clase de datos. Es la formalización multi-tenant que pidió el docente (acción 2).

---

## 14. Identidad visual y movimiento (principio 9)

Fuente: *Manual de Identidad Corporativa* de ADEI (Illustrator, 2020), entregado en
octubre de 2026. Reemplaza los colores que se habían tomado del sitio web.

### Colores

El contraste se midió con WCAG 2.2. El mínimo es 4.5:1 para texto normal y 3:1
para íconos, bordes y texto grande. `tests/dominio/contraste.test.ts` lo vuelve a
medir en cada cambio de los tokens.

| Token | Color | Uso | Contraste |
|---|---|---|---|
| `marino` | `#03214C` | Color principal: encabezado, botón principal, franja del ingreso. Es el de todas las bandas del manual, aunque no figura entre sus 8 muestras | 15.8 sobre blanco |
| `azul` | `#3B5A9E` (Azul oscuro) | Enlaces, menú activo, borde de foco | 6.7 |
| `cian` | `#00545A` (Cian profundo) | Texto de éxito («Activo», «Listo») | 8.7 |
| `verde` | `#05C167` | Solo relleno o ícono de éxito; nunca texto sobre blanco | 2.4 (no apto para texto) |
| `celeste` | `#3F95FF` | Detalles sobre fondo marino | 5.3 sobre marino |
| `dorado` | `#A57E14` | Bordes e íconos de advertencia | 3.8 |
| `dorado-texto` | tono oscuro del dorado | Texto de advertencia y de errores de formulario | ≥ 4.5 |
| `reprobado` | `#DD0E0E` (Rojo) | **Solo** notas reprobadas | 5.1 |

### Tipografía

- **Montserrat** para la interfaz: textos, tablas y formularios. Es la del sitio
  de ADEI y la del «ADEI» de sus promocionales.
- **Libre Baskerville** para los títulos de página y el título del ingreso. Es la
  versión libre de la Baskerville del emblema (D21).
- **Button Shield**, la letra del eslogan, no se usa: su licencia es solo para uso
  personal. El eslogan es material de mercadeo y no entra en la herramienta.
- Los campos usan 16 px en el celular: con menos, el iPhone hace zoom al
  tocarlos.

### Logo

El emblema se extrajo del PDF del manual sin redibujarlo. La versión de una tinta
(páginas «Negativo» y «Gris») es 100 % vector y se colorea desde CSS
(`currentColor`). La versión a todo color mezcla vector con imágenes a 300 ppi
(mundo, pizarra y libros) y se usa hasta unos 500 px.

| Dónde | Versión | Tamaño |
|---|---|---|
| Ingreso en PC | Emblema blanco sobre franja marino, como la portada del manual | ~280 px |
| Ingreso en celular | Emblema marino sobre blanco | ~96 px |
| Encabezado del sistema | Emblema de una tinta + «ADEI» en negrita, como los promocionales | 36 px en PC, 32 px en celular |
| Ícono de pestaña y de celular | Óvalo con «ADEI», recortado del emblema | 16 a 180 px |
| Actas impresas (spec 003) | Formato oficial «Hoja de registro de notas»: emblema arriba a la izquierda y marca de agua centrada, a color o en gris según la impresora | — |

Por debajo de ~96 px el texto circular del emblema no se lee. Por eso, en tamaño
pequeño, el emblema siempre va acompañado de la palabra «ADEI».

### Movimiento (D19, D20)

Sigue el criterio de Emil Kowalski (skill `emil-design-eng`): solo se anima lo
que tiene un propósito (respuesta al toque, indicar un cambio de estado,
continuidad espacial), y la animación depende de cuántas veces al día se ve.

| Frecuencia | Qué | Movimiento |
|---|---|---|
| Decenas de veces al día | Escribir en el buscador, cambiar de página, tablas, menú | **Ninguno**, a propósito |
| Cada clic | Botones | Se hunden levemente al presionar (`scale(0.97)`, ~120 ms) |
| Ocasional | «Editar datos», «Vincular tutor», menú «Cuenta» | Se despliegan desde donde se pulsó (~200 ms, salida rápida) |
| Ocasional | Avisos de «Listo» y de «Revise…»; filas que se agregan o se anulan | Entrada corta de 8 px con fundido (~200 ms) |
| Ocasional | Confirmaciones en el lugar («¿Eliminar…?») | Fundido de ~150 ms |
| Una vez | Contraseña temporal recién creada, primer ingreso | Un detalle que destaca, sin pasar de 400 ms |

- Nada dura más de 300 ms, salvo los momentos de una sola vez.
- Las curvas son de salida rápida (`cubic-bezier(0.23, 1, 0.32, 1)`); nunca se usa
  `ease-in`.
- Con «reducir movimiento» activado en el sistema operativo, todo queda sin
  animación.

### Lo que queda fijo al desplazarse (31-oct, propuesta de Dirk)

| Dónde | PC | Celular | Por qué |
|---|---|---|---|
| Encabezado marino (marca, usuario, «Cuenta») | Fijo arriba | Se va al bajar | En el celular ocuparía un octavo de la pantalla; la marca no hace falta mientras se trabaja |
| Menú de secciones | Fijo, debajo del encabezado | Fijo arriba | Es lo que se usa para cambiar de tarea desde cualquier punto de la página |
| Encabezado de las tablas | Fijo dentro de la tabla | Igual | Con 36 niveles o muchos inscritos, no se pierde qué es cada columna |
| Botones de formularios largos (Registrar estudiante, Abrir grupo) | En su lugar | Fijos abajo | El botón principal queda a mano sin bajar hasta el final |
| Aviso de privacidad | Botón al final | Botón al final | **A propósito no fijo:** el consentimiento va después de leer |

- Fondo **sólido**, no transparente: en una pantalla de datos, el texto que pasa
  por detrás de una barra semitransparente le quita contraste y distrae.
- Al bajar, el menú toma una sombra leve que indica que hay contenido debajo. La
  calcula el navegador según el desplazamiento, sin JavaScript; donde no hay
  soporte, la sombra simplemente no aparece.
- `scroll-padding-top` evita que un ancla quede tapada por lo fijo.

### Skills de diseño instaladas

En `.claude/skills/`, junto a `spec-generator`:

- **De Emil Kowalski** (MIT): `emil-design-eng`, `find-animation-opportunities`,
  `review-animations`, `animation-vocabulary`, `mobile-native`, `break-ui`,
  `pick-ui-library` y `ask-sonner`.
- **De Impeccable** (Apache 2.0): solo las instrucciones y las referencias, sin el
  modo en vivo. Su detector se ejecuta en la nube de trabajo con el motor
  verificado por SHA-256 y la telemetría apagada.
- **`marca-adei`**: skill propia con esta sección convertida en reglas.
- **Taste no se instala**: sortea estilos visuales al azar, lo que choca con un
  manual fijo, y prohíbe convenciones que el sistema necesita.


# Tareas — Spec 001 Base y registro

**Estado:** en ejecución · bloques 0, 1 y 2 hechos; sigue el bloque 3
**Entrada:** `spec.md` (100 CE) · `plan.md`

Reglas (AGENTS.md): una tarea por vez, tests primero, suite en verde y se marca.
Dentro de un bloque se sigue con la siguiente tarea; se para al terminar el bloque,
cuando una tarea necesita la PC, cuando algo cambia la spec o el plan, o cuando algo
falla y no se arregla sin cambiar el criterio (modo por bloques, 2026-10-30). Cada tarea dice dónde se hace:

- **Aquí** — en la conversación con Claude: código, SQL y pruebas en PGlite.
- **PC** — en tu computadora: lo que necesita llegar a Supabase o a Vercel.

Cada tarea lleva una marca:

- **[demo]** — entra en el prototipo de la defensa.
- **[después]** — se programa después de la defensa (ver la propuesta al final).

---

## Bloque 0 — Preparación

- [x] **T0 · PC · [demo]** Crear en Supabase la organización `SIGFIE-ADEI` y el proyecto
  `sigfie-adei` (plan Free, región `East US (North Virginia)`, la misma de Vercel;
  sin exposición automática de tablas y con RLS automática, plan §5.5). Un solo
  proyecto hasta que haya datos reales (plan §11).
  Copiar `.env.example` a `.env.local` y llenar las claves **en tu PC, nunca en el
  chat**. Plan §11.
  - Hecho cuando: el proyecto aparece activo en el panel de Supabase y `.env.local`
    existe y `git status` no lo muestra.

- [x] **T1 · Aquí · [demo]** Esqueleto: Next.js 16 + TypeScript + Tailwind + Vitest;
  Montserrat desde `@fontsource/montserrat` (D16); tokens de color de ADEI; scripts
  `dev`, `build`, `test`; `.env.example` sin valores. Constitución 7, 9.
  - Hecho cuando: `npm run test` (un test de humo) y `npm run build` pasan, y
    `npx tsc --noEmit` no da errores.
  - **Hecho el 2026-10-29.** 15 tests en verde, `build` y `tsc` limpios. Extras:
    se desactivaron `cacheComponents` y `partialPrefetching` de la plantilla de
    Next 16, porque reutilizar una respuesta entre usuarios sería una fuga de
    datos de estudiantes (D17); se quitó la telemetría; `tests/dominio/contraste.test.ts`
    verifica el contraste leyendo `globals.css`, y detectó que el verde y el
    dorado de ADEI solo sirven de relleno (2.40:1 y 1.77:1 sobre blanco), no
    como marca con significado: para eso están `adei-fuerte` y `oro-fuerte`.

- [x] **T2 · Aquí · [demo]** Banco de pruebas de base: PGlite con `pg_trgm` y
  `unaccent`; esquema `auth` simulado (`auth.users`, `auth.sessions`, `auth.uid()`,
  `auth.jwt()`); función que aplica `supabase/migrations/` en orden; ayudante para
  actuar "como" un usuario con su rol y su sesión. Plan D12.
  - Hecho cuando: un test aplica una migración vacía, crea un usuario simulado y lee
    su `auth.uid()`.
  - **Hecho el 2026-10-29.** 11 pruebas del banco (26 en total), en verde. Además
    del criterio, el banco simula las dos casillas con que se creó el proyecto
    (RLS automática y sin exposición automática de tablas) y lo prueba. Hallazgo:
    con esa configuración **tampoco `service_role` recibe permisos solo**; ignorar
    RLS no es tener permiso. Cada tabla que use el servidor necesita también su
    `GRANT` a `service_role` (plan §5.5). Cada banco arranca de una plantilla
    copiada: 0.4 s en vez de 2.2 s.

## Bloque 1 — Lógica pura (no necesita Supabase)

- [x] **T3 · Aquí · [demo]** `dominio/texto.ts`, `cedula.ts`, `edad.ts`, `codigos.ts`.
  CE-36, CE-37, CE-42 (normalización), CE-76, CE-77, CE-29 y CE-48 (formato).
  - Hecho cuando: hay un test por CE citado, en verde, con la fecha inyectada.
  - **Hecho el 2026-10-29.** 63 pruebas nuevas (89 en total), en verde. Hallazgos:
    (1) contradicción entre CE-48 y CE-99 sobre el prefijo del código de grupo,
    resuelta en la spec: solo el código de estudiante lleva el prefijo; (2)
    `normalizar()` difería de `unaccent` de PostgreSQL en Ø, ß, Æ, Ł y Đ; se
    igualó y quedó una prueba que lo vigila. Decisión: la cédula sin guiones se
    rechaza, porque la spec pide el formato del diccionario.

- [x] **T4 · Aquí · [demo]** `dominio/contrasena.ts` y `superposicion.ts`.
  CE-8, CE-70, CE-84.
  - Hecho cuando: la contraseña temporal vence a las 72 h exactas con reloj
    inyectado, y dos inscripciones que se cruzan se detectan.
  - **Hecho el 2026-10-30.** 17 pruebas nuevas (106 en total), en verde. La
    contraseña temporal tiene 12 caracteres de un alfabeto sin 0/O/o/1/l/I y usa
    azar criptográfico sin sesgo de módulo; se comprobó que la prueba del sesgo
    falla con la versión ingenua (`byte % 56`). Supuesto de CE-84: dos modalidades
    distintas no chocan, porque los días de clase son texto libre en el catálogo;
    al ser solo una advertencia, se prefirió no avisar de más.

## Bloque 2 — Base de datos (cada migración con sus tests en PGlite)

- [x] **T5 · Aquí · [demo]** `001_utilidades.sql`: extensiones, `normalizar()`,
  `hoy_managua()`, `organizacion`, `mi_organizacion()`, `correlativo`.
  CE-29, CE-48, CE-77, CE-99, P8.
  - Hecho cuando: dos correlativos pedidos a la vez no se repiten, reinician al
    cambiar de año y van por separado para cada organización.
  - **Hecho el 2026-10-30.** 28 pruebas. Reinicio anual, separación por organización
    y por tipo, y que un rechazo no consume número: probados. **Dos pedidos a la
    vez no se pueden probar en PGlite** (una sola conexión): queda para T16. La
    garantía viene de `insert … on conflict do update … returning`, que bloquea la
    fila del correlativo. Hallazgo de seguridad: en PostgreSQL toda función nueva
    la puede ejecutar cualquiera (`PUBLIC`); se quitó ese permiso por defecto para
    todo el proyecto y cada función se habilita a propósito.

- [x] **T6 · Aquí · [demo]** `002_catalogos.sql`. CE-22, CE-23, CE-24, CE-25, CE-26,
  CE-27, CE-28, CE-74, CE-98.
  - Hecho cuando: "Intermediate I" y "  intermediate i " chocan en la misma
    organización y no chocan entre dos organizaciones.
  - **Hecho el 2026-10-30.** 20 pruebas. "Exactamente una sucursal central" se
    comprueba al final de la transacción, para poder cambiar cuál es la central.

- [x] **T7 · Aquí · [demo]** `003_cuentas.sql`. CE-5, CE-6, CE-9, CE-13, CE-69, CE-95.
  - Hecho cuando: la base rechaza quitarle el rol a la única Asistente activa y
    rechaza un profesor con dos cuentas.
  - **Hecho el 2026-10-30.** 17 pruebas. Las reglas que cruzan dos tablas (cuenta
    de profesor vinculada, última Asistente) se revisan al final de la transacción.

- [x] **T8 · Aquí · [demo]** `004_auditoria.sql`. CE-17, CE-19, CE-20.
  - Hecho cuando: cada cambio deja su fila con valor anterior y nuevo, y ni el rol
    con más privilegios de la app puede editar o borrar una fila de auditoría.
  - **Hecho el 2026-10-30.** 19 pruebas. La auditoría no se puede editar, borrar ni
    vaciar (`truncate`), ni con la clave de servicio. Los eventos que registra un
    usuario quedan siempre a su nombre: nadie puede registrar uno a nombre de otro.

- [x] **T9 · Aquí · [demo]** `005_estudiantes.sql` (`estudiante`, `tutor`,
  `estudiante_tutor`, columna `busqueda`, índice de trigramas). CE-30, CE-33 a
  CE-37, CE-41, CE-76, CE-81, CE-82.
  - Hecho cuando: un menor sin tutor no se puede guardar ni quedarse sin tutor, y
    el código ADEI no se puede modificar.
  - **Hecho el 2026-10-30.** 33 pruebas. CE-35 (teléfono del adulto) se exige solo al
    registrar, para que CE-80 pueda advertir sin bloquear al editar.

- [x] **T10 · Aquí · [demo]** `006_grupos.sql` (`grupo`, `inscripcion`, llaves
  compuestas con organización). CE-50, CE-56, CE-97.
  - Hecho cuando: una inscripción con estudiante y grupo de organizaciones
    distintas no se puede guardar.
  - **Hecho el 2026-10-30.** 12 pruebas. Se encontró y corrigió que una regla
    `check` deja pasar un valor vacío (`NULL`): la observación obligatoria se
    comprueba con `coalesce`.

- [x] **T11 · Aquí · [demo]** `007_permisos.sql`: `acceso_habilitado()`, `tiene_rol()`,
  `mi_profesor_id()` y las políticas RLS. CE-2, CE-15, CE-46, CE-52, CE-61, CE-62,
  CE-78, CE-94, CE-96, CE-100. Incluye el `GRANT` de cada tabla (plan §5.5).
  - Hecho cuando: hay un test por cada casilla de la matriz de permisos (plan §5.5)
    para los 4 usuarios de prueba y la segunda organización, incluidos los
    intentos prohibidos.
  - **Hecho el 2026-10-30.** 50 pruebas: la matriz completa, más pruebas de la
    propia seguridad (todas las tablas con RLS, ninguna función ejecutable sin
    sesión, y la lista exacta de funciones que un usuario puede ejecutar; si alguien
    agrega una función sin pensarlo, la prueba falla). Probado también: nadie puede
    darse un rol a sí mismo ni quitarse la marca de contraseña temporal.

- [x] **T12 · Aquí · [demo]** `008_operaciones.sql`, parte 1: `registrar_estudiante`,
  `actualizar_estudiante`, `vincular_tutor`, `desvincular_tutor`. CE-29, CE-31, CE-32,
  CE-38, CE-40, CE-79, CE-80.
  - Hecho cuando: un registro con coincidencia devuelve los candidatos sin
    insertar, y con la confirmación inserta y deja la decisión en la auditoría.
  - **Hecho el 2026-10-30.** 28 pruebas. El código lo pone la base al insertar; si la
    Asistente intenta mandarlo, se rechaza. Dos registros simultáneos con la misma
    cédula reciben la misma respuesta que CE-30 (se verifica de verdad en T16).
    Las auxiliares de las operaciones viven en un esquema `interno` que Supabase no
    publica: la API solo ofrece las operaciones. Se corrigió un error real que las
    pruebas encontraron en la advertencia de CE-80.

- [x] **T13 · Aquí · [demo]** `008_operaciones.sql`, parte 2: `abrir_grupo`,
  `cambiar_profesor`, `inscribir`, `anular_inscripcion`. CE-47 a CE-49, CE-51,
  CE-53 a CE-55, CE-57 a CE-59, CE-84, CE-91 a CE-93.
  - Hecho cuando: el motivo de cambiar el profesor y de anular una inscripción
    aparece en la auditoría.
  - **Hecho el 2026-10-30.** 23 pruebas. Además: la confirmación de una
    superposición (CE-84) también queda en la auditoría, y el motivo de una
    operación no se filtra a la siguiente.

- [x] **T14 · Aquí · [demo]** `008_operaciones.sql`, parte 3: `buscar_estudiantes`,
  `aceptar_aviso`. CE-16, CE-18, CE-42 a CE-44, CE-46, CE-85.
  - Hecho cuando: "gutierrez" encuentra "Gutiérrez", la página trae el total real, y
    la búsqueda negada a un profesor **queda registrada** en la auditoría.
  - **Hecho el 2026-10-30.** 14 pruebas. Los comodines `%` y `_` que alguien escriba
    se buscan como texto (sin esto, "%%%" devolvía a todos); se comprobó que la
    prueba falla si se quita esa protección. Los resultados y el total salen de una
    sola consulta, así que no pueden no coincidir.

- [x] **T15 · Aquí · [demo]** `009_semilla.sql` (ADEI, sus sucursales, modalidades,
  horarios y niveles; sin profesores ni estudiantes) y el generador de 20,000
  estudiantes sintéticos. CE-45.
  - Hecho cuando: una búsqueda sobre 20,000 estudiantes en PGlite usa el índice de
    trigramas (se ve en `EXPLAIN`) y tarda menos de 2 s.
  - **Hecho el 2026-10-30.** 14 pruebas. Con 20,000 estudiantes la búsqueda tarda
    entre 5 y 44 ms. **El criterio de `EXPLAIN` se ajustó:** con 20,000 filas el
    planificador recorre la tabla porque tarda lo mismo que el índice (~7 ms); la
    prueba comprueba que el índice es aplicable a la consulta, no que se elija.
    Hallazgo: con RLS activa, PostgreSQL no puede usar el índice de trigramas
    (LIKE no es *leakproof*). Se resolvió con un paso previo
    (`interno.estudiantes_que_coinciden`) que filtra con el índice y repite los
    filtros de la política; las filas se leen después con RLS, así que un error en
    ese paso solo podría ocultar resultados, nunca mostrar ajenos.
    Semilla **provisional** hasta que Doña Aura la valide: 20 niveles de adultos
    reconstruidos de las 94 variantes de 2021, Principiante 1 a 16 (niños), sin el
    resto del catálogo infantil; días de la modalidad Diario; direcciones solo con
    el sector; aviso de privacidad borrador v0.1. Las pruebas no cargan la semilla
    salvo la de T15.

- [x] **T16 · PC · [demo]** Aplicar las migraciones al proyecto `sigfie-adei`,
  generar los tipos de TypeScript y verificar Supabase real con
  `npm run verificar:supabase`. CE-12.
  - Hecho cuando: `src/tipos/base-de-datos.ts` existe y el script termina en "Todo
    en orden": RLS y permisos como en PGlite, correlativos pedidos a la vez sin
    repetirse, ninguna contraseña legible y la auditoría sin filas nuevas.
  - **Criterio cambiado el 2026-10-30 (decisión de Dirk).** Antes decía "correr
    `tests/bd` contra Supabase real". `sigfie-adei` es el único proyecto y será el de
    producción, y la auditoría no se puede borrar: la suite dejaría para siempre
    organizaciones y usuarios ficticios. El script solo lee, trabaja en
    transacciones que se deshacen o con el año ficticio 2999 (sin auditoría), y
    comprueba al final que no quedó rastro. Se probó contra un PostgreSQL 16 real
    con las 9 migraciones, y se comprobó que falla con un correlativo ingenuo.
  - **Hecho el 2026-10-30.** Migraciones 001–009 aplicadas a `sigfie-adei`
    (PostgreSQL 17.11), tipos generados (`src/tipos/base-de-datos.ts`) y
    `npm run verificar:supabase` en "Todo en orden": RLS en todas las tablas, nada
    ejecutable ni legible sin sesión, la lista exacta de funciones del usuario,
    correlativos sin repetirse desde 4 conexiones a la vez (100 de 100) y con
    bloqueo real entre transacciones, auditoría sin filas nuevas (56 → 56, las de
    la semilla). CE-12 queda en 0 cuentas: se repite al crear la primera (T17+).
    Revisado en el panel: la API publica solo `public` y `graphql_public`
    (`interno` no está expuesto).

## Bloque 3 — Aplicación

- [x] **T17 · Aquí · [demo]** Ingreso: Server Action que resuelve el usuario al correo
  de Auth (plan §4.4), verifica estado y contraseña temporal, y registra Acceso o
  Denegación. CE-1, CE-3, CE-4, CE-18.
  - Hecho cuando: los tests de la acción, con Supabase simulado, cubren los 4 CE.
  - **Hecho el 2026-10-30.** `servidor/ingreso.ts` con dependencias inyectadas y
    `tests/app/ingreso.test.ts`: mismo mensaje para usuario inexistente y
    contraseña mala (CE-3), cuenta inactiva (CE-4), destino a cambio de contraseña
    o aviso, y cierre de sesión si el acceso no se puede auditar (CE-20). Migración
    `010_sesion_app.sql` (`mi_estado_acceso()`) con `tests/bd/t17-estado-acceso.test.ts`.
    Verificado además contra un Supabase local completo (Auth + PostgREST): GoTrue
    acepta los correos internos `.invalid`.

- [x] **T18 · Aquí · [demo]** `proxy.ts` y pantallas de aviso y de cambio de
  contraseña; borrador v0.1 del aviso (P4). CE-9, CE-14, CE-15, CE-16, CE-78, CE-87.
  - Hecho cuando: sin aviso aceptado ninguna ruta del sistema responde, y la
    pantalla del aviso no tiene desplazamiento horizontal a 360 px.
  - **Hecho el 2026-10-30.** `proxy.ts` aplica `dominio/acceso.ts` (`decidirRuta`,
    con tests). Recorrido en navegador: con temporal no se puede saltar a otra
    ruta, sin aviso aceptado `/inicio` vuelve a `/aviso`, y a 360 px el desborde
    horizontal es 0 en ingreso, contraseña y aviso.

- [x] **T19 · Aquí · [demo]** Diseño base: navegación por rol, tipografía, colores
  y tabla densa reutilizable. Constitución 9.
  - Hecho cuando: cada rol ve solo su menú y la tabla cumple el contraste mínimo.
  - **Hecho el 2026-10-31, con la identidad oficial** (plan §14, constitución
    principio 9 enmendado): marino, paleta del manual, Montserrat + Libre
    Baskerville, emblema en vector, movimiento con `motion` y `sonner`. Menú por
    rol desde la misma tabla que `proxy.ts`. `tests/dominio/contraste.test.ts`
    mide 24 combinaciones. El detector de Impeccable no encontró anti-patrones,
    salvo «Montserrat es una letra muy usada», que se acepta porque la marca manda.

- [x] **T20 · Aquí · [demo]** Cuentas: crear, asignar roles, desactivar, restablecer
  con contraseña temporal. CE-5 a CE-8, CE-13, CE-83.
  - Hecho cuando: la contraseña temporal se muestra una sola vez y desactivar una
    cuenta corta el acceso en la consulta siguiente.
  - **Hecho el 2026-10-30.** `servidor/cuentas.ts` con tests. La temporal se
    muestra una vez con «Copiar»; desactivar pide confirmación y, en el recorrido,
    la cuenta desactivada es expulsada a `/ingresar?motivo=cuenta` en su siguiente
    pedido. `scripts/crear-primera-asistente.mts` para la primera cuenta.

- [x] **T21 · Aquí · [demo]** Catálogos. CE-21 a CE-28, CE-74, CE-75.
  - Hecho cuando: no hay ningún campo de texto libre para nivel, modalidad,
    horario, profesor ni sucursal, y un profesor homónimo pide confirmación.
  - **Hecho el 2026-10-30.** Todo se elige de listas. El profesor homónimo pide
    confirmación (CE-75) y el código de nivel repetido se rechaza (CE-74), los dos
    verificados en el navegador. Eliminar pide confirmación; si está en uso,
    ofrece desactivar.

- [x] **T22 · Aquí · [demo]** Registro y edición de estudiantes con tutores y
  coincidencias. CE-29 a CE-41, CE-79 a CE-82.
  - Hecho cuando: el flujo completo de un menor con tutor nuevo y de un hermano con
    el mismo tutor funciona contra PGlite.
  - **Hecho el 2026-10-30.** `tests/app/t22-flujo-estudiantes.test.ts` contra
    PGlite y recorrido en el navegador: adulto, menor con tutor nuevo, hermano con
    el mismo tutor (encontrado por cédula) y cédula repetida (muestra el
    expediente). Si el formulario falla se conserva todo lo escrito, incluidas las
    listas elegidas (corregido: React 19 las vaciaba).

- [x] **T23 · Aquí · [demo]** Búsqueda. CE-42 a CE-46, CE-73, CE-85.
  - Hecho cuando: busca al dejar de escribir y muestra "0 resultados" explícito.
  - **Hecho el 2026-10-30.** Busca 300 ms después de dejar de escribir; muestra
    «0 resultados para «…»» con una sugerencia; en el celular, los resultados son
    tarjetas en lugar de tabla.

- [x] **T24 · Aquí · [demo]** Grupos e inscripciones. CE-47 a CE-60, CE-84, CE-91 a CE-93.
  - Hecho cuando: al elegir una modalidad solo se ofrecen sus horarios, y las
    advertencias de superposición piden confirmación.
  - **Hecho el 2026-10-30.** Verificado en el navegador: Sabatino ofrece solo
    sus 3 horarios. `tests/app/t24-grupos.test.ts` cubre la superposición con
    confirmación. Desde el expediente, «Inscribir en un grupo» lleva al grupo
    con el estudiante ya buscado.

- [ ] **T25 · PC · [demo]** Primer despliegue en Vercel (vista previa) conectado a
  `sigfie-adei`.
  - Hecho cuando: la app abre desde un celular, se puede ingresar y buscar.

- [ ] **T26 · PC · [demo]** Lista de comprobación manual de la spec (14 renglones).
  - Hecho cuando: los renglones de los CE [demo] están firmados.

## Bloque 4 — Diferidas [después]

- [ ] **T27 · Aquí · [después]** Bloqueo por intentos (`dominio/bloqueo.ts` + Server
  Action). CE-63 a CE-68.
- [ ] **T28 · Aquí · [después]** Sesión: inactividad, aviso y 12 h (`dominio/sesion.ts`
  + `proxy.ts` + la condición de 12 h en `acceso_habilitado()`). CE-88 a CE-90.
- [ ] **T29 · PC · [después]** Restablecimiento por correo con SMTP gratuito. CE-10,
  CE-11, CE-71, CE-72.
- [x] **T30 · Aquí · [después]** Edición simultánea con `version`. CE-86.
  - **Adelantada en el bloque 3:** `actualizar_estudiante` compara `version`, y el
    formulario de edición avisa que otra persona cambió el expediente sin borrar
    sus cambios.

**Propuesta para no romper la constitución.** El principio 12 dice que una spec se
cierra validada antes de abrir la siguiente. Si la 001 se queda con 16 criterios sin
hacer mientras se abren la 002 y la 003, se rompe. Propuesta: mover T27 a T30 (CE-10,
CE-11, CE-63 a CE-68, CE-71, CE-72, CE-86, CE-88 a CE-90) a una **spec 004
"Endurecimiento del acceso"**. Así la 001 cierra con 84 criterios validados y la 004
se hace después de la defensa. Los 16 criterios no se pierden: cambian de spec.

---

## Bloque 5 — Entrega: historial, guía de uso y evidencias de seguridad [demo]

Agregado el 2026-10-31 a pedido de Dirk. No cambia el comportamiento del sistema:
documenta y pone a prueba lo construido. Si una prueba encuentra algo que exige
cambiar el sistema (por ejemplo, cabeceras de seguridad), el cambio entra primero
en la spec, como cualquier otro.

- [x] **T31 · PC · [demo]** Historial de commits. Un commit por bloque, con
  Conventional Commits (`docs:`, `feat(bd):`, `feat(app):`, `chore:`…), y primer
  push a `DirkLackut/SIGFIE-ADEI`.
  - Hecho cuando: `git log` cuenta la historia del proyecto en orden (constitución,
    spec, bloques 0 a 3); antes de cada commit se verificó que no entra ningún
    `.env*`, `.xlsx` o `.csv` ni ninguna clave; el repositorio público abre en
    GitHub con el README.
  - **Hecho el 2026-10-31** con Claude Code en la PC: 9 commits en `main`, del
    «Initial commit» a `feat(marca)`. Antes del push se verificó que no entrara
    ningún secreto, `.env*`, `.xlsx` ni `.csv`, que las 25 cédulas de las pruebas no
    coincidieran con las de los Excel (0 coincidencias), y se corrieron las pruebas
    (462 en verde), `tsc` y `npm audit --omit=dev` (0). Los commits usan el correo
    privado de GitHub (`…@users.noreply.github.com`): el historial se reescribió
    una vez, el mismo día, antes de conectar Vercel, para no publicar el correo
    institucional.

- [ ] **T32 · Aquí · [demo]** Guía de uso en el README, desde cero: qué es el
  sistema; cómo recibe cada persona su usuario y su contraseña temporal; primer
  ingreso, cambio de contraseña y aviso; y cada tarea por rol (Asistente,
  Dirección, Profesor), en PC y en celular.
  - Capturas anotadas con números y flechas sobre la imagen, generadas con
    Playwright contra la copia local con **datos sintéticos**. Clips cortos en GIF
    (5–10 s) para los flujos de varios pasos: registrar un menor con tutor e
    inscribir desde el expediente. Imágenes en `docs/guia/`.
  - Hecho cuando: una persona que nunca vio el sistema puede seguir la guía sola;
    ninguna imagen tiene datos reales; cada GIF pesa menos de 3 MB; el README se ve
    bien en GitHub.

- [x] **T33 · Aquí · [demo]** Plan de pruebas de seguridad
  (`docs/seguridad/plan.md`): cada categoría del OWASP Top 10 vigente relacionada
  con la prueba que la cubre, la herramienta, el entorno y el resultado esperado.
  Incluye lo que ya cubren las pruebas automáticas (RLS, permisos, aislamiento
  entre organizaciones, bcrypt) y declara lo que está fuera de alcance (bloqueo
  por intentos, en la spec 004).
  - Hecho cuando: cada categoría tiene prueba o una razón escrita de por qué no
    aplica.

- [x] **T34 · Aquí · [demo]** Ejecución automática de las pruebas de seguridad,
  **solo contra la copia local con datos sintéticos, nunca contra `sigfie-adei`**:
  - colección de Postman ejecutada con Newman (informe HTML): acceso sin sesión,
    rol Dirección intentando escribir, profesor leyendo grupos ajenos, otra
    organización, inyección SQL en la búsqueda, XSS en nombres, mensajes de error
    que no revelan si un usuario existe;
  - OWASP ZAP: escaneo pasivo y escaneo activo;
  - capturas de evidencia y `docs/seguridad/resultados.md`, con la explicación
    de cómo se usó cada herramienta (qué es, qué se configuró, contra qué se
    ejecutó y cómo leer su resultado), redactada para el documento del curso.
  - *2026-10-31, decisión de Dirk:* no se repiten las pruebas a mano en Postman
    contra la vista previa; Newman y ZAP dejan la evidencia.
  - Hecho cuando: cada prueba del plan tiene su resultado con evidencia, y cada
    hallazgo tiene una respuesta (corregido por la spec, aceptado con razón, o
    diferido).
  - *2026-11-01, hecho:* el plan sigue el OWASP Top 10:2025. Se usaron Newman 6.2.3
    (79 peticiones y 107 comprobaciones) y ZAP 2.17.0, con línea base y escaneo
    completo con sesión, antes y después de corregir. Hubo 3 hallazgos, los tres
    corregidos:
    - H1, encabezados: CE-102, CE-103 y D23.
    - H2, 500 en «no existe»: CE-101, D22 y la migración 011.
    - H3, versiones exactas.

    Las alertas de ZAP que quedan están justificadas en `docs/seguridad/resultados.md`.
    **Falta en producción:** aplicar la migración 011 con `npx supabase db push`
    antes o junto con el despliegue.

## Trazabilidad: criterios por tarea

Los 100 CE de la spec aparecen en al menos una tarea (comprobado con un script el
2026-10-29; el CE-12 faltaba y se agregó a T16).

> **2026-11-01, prueba manual 12:** el campo de fecha dejaba teclear años de seis cifras y el servidor los aceptaba. Se añadió CE-50a a la spec, `src/dominio/fechas-grupo.ts` con sus pruebas, límites `min`/`max` en los campos de fecha, y la marca «✓ Ya inscrito» en la búsqueda para inscribir.

# Tareas — Spec 003 Consulta y reportes

Se ejecutan por bloques, igual que la 001 y la 002: dentro de un bloque se sigue sin
parar; se para al terminar el bloque, cuando una tarea necesita la PC, cuando algo
cambia la spec o el plan, o cuando algo falla sin arreglo dentro del criterio.
Pruebas primero: se escriben, se ven fallar y después se implementa.

**Aquí** = en la nube de trabajo, con PGlite y la copia local. **PC** = en la
computadora de Dirk.

## Bloque A — Base de datos (`014_consulta_y_reportes.sql`, con pruebas en PGlite)

- [x] **T1 · Aquí** Parte 1: `factura`, `factura_estudiante`, tipo «Incidente», RLS,
  auditoría y las operaciones de facturas. CE-52 a CE-66. Prueba: `t24-facturas`.
- [x] **T2 · Aquí** Parte 2: `cambiar_estado_matricula`. CE-67 a CE-74. Prueba:
  `t25-estado-matricula`.
- [x] **T3 · Aquí** Parte 3: `filtrar`, con las dos vistas, la coherencia de criterios,
  la completitud y el incidente. CE-1 a CE-19, CE-21, CE-24, CE-25, CE-28. Prueba:
  `t22-filtrado`.
- [x] **T4 · Aquí** Parte 4: `historial_academico` y `hoja_matricula`. CE-36 a CE-51.
  Prueba: `t23-historial-y-matricula`.
- [x] **T5 · Aquí** Parte 5: `panel_actas`, `reporte_sucursales`, `bitacora` y
  `respaldo`. CE-31 a CE-35, CE-75 a CE-94. Prueba: `t26-panel-y-reporte` y
  `t27-bitacora-y-respaldo`.
- [x] **T6 · Aquí** Rendimiento con 20,000 estudiantes y 20,000 inscripciones, y los
  conteos por modalidad. CE-20, CE-21. Prueba: `t28-rendimiento-003`. Lista de
  funciones en `t11-permisos` y en `scripts/verificar-supabase.mts`.

> Bloque A cerrado el 2026-11-02: 727 pruebas en verde (48 archivos), `tsc` y `eslint`
> limpios. Pruebas escritas primero y vistas fallar (sin la 014, t24 y t25: 31 de 32 en
> rojo). Rendimiento en PGlite con 20,000 estudiantes y 20,000 inscripciones: el filtrado
> más lento tarda 1.2 s (estado académico), exportar las 20,000 filas 2.0 s y el
> respaldo 2.1 s con 31 MB de JSON, que se mide ya comprimido en T8 y T20. Cambios al
> plan: todas las funciones son `security definer` (§4); `filtrar` recibe `p_destino`
> en lugar de `p_todo`, para registrar si fue pantalla, exportación o impresión (CE-28).
> En la base, un trigger impide cambiar el estado de matrícula sin una fecha válida o
> mover la fecha sin cambiar el estado (principio 1); `t13` ahora usa la fecha de
> Managua para su dato de prueba. Anular una inscripción con factura deja la factura sin
> inscripción (`on delete set null`).

## Bloque B — Dominio puro

- [x] **T7 · Aquí** `dominio/filtro.ts`: criterios ↔ dirección de la página, coherencia
  para avisar en pantalla, descripción de los criterios en palabras. CE-6 a CE-8,
  CE-22, CE-23, CE-26.
- [x] **T8 · Aquí** `dominio/xlsx.ts` con `fflate` (versión consultada con `npm view`):
  hojas, tipos de celda, encabezado de la exportación. CE-24, CE-26, CE-30, CE-32.
- [x] **T9 · Aquí** `factura.ts`, `estado-matricula.ts`, `periodo.ts`, `enmascarar.ts`
  y `hoja-matricula.ts`. CE-46, CE-47, CE-53, CE-55 a CE-57, CE-69, CE-76, CE-83, CE-94.

> Bloque B cerrado el 2026-11-02. Pruebas escritas primero: `filtro`, `xlsx`, `exportacion`,
> `factura-y-estado` y `hoja-matricula`; los casos de enmascarado se comparten con la base
> (`tests/apoyo/vectores-enmascarar.ts`, como las notas en la 002). `fflate` 0.8.3 instalado
> con la versión de `npm view`; `npm audit --omit=dev`: 0 vulnerabilidades. Un archivo real
> se abrió con openpyxl y LibreOffice: tipos de celda, rojo, encabezado fijo y autofiltro
> como en la maqueta. Medido con 20,000 (`t28`): listado en Excel 1.6 MB; respaldo 8.1 MB,
> más que los 4.5 MB que responde Vercel Hobby, así que el respaldo se arma en el
> navegador (plan §6). Se agregó `dominio/exportacion.ts` (qué lleva cada archivo).

## Bloque C — Pantallas (antes, la skill `marca-adei`)

- [x] **T10 · Aquí** `/consultas`: criterios, vistas, total, páginas, «0 resultados».
  CE-1 a CE-23, CE-96.
- [x] **T11 · Aquí** Exportar e imprimir el resultado. CE-24 a CE-30, CE-98.
- [x] **T12 · Aquí** Historial académico en el expediente, con exportar e imprimir.
  CE-36 a CE-43.
- [x] **T13 · Aquí** Hoja de matrícula prellenada. CE-44 a CE-51, CE-98.
- [x] **T14 · Aquí** Facturas en el expediente y en la inscripción del grupo. CE-52 a CE-66.
- [x] **T15 · Aquí** Cambio de estado de matrícula. CE-67 a CE-74.
- [x] **T16 · Aquí** Panel de entrega de actas `/panel-actas`. CE-75 a CE-80.
- [x] **T17 · Aquí** Reporte por sucursal `/reportes`. CE-81 a CE-88.
- [x] **T18 · Aquí** Bitácora `/bitacora` y respaldo `/respaldo`. CE-31 a CE-35, CE-89 a CE-94.
- [x] **T19 · Aquí** Menú, `dominio/acceso.ts` y capa de datos contra PGlite
  (`t29-consultas`). CE-18, CE-95, CE-97.

> Bloque C cerrado el 2026-11-02: 812 pruebas en verde (55 archivos), `tsc`, `eslint` y
> `next build` limpios. Capa de datos probada contra PGlite (`t29-consultas`) y rutas por
> rol en `acceso.test.ts`. Prueba de humo en la copia local con datos inventados
> (`/tmp/claude-0/e2e/humo-003.cjs`): 25 comprobaciones, 0 errores del navegador; el
> Excel exportado y el respaldo (armado en el navegador) se descargan; Dirección no entra
> al respaldo, la Asistente no entra a la bitácora y el profesor no entra a consultas;
> sin desplazamiento lateral a 360 px. Cambios al plan: el panel va en `/panel-actas`;
> el historial impreso, en carta horizontal; la factura se registra desde el expediente
> (el enlace «Factura…» del grupo abre ese formulario con la inscripción ya elegida, CE-61);
> el historial devuelve también los otros estudiantes que ampara cada factura, para poder
> corregirla sin perderlos. El recorrido completo, Impeccable y Newman son el Bloque D.

## Bloque D — Verificación y entrega

- [x] **T20 · Aquí** Recorrido E2E en la copia local, incluido 360 px, medición del
  respaldo (tamaño y tiempo, plan §6), y revisión de Impeccable sobre las pantallas nuevas.
> T20 (2026-11-02): recorrido automático en la copia local con datos inventados, como
> Asistente, Dirección y profesor: 46 comprobaciones en orden, 0 errores del navegador, sin
> desplazamiento lateral a 360 px en las siete pantallas nuevas. Hallazgo corregido: un
> respaldo con una hoja vacía (por ejemplo, Tutores sin filas) salía con un rango «A1:1» y
> Excel lo daba por dañado; ahora la hoja lleva el título «Sin registros» (pruebas
> escritas primero en `xlsx.test.ts` y `exportacion.test.ts`, vistas fallar). Respaldo
> medido con 20,000 estudiantes, 20,000 inscripciones y 48,000 parciales inventados: 16
> hojas, 8.1 MB, 6.8 s en el navegador y 22.8 s con el procesador frenado 4 veces (una PC
> de oficina lenta); el botón avisa «puede tardar un minuto». Impeccable `detect` (91
> avisos): «cramped padding» y «card inside card» son el patrón de tabla en sección de la
> 001 y la 002, sin cambio; Montserrat aceptada (marca-adei); «border accent on rounded»
> es la raya del encabezado impreso, que no tiene esquinas redondeadas (falso positivo);
> las rayas «—» de la vista Estudiantes marcan celdas vacías de la tabla, no texto
> corrido, sin cambio.
- [x] **T21 · Aquí** Carpeta «003» de la colección de Newman contra la copia local.

> T21 (2026-11-02): carpeta «003 · Consulta y reportes», 47 peticiones: cada función nueva
> por rol, otra organización, criterios manipulados, escritura directa en las tablas de
> facturas y la bitácora de las negaciones. Colección completa con 001 a 014: 150
> peticiones, 234 comprobaciones, 0 fallos. Hallazgo corregido en la 014: una factura con
> monto negativo o moneda inventada devolvía la fila rechazada con identificadores
> internos; ahora la función revisa cada campo antes y responde con el mensaje de la
> regla (pruebas primero en `t24-facturas` y `errores.test.ts`). `docs/seguridad/resultados.md` §11.
- [ ] **T22 · PC** Rama `spec/003-consulta-y-reportes`, `npx supabase db push --linked`
  (014), `npm run tipos`, `npm run verificar:supabase`, Pull Request y despliegue.
- [ ] **T23 · PC** Lista de comprobación manual de la spec (17 renglones), con evidencia.

> T23 (2026-11-03, en producción, capturas hechas por Claude en el navegador integrado; Dirk
> inició sesión en cada cuenta). Evidencia en `evidencias\spec-003\pruebas-manuales\` con su
> `INDICE.md`. Los 17 renglones dieron lo esperado salvo el 6 (y el historial impreso):
> **hallazgo 1**, el listado salía en carta vertical y cortado. Además: **hallazgo 2**, el
> profesor que abre una pantalla ajena por su dirección no quedaba en la bitácora (CE-18,
> también 001·CE-46; la base sí registra cuando se le pide por la API); **hallazgo 3**,
> «Copiar» la contraseña temporal no hacía nada cuando el navegador negaba el portapapeles
> (001·CE-8). Se corrigen en T24 y T25 y se vuelven a comprobar en producción.

## Bloque E — Correcciones de T23

- [x] **T24 · Aquí** Hallazgos 1 a 3, pruebas primero.
- [ ] **T25 · PC** Rama `fix/003-t23`, Pull Request y despliegue; volver a comprobar en
  producción los renglones 6 y 7, el historial impreso y «Copiar».

> T24 (2026-11-03). Hallazgo 1: `/tmp/claude-0/e2e/impresos-003.cjs` imprime a PDF en la
> copia local 59 inscripciones con nombres de 48 caracteres, 40 estudiantes y un historial de
> 20 niveles; antes, 11 de 15 comprobaciones en rojo (carta vertical, filas fuera de la hoja,
> una hoja vertical en blanco al final), después 15 de 15 (plan §5c). Hallazgo 2:
> `decidirRuta` marca la negación por rol con la ruta (`acceso.test.ts`, visto fallar) y
> `proxy.ts` la registra como «Denegación» de «pantalla» al abrir la página; las precargas de
> Next no cuentan (`negacion-003.cjs`: 3 de 3). Hallazgo 3: `dominio/portapapeles.ts`
> (`portapapeles.test.ts`, visto fallar): si el portapapeles se niega, copia con la selección,
> y si tampoco puede deja la contraseña seleccionada y pide copiarla con Ctrl+C
> (`copiar-003.cjs`: 3 de 3). 820 pruebas en verde, `tsc` y `eslint` limpios, recorrido
> completo 46 de 46 sin errores del navegador.
> Al recomprobar en producción (PR #5), la tabla del listado de inscripciones llegaba casi al
> borde de la hoja, fuera del margen de 12 mm que las impresoras sí respetan. Se agregó a
> `impresos-003.cjs` la comprobación «la tabla cabe entre los márgenes» (vista fallar) y el
> listado junta «Grupo y nivel» y «Horario y profesor» en dos columnas: cada fila ocupa dos
> líneas y caben las 16 por hoja (18 de 18 comprobaciones).

## Trazabilidad: criterios por tarea

| CE | Tareas |
|---|---|
| CE-1 a CE-19 | T3, T7, T10 |
| CE-20, CE-21 | T3, T6 |
| CE-22, CE-23 | T7, T10 |
| CE-24 a CE-30 | T3, T8, T11 |
| CE-31 a CE-35 | T5, T8, T18 |
| CE-36 a CE-43 | T4, T12 |
| CE-44 a CE-51 | T4, T9, T13 |
| CE-52 a CE-66 | T1, T9, T14 |
| CE-67 a CE-74 | T2, T9, T15 |
| CE-75 a CE-80 | T5, T9, T16 |
| CE-81 a CE-88 | T5, T9, T17 |
| CE-89 a CE-94 | T5, T9, T18 |
| CE-95 a CE-98 | T19, T11, T13, T20, T21 |

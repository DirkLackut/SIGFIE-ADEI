# Clarificación — Spec 003 Consulta y reportes

**Fecha:** 2026-11-02 · **Estado:** cerrada · 21 de 21 resueltos

Revisión del borrador de la spec. Por decisión de Dirk (2026-11-01), las dudas no se
preguntan: se resuelven por lógica con lo que dicen el SRS, la cliente, los datos de
2021 y las specs 001 y 002. Cada resolución queda aquí para que se pueda revisar.

## 1. Ambigüedades

- **A1** · CE-2, CE-3 — HU-04 dice «filtrar **estudiantes**», pero DS-02 cuenta
  **inscripciones**, y el valor de control CA-05 (Diario 2,887, Sabatino 1,098…) son
  filas del registro de notas, una por nivel cursado. **Resuelto:** las dos vistas.
  Inscripciones responde a CA-05 y a «¿quién reprobó Intermediate I-I con tal
  profesor?»; Estudiantes responde a «¿cuántos activos tiene Las Colinas?». Un
  estudiante entra en la vista Estudiantes si tiene al menos una inscripción que
  cumple los criterios de inscripción; sin esos criterios, entran también los que
  no tienen inscripciones, porque si no, un recién registrado no aparecería nunca.
- **A2** · CE-4 — Hay dos sucursales: la del estudiante (de origen) y la del grupo
  (donde cursó ese nivel). **Resuelto:** cada vista usa la que corresponde a su
  renglón. Un renglón de inscripción es un nivel cursado en un grupo, y ese grupo
  está en una sucursal. Un renglón de estudiante es una persona, que pertenece a su
  sucursal. Así, el reporte por sucursal (CE-81) y la vista Estudiantes dan los
  mismos números (CE-88).
- **A3** · CE-5 — «Rango de fechas» ¿de qué fecha? **Resuelto:** de los grupos en
  curso dentro del rango, es decir, cuyo período se cruza con el rango. Es lo que la
  Asistente pregunta en la práctica («¿quiénes estuvieron en octubre?»). Usar solo
  la fecha de inicio dejaría fuera a quien empezó en septiembre y terminó en octubre.
- **A4** · CE-31 a CE-34 — ¿Qué entra en el respaldo y quién lo hace? **Resuelto:** lo
  hace la Asistente (RNF-08: «ejecutable directamente por la asistente de dirección»).
  Entran todos los datos académicos y de catálogo. No entran las cuentas, porque
  la Asistente no necesita contraseñas ni datos de acceso para reconstruir la
  información. Tampoco entra la bitácora, que solo puede leer Dirección
  (001·CE-94): meterla en el respaldo la abriría a la Asistente por otra vía.
- **A5** · CE-46, CE-47 — RF-18 dice que el dato inexistente se marca «sin registro»,
  pero la decisión de formatos (2-nov) dice que lo no registrado queda en blanco.
  **Resuelto:** son dos casos distintos. Si el sistema guarda ese dato y este
  estudiante no lo tiene, se imprime «sin registro». Si el sistema no guarda ese
  dato para nadie (escolaridad, foto…), queda una línea en blanco para llenarla a
  mano, como hoy.
- **A6** · CE-51 — ¿Puede Dirección imprimir la Hoja de matrícula? **Resuelto:** no. Es
  un formato de la secretaría con todos los datos personales y el tutor. Dirección
  ya ve el expediente en pantalla y no necesita sacarlo en papel (Ley 787,
  minimización).
- **A7** · CE-56 — El diccionario fija la confirmación de monto atípico en «más de
  US$200», pero las facturas también se cobran en córdobas (RN-14). **Resuelto:** el
  mismo umbral convertido a la tasa oficial del BCN, que está fija en 36.6243 C$ por
  dólar desde 2024 y se mantiene en 2026: C$7,325. El monto se guarda sin convertir
  (CE-58); la tasa solo decide cuándo preguntar.
- **A8** · CE-69, CE-70 — RF-13 pide «estudiante, nuevo estado **y fecha**», pero el
  diccionario dice que `fechaCambioEstado` «se asigna sola». **Resuelto:** el sistema
  propone hoy y la Asistente puede poner una fecha anterior, porque a menudo
  registra la deserción tiempo después de que pasó. No puede ser futura ni anterior
  al último cambio, para que el orden de los cambios tenga sentido. Además se agrega
  una observación opcional, porque «desertó» suele llevar un porqué.
- **A9** · CE-75, CE-76 — «Período» del panel de actas ¿de qué fecha? **Resuelto:** la de
  término del grupo, porque un acta se debe al terminar el nivel. El valor inicial es
  el mes en curso, porque los niveles terminan cada cuatro semanas.
- **A10** · CE-81 a CE-83 — RF-21 pide contar «por estado y sucursal» en un «período»,
  pero el estado es una foto de hoy, no algo que pase en un período. **Resuelto:** dos
  partes. Primero, el estado actual por sucursal (lo que pide HU-16). Segundo, los
  movimientos del período: estudiantes registrados, estudiantes que pasaron a
  Desertor y estudiantes que pasaron a Egresado. Esto responde la pregunta que
  registra la entrevista, «cuántos dejaron de venir este mes». Como el sistema guarda
  solo la fecha del **último** cambio de estado, un estudiante que desertó y volvió
  el mismo mes cuenta como Activo. Se acepta, porque eso es lo que es hoy.
- **A11** · CE-94 — La bitácora guarda los valores anteriores y nuevos completos,
  incluidas cédulas y teléfonos. **Resuelto:** se muestran enmascarados, con los
  últimos 4 caracteres visibles. Dirección necesita saber qué cambió y quién lo
  cambió, no copiar la cédula (Ley 787, minimización). En la base se guardan
  completos, porque la bitácora es inalterable (RN-15).

## 2. Contradicciones

- **C1** · CE-71 — Pasar a Desertor a un estudiante con una inscripción En curso:
  ¿se retira solo de su grupo? **Resuelto:** no. La 002 decide cómo sale alguien de
  un acta: retiro, baja por inasistencia o traslado, cada uno con su efecto en las
  notas (002·CE-37 a CE-41). Si el cambio de estado lo hiciera solo, se saltaría esas
  reglas. Por eso el sistema advierte y muestra las inscripciones, y la Asistente
  decide cada una en su acta.

## 3. Casos límite

- **L1** · CE-19 — Orden de los resultados. **Resuelto:** alfabético por apellidos y
  nombres sin distinguir tildes, igual que el acta (002); en Inscripciones, además,
  por fecha de inicio, para que los niveles de una persona queden seguidos y en orden.
- **L2** · CE-22 — Cambiar un criterio estando en la página 5. **Resuelto:** se vuelve a
  la página 1, porque la página 5 del resultado nuevo puede no existir; los demás
  criterios se conservan.
- **L3** · CE-26 — Un Excel exportado circula sin contexto. **Resuelto:** el archivo
  lleva arriba la fecha, quién lo exportó, los criterios y el total. Así nadie
  confunde un listado de octubre con uno de noviembre, y queda claro que es completo.
- **L4** · CE-30 — Excel convierte «001-010190-0001A» o «06» en otra cosa si los trata
  como números. **Resuelto:** los códigos van como texto, las fechas como fechas y las
  notas como números.
- **L5** · CE-42 — Una inscripción anulada por error ¿aparece en el historial?
  **Resuelto:** no. Anular es deshacer un error (001·CE-58); la persona nunca cursó
  ese nivel. La bitácora conserva todos sus datos (001·CE-59).
- **L6** · CE-49 — La Hoja de matrícula tiene un solo espacio para el tutor.
  **Resuelto:** se imprime el primer tutor vinculado y se indica cuántos más hay; los
  demás se ven en el expediente.
- **L7** · CE-62, CE-63 — Una factura registrada con un número equivocado. **Resuelto:**
  se corrige con motivo o se anula con motivo, igual que la inscripción hecha por
  error (001·CE-58). La bitácora conserva el valor anterior. No hay más estados de
  factura, porque el pago es no reembolsable («una vez matriculado, no hay
  devolución», factura impresa) y el sistema no lleva saldos.
- **L8** · CE-80 — Un grupo cambió de profesor a mitad del período. **Resuelto:** cuenta
  para el profesor actual, que es quien debe entregar el acta (001·CE-52).
- **L9** · CE-88 — Un número del reporte que no se puede comprobar es un número de
  confianza ciega, justo el problema de 2018. **Resuelto:** cada cifra del estado
  actual abre el filtrado que la produce, con el mismo total. Las cifras de
  movimientos no se enlazan, porque el filtrado no tiene un criterio de «fecha de
  cambio de estado».

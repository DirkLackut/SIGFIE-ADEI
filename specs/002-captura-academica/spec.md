# Spec 002 — Captura académica

**Estado:** terminada (2026-11-02): aprobada por Dirk («comienza entonces»), desplegada y con la lista de comprobación manual completa · clarificación cerrada
**Fecha:** 2026-11-01
**Requisitos del SRS que cubre:** RF-04, RF-05, RF-06, RF-07, RF-08 ·
RN-03, RN-04, RN-05, RN-10, RN-11, RN-12, RN-15, RN-24 · RF-15 (auditoría de lo nuevo) ·
RNF-02, RNF-05, RNF-06, RNF-10 · Anexo C (ambigüedades resueltas con la cliente)

## Contexto y objetivo

Es la segunda spec del núcleo y la que ataca el problema central del proyecto: hoy
el profesor llena a mano la Hoja de registro de notas, la entrega en papel y la
Asistente de Dirección la transcribe a Excel. Esa transcripción es la que produjo,
en 2021, notas finales sin registro del motivo (92 casos en que no se sabe por qué
se dividió entre 2 o entre 3), estados aprobado o reprobado aplicados a mano y sin
consistencia (entre 74.00 y 74.49, solo 8 de 14 en rojo), y un parcial de 769.

Después de esta spec, el profesor captura los parciales en su grupo desde el
teléfono o la computadora, el sistema calcula la nota final y el estado con la
regla vigente de ADEI, y el acta se entrega y se bloquea sin papel de por medio. La
Asistente ya no transcribe: revisa, autoriza las excepciones y decide los casos que
le corresponden.

Orden del núcleo: 001 Base y registro → **002 Captura académica** → 003 Filtrado con
verificación de completitud.

## Actores

- **Profesor** — consulta sus grupos, captura los parciales, avisa de quien dejó de
  asistir y entrega el acta.
- **Asistente de Dirección** — autoriza reprogramaciones, decide retiros, bajas y
  traslados, asigna el Condicionado, modifica actas entregadas y administra la regla
  de aprobación.
- **Dirección** — consulta las actas y la regla de aprobación, sin modificar nada.

## Casos de uso del SRS involucrados

CU-13 Consultar grupos asignados · CU-14 Registrar calificaciones · CU-15 Calcular
nota final y estado académico · CU-16 Entregar acta · CU-17 Modificar acta entregada ·
CU-05 Gestionar catálogos (la regla de aprobación) · CU-10 Inscribir estudiante en
grupo (solo la advertencia por antecedentes)

## Historias de usuario

- HU-13: Como profesor, quiero ver solo mis grupos asignados, para registrar las notas sin acceder a información de otros grupos.
- HU-14: Como profesor, quiero registrar las tres notas parciales de cada estudiante desde mi teléfono, para que el sistema calcule la nota final sin errores.
- HU-15: Como profesor, quiero entregar formalmente el acta de mi grupo, para que las notas queden registradas y no se modifiquen sin control.

## Criterios de aceptación (EARS)

Cada criterio declara el requisito o la regla del SRS que verifica. Los marcados
**Q1–Q6** responden a la entrevista de esta spec (2026-11-01) y son alcance nuevo
respecto al SRS: ver "Impacto en el documento del curso". Una referencia como
**001·CE-57** remite a un criterio de la spec 001.

### A. Grupos del profesor

- **CE-1** · *RF-04, RN-10* — CUANDO un usuario con rol Profesor abre sus grupos, EL SISTEMA mostrará únicamente los grupos en que es el profesor asignado.
- **CE-2** · *RF-04, CU-13* — EL SISTEMA mostrará de cada grupo su código, nivel, modalidad, horario, sucursal, fechas, estado del acta y cuántas inscripciones tienen sus tres parciales con condición definida respecto del total.
- **CE-3** · *CU-14 E3* — SI el profesor no tiene grupos asignados, ENTONCES EL SISTEMA se lo informará con un mensaje explícito.
- **CE-4** · *RF-04, RN-10, CU-14 E4* — SI un profesor intenta abrir el acta de un grupo que no tiene asignado, aunque la petición no pase por la interfaz, ENTONCES EL SISTEMA se lo negará y registrará la denegación.
- **CE-5** · *Q6, RNF-10* — EL SISTEMA mostrará al profesor, de cada estudiante de su acta, solo los nombres, los apellidos y el código ADEI.

### B. Captura de parciales

- **CE-6** · *RF-05* — CUANDO el profesor abre el acta de su grupo, EL SISTEMA presentará el encabezado del grupo y la lista de inscritos ya llenos, con los parciales que ya estén registrados.
- **CE-7** · *RF-05* — EL SISTEMA permitirá registrar, por cada inscripción, los parciales I, II y III, cada uno con su condición: Registrado, No presentado, Justificado o Reprogramado.
- **CE-8** · *RN-03, CU-14 E1* — SI el valor de un parcial no es un número entero entre 0 y 100, ENTONCES EL SISTEMA lo rechazará indicando la regla, sin borrar lo demás que se haya escrito.
- **CE-9** · *RN-03* — SI la condición de un parcial es Registrado o Reprogramado, ENTONCES EL SISTEMA exigirá su valor.
- **CE-10** · *RN-04* — SI la condición de un parcial es No presentado o Justificado, ENTONCES EL SISTEMA no le aceptará un valor escrito.
- **CE-11** · *CU-14 A3* — CUANDO el profesor guarda los parciales de un estudiante, EL SISTEMA los conservará aunque el profesor salga antes de terminar el acta, y el acta seguirá Abierta.
- **CE-12** · *CU-14, 001·CE-86* — SI los parciales de una inscripción fueron modificados por otra sesión después de que el profesor abrió el acta, ENTONCES EL SISTEMA no sobrescribirá esos cambios y le avisará.
- **CE-13** · *RN-12* — SI la inscripción está Retirada o Trasladada, ENTONCES EL SISTEMA no permitirá registrarle parciales.

### C. Nota final

- **CE-14** · *RF-06, RN-04* — EL SISTEMA calculará la nota final como el promedio de los parciales Registrados, Reprogramados y No presentados, contando cada No presentado como 0 y excluyendo los Justificados.
- **CE-15** · *RF-06, RN-04* — EL SISTEMA no permitirá escribir la nota final: solo la calcula.
- **CE-16** · *RF-06, RN-04* — MIENTRAS algún parcial de una inscripción no tenga condición, EL SISTEMA mostrará su nota final como Provisional e indicará qué parciales faltan.
- **CE-17** · *RN-05, Anexo C* — EL SISTEMA redondeará la nota final al entero más cercano, con las mitades hacia arriba, y usará ese entero para mostrarla y para decidir el estado académico.
- **CE-18** · *RN-04* — SI los tres parciales de una inscripción son Justificados, ENTONCES EL SISTEMA no calculará nota final e indicará que el caso debe decidirlo la Asistente como retiro.

### D. Estado académico y regla de aprobación

- **CE-19** · *RF-07, RN-05* — CUANDO una inscripción tiene nota final no provisional, EL SISTEMA le asignará el estado Aprobado si la nota redondeada alcanza la nota mínima de la regla, o Reprobado si no la alcanza.
- **CE-20** · *RN-05* — EL SISTEMA evaluará cada grupo con la regla de su programa y de su nivel que estaba vigente en la fecha de inicio del grupo, nunca con una posterior.
- **CE-21** · *RF-07* — MIENTRAS la nota final sea Provisional, EL SISTEMA mantendrá el estado académico en Pendiente.
- **CE-22** · *RF-07, constitución 9* — EL SISTEMA mostrará en rojo las notas finales Reprobadas, y solo esas, en pantalla y en el acta impresa.
- **CE-23** · *RN-05, constitución 6* — SI no existe una regla vigente para el programa y el nivel del grupo, ENTONCES EL SISTEMA mostrará la nota final, dejará el estado en Pendiente e indicará que falta la regla, sin suponer ninguna nota mínima.
- **CE-24** · *RN-05, Anexo C* — DONDE una regla esté marcada como provisional, EL SISTEMA lo indicará en el acta junto al estado académico.
- **CE-25** · *RN-05, CU-05* — EL SISTEMA permitirá a la Asistente registrar una regla de aprobación indicando programa, rango de niveles, fecha de inicio de vigencia, nota mínima y, si el programa la tiene, la franja de Condicionado y la nota exigida en el nivel siguiente.
- **CE-26** · *RN-05* — SI dos reglas del mismo programa se superponen en niveles y en fecha de inicio de vigencia, ENTONCES EL SISTEMA rechazará la segunda.
- **CE-27** · *RN-05, Anexo C* — MIENTRAS una regla esté marcada como provisional, EL SISTEMA permitirá a la Asistente corregirla, y la corrección se aplicará a todos los grupos evaluados con ella.
- **CE-28** · *RN-05, RN-15* — SI una regla no está marcada como provisional, ENTONCES EL SISTEMA no permitirá modificarla ni eliminarla; para cambiar la regla se registra una nueva con una fecha de vigencia posterior.

### E. Condicionado

- **CE-29** · *RF-07, RN-05* — EL SISTEMA permitirá asignar el estado Condicionado únicamente a la Asistente, con una justificación.
- **CE-30** · *Q3, RN-05* — SI la nota final redondeada no está dentro de la franja de Condicionado de la regla aplicable, o la regla no tiene franja, ENTONCES EL SISTEMA no permitirá asignar el Condicionado.
- **CE-31** · *RF-07* — CUANDO la Asistente quita un Condicionado, con un motivo, EL SISTEMA devolverá a la inscripción el estado que resulta del cálculo.

### F. Reprogramación de un parcial

- **CE-32** · *Q1, Anexo C* — CUANDO la Asistente autoriza la reprogramación de un parcial No presentado, EL SISTEMA lo registrará con la fecha, y con el número de recibo si se ingresa.
- **CE-33** · *Q1, Anexo C* — SI la fecha de término del grupo ya pasó, ENTONCES EL SISTEMA no permitirá autorizar reprogramaciones en él.
- **CE-34** · *Q1* — CUANDO el profesor registra la nota de un parcial con reprogramación autorizada, EL SISTEMA lo dejará con condición Reprogramado y esa nota sustituirá al 0.
- **CE-35** · *Q1* — SI un parcial no tiene reprogramación autorizada, ENTONCES EL SISTEMA no permitirá al profesor asignarle la condición Reprogramado.
- **CE-36** · *Q1, CU-17* — DONDE el acta ya esté Entregada, EL SISTEMA permitirá registrar la nota reprogramada solo a la Asistente, con un motivo.

### G. Retiro, baja por inasistencia y traslado

- **CE-37** · *Q2, CU-14 A2* — CUANDO el profesor marca que un estudiante dejó de asistir, con una observación, EL SISTEMA lo señalará como pendiente de decisión de la Asistente, sin cambiar todavía su inscripción.
- **CE-38** · *Q2, RN-12* — CUANDO la Asistente decide que fue un retiro justificado, EL SISTEMA dejará la inscripción Retirada, sin nota final y sin estado académico.
- **CE-39** · *Q2, Anexo C* — CUANDO la Asistente decide que fue una baja por inasistencia, EL SISTEMA dejará los parciales sin registrar como No presentado y el estado académico en Reprobado.
- **CE-40** · *RN-12* — CUANDO la Asistente registra un traslado a otro grupo, con una observación, EL SISTEMA dejará la inscripción Trasladada, sin nota final y sin estado académico.
- **CE-41** · *RN-12* — SI la inscripción ya tiene un parcial con valor registrado, ENTONCES EL SISTEMA advertirá a la Asistente, antes de dejarla Retirada o Trasladada, que esos parciales no contarán.

### H. Entrega del acta

- **CE-42** · *RF-08, CU-16* — CUANDO el profesor solicita entregar el acta, EL SISTEMA le presentará el resumen: inscritos, aprobados, reprobados, pendientes, retirados, trasladados y promedio del grupo.
- **CE-43** · *RN-12, CU-16 E1* — SI alguna inscripción que no está Retirada ni Trasladada tiene un parcial sin condición o un aviso de inasistencia sin decidir, ENTONCES EL SISTEMA rechazará la entrega y listará los estudiantes y los parciales que faltan.
- **CE-44** · *CU-16* — SI el acta no tiene ninguna calificación registrada, ENTONCES EL SISTEMA rechazará la entrega.
- **CE-45** · *RF-08, CU-16* — CUANDO el profesor confirma la entrega, EL SISTEMA dejará el acta Entregada con la fecha y la hora, y las inscripciones En curso pasarán a Completada.
- **CE-46** · *CU-16 E2* — SI la entrega no puede completarse entera, ENTONCES EL SISTEMA no aplicará ninguna parte y el acta seguirá Abierta.
- **CE-47** · *RF-08, RN-11* — MIENTRAS el acta esté Entregada, EL SISTEMA no permitirá al profesor modificar ningún dato de ella, aunque la petición no pase por la interfaz.

### I. Modificación de un acta entregada

- **CE-48** · *RF-08, RN-11, CU-17* — MIENTRAS el acta esté Entregada, EL SISTEMA permitirá a la Asistente modificar parciales y condiciones, exigiendo un motivo.
- **CE-49** · *CU-17, CU-15* — CUANDO la Asistente modifica un acta entregada, EL SISTEMA recalculará la nota final y el estado académico de la inscripción afectada.

### J. Acta impresa

- **CE-50** · *Q5, constitución 9* — EL SISTEMA permitirá al profesor del grupo, a la Asistente y a Dirección obtener el acta para imprimir o guardar en PDF, en el formato oficial de la Hoja de registro de notas de ADEI.
- **CE-51** · *Q5* — EL SISTEMA incluirá en el acta impresa el encabezado del grupo (inicio, término, nivel, horario y profesor), una fila por inscripción con los parciales I, II y III y la nota final, y los espacios «Entregado» y «Firma del profesor».
- **CE-52** · *Q5, CU-16* — DONDE el acta esté Entregada, EL SISTEMA imprimirá en ella la fecha y la hora de la entrega, y la impresión servirá de constancia de entrega.
- **CE-53** · *Q5* — EL SISTEMA mostrará en el acta impresa la condición de cada parcial que no sea Registrado y el estado de las inscripciones Retiradas o Trasladadas, en lugar de dejar la celda vacía.

### K. Inscripción con antecedentes

- **CE-54** · *Q4, CU-10* — SI la Asistente inscribe a un estudiante en un nivel superior al último que reprobó, ENTONCES EL SISTEMA advertirá el antecedente y pedirá confirmar con un motivo.
- **CE-55** · *Q4, RN-05* — SI la Asistente inscribe a un estudiante que no cumplió la condición de un Condicionado en un nivel mayor que dos niveles por debajo de aquel en que no la cumplió, ENTONCES EL SISTEMA advertirá el antecedente y pedirá confirmar con un motivo.
- **CE-56** · *Q4* — EL SISTEMA no cambiará el nivel de ningún estudiante por sí mismo: solo advierte; la decisión es de la Asistente.

### L. Permisos

- **CE-57** · *RNF-05, 001·CE-61* — SI un usuario cuyos roles son solo Dirección intenta modificar parciales, condiciones, estados, entregas o reglas de aprobación, ENTONCES EL SISTEMA lo rechazará.
- **CE-58** · *001·C1* — EL SISTEMA permitirá a Dirección consultar cualquier acta y la regla de aprobación.
- **CE-59** · *RN-24, 001·CE-100* — EL SISTEMA aplicará a parciales, calificaciones, actas y reglas de aprobación el mismo aislamiento por organización de la spec 001.
- **CE-60** · *RNF-05, 001·CE-62* — EL SISTEMA aplicará cada restricción de esta spec sobre los datos mismos, de modo que se cumpla también cuando la petición no pasa por la interfaz.

### M. Auditoría

- **CE-61** · *RF-15, RN-11, constitución 8* — CUANDO se registra o modifica un parcial, su condición, una nota reprogramada, un Condicionado, una decisión de retiro, baja o traslado, una entrega de acta o una regla de aprobación, EL SISTEMA registrará usuario, acción, registro afectado, valor anterior, valor nuevo y fecha-hora.
- **CE-62** · *RN-15, 001·CE-20* — SI una de esas acciones no puede quedar registrada en la auditoría, ENTONCES EL SISTEMA no la aplicará.

## Requisitos no funcionales aplicables

| RNF | Qué exige en esta spec | Umbral |
|---|---|---|
| RNF-02 | Captura del acta | Un acta de 10 estudiantes en menos de 10 minutos |
| RNF-05 | Permisos | Aplicados sobre los datos, no solo en pantalla |
| RNF-06 | Grupos y acta del profesor | Operables a 360 px de ancho sin desplazamiento horizontal |
| RNF-10 | Ley 787 | El profesor ve solo nombre y código de sus estudiantes; todo cambio queda en la auditoría |

## Valores iniciales de la regla de aprobación

Respuestas de la cliente del 2026-11-01, sumadas al Anexo C del documento. Lo que no
está confirmado entra **marcado como provisional** (CE-24) y se corrige como dato
(CE-27), sin tocar el sistema.

**El curso principal tiene 16 niveles.** Las clases van del primer nivel (el de
principiante) hasta el último en 16 niveles consecutivos, para adultos y jóvenes (Dirk
y la cliente, 1 y 2 de noviembre). No hay un programa «Principiante» aparte: los
cortes 1–5, 6–11 y 12–16 que dio la cliente son tramos de ese curso. Beginners (2
niveles, aprueba con 75) e Intermediate (6 niveles, aprueba con 80) encajan en esos
tramos como niveles 1–2 y 6–11. Conversation, Conversation Avanzada y Especial son
programas aparte, y el curso de niños también.

**Condicionado en todos los programas.** La cliente confirmó que existe «para todos
los niveles» y «desde siempre». Su franja son las tres notas inmediatamente
inferiores a la mínima, como el 77–79 bajo 80 de Intermediate, y en el nivel
siguiente se exige la nota mínima de ese nivel.

| Programa | Niveles | Nombres conocidos | Aprueba con | Condicionado | Provisional |
|---|---|---|---|---|---|
| Curso principal | 1 y 2 | Beginners I y II | 75 | 72 a 74 | No |
| Curso principal | 3 a 5 | sin nombre conocido | 75 | 72 a 74 | Sí: corte «al parecer» |
| Curso principal | 6 a 11 | Intermediate I-I a III-II | 80 | 77 a 79 | No |
| Curso principal | 12 y 13 | Advanced I y II | 80 | 77 a 79 | No: Advanced con 80 está confirmado |
| Curso principal | 14 a 16 | sin nombre conocido | 90 | 87 a 89 | Sí: corte «al parecer» |
| Conversation | todos | Conversation I-I a II-V | 80 | 77 a 79 | No |
| Conversation Avanzada | todos | I y II | 80 | 77 a 79 | No |
| Especial | todos | Conversation Reinforcement | 80 | 77 a 79 | Sí: se asume como Conversation |
| Curso de niños | — | — | — | — | Sin regla hasta que la Asistente la registre (CE-23) |

- **Vigencia:** la tabla rige desde el 2023-01-01; antes, todos los programas aprueban
  con 75 (franja 72 a 74), que es el corte medido en 2021. La cliente no recuerda desde
  cuándo rige el 80, así que la fecha es provisional; solo afecta a grupos anteriores,
  que llegan con la migración.
- **Advanced:** la cliente dijo el 29-oct que aprueba con 80 (confirmado) y luego que
  los niveles 12 a 16 aprueban con 90 («al parecer»). Gana lo confirmado: Advanced
  queda en 80 y el 90 se aplica a los niveles 14 a 16.
- **Niveles sin nombre conocido (3 a 5 y 14 a 16):** entran al catálogo como «Nivel 3»,
  «Nivel 4»… La Asistente les pone el nombre que usa la academia (001·CE-22); el nombre
  no cambia la regla, que va por el número de nivel.
- **Curso de niños:** sus niveles los agrega la Asistente en Catálogos y registra su
  regla (CE-25). Mientras no la registre, aplica CE-23.

## Ajustes al catálogo con las respuestas de la cliente

- **Curso principal de 16 niveles, para todas las edades:** Beginners, Intermediate y
  Advanced pasan a ser los niveles 1–2, 6–11 y 12–13 de un solo curso, y se agregan los
  niveles 3–5 y 14–16. Los 16 niveles «Principiante» que hoy figuran como programa de
  niños se retiran, porque duplicaban ese mismo curso; si alguno ya se usó, se
  desactiva en lugar de borrarse (RN-22).
- **Modalidad Diario:** de lunes a jueves. Confirmado; ya era el valor de la semilla.
- **Sucursales:** se cargan las direcciones completas que dio la cliente:
  - Altamira: Calle Principal de Altamira, frente a la Ferretería Roberto Morales
    Cuadra (453 C. Principal Altamira), segundo piso, Managua.
  - Don Bosco: de la Cruz Roja Don Bosco, ½ cuadra arriba, frente a la Parroquia Don
    Bosco, casa F-454, Managua.
  - Multicentro Las Brisas: Módulo B-27, de los semáforos de Linda Vista 6 cuadras al
    oeste, Managua.
- **Nivel de gramática:** quien tiene fallas de gramática va a un nivel de gramática.
  Es un nivel más del catálogo, que la Asistente agrega cuando lo use; las
  advertencias de CE-54 y CE-55 no lo comparan con otros programas.
- **Aviso de privacidad:** lo revisará Doña Aura. Sigue la versión v0.1 hasta su
  revisión.

## Casos límite

- Dos parciales Registrados y uno Justificado (85 y 90): la nota es 87.5 → 88.
- Un parcial Registrado y dos No presentados (88): la nota es 29.33 → 29. Es uno de los casos que en 2021 parecían errores y no lo eran.
- Nota exactamente en el borde: 80 aprueba en Intermediate; 79 cae en la franja de Condicionado y queda Reprobado mientras la Asistente no lo condicione. En Beginners (niveles 1 y 2), 75 aprueba y 74 cae en su franja (72 a 74).
- Nota de 79.5 en un grupo con dos parciales considerados: se redondea a 80 y aprueba (CE-17).
- Corrección de una regla provisional que saca de la franja a un estudiante ya Condicionado: el Condicionado se conserva, porque lo asignó la Asistente, y el acta lo señala para que ella lo revise.
- Grupo iniciado antes de 2023: se evalúa con 75 aunque se capture hoy (CE-20).
- Cambio de profesor de un grupo con parciales ya capturados (001·CE-51): el profesor nuevo ve y continúa lo capturado; el anterior pierde el acceso.
- El profesor captura desde el teléfono y desde la computadora a la vez: la segunda sesión no pisa a la primera (CE-12).
- Fecha de término ya pasada con el acta Abierta: el profesor puede seguir capturando y entregar; ya no se autorizan reprogramaciones (CE-33).
- Inscripción anulada (001·CE-58): no aparece en el acta ni en la impresión.
- Estudiante Retirado que regresa a otro grupo: es una inscripción nueva; la Retirada conserva su historia.
- Profesor que también es Director (RN-17, 179 registros en 2021): con los dos roles, ve sus grupos como profesor y todas las actas como Dirección, sin poder modificar las ajenas.

## Fuera de alcance

| Qué | Dónde se espera |
|---|---|
| Filtrado multicriterio con verificación de completitud (RF-10) | Spec 003 |
| Historial académico del estudiante (RF-11) | Spec 003 |
| Cambio de estado de matrícula (RF-13) | Spec 003 |
| Panel de actas entregadas y pendientes (RF-20) y reporte estadístico (RF-21) | Spec 003 |
| Recibo e historial prellenados (RF-18) y exportación (RF-19) | Spec 003 |
| Facturas (RF-17) | Spec 003 |
| Cobro de la reprogramación: el sistema no cobra ni lleva saldos; el recibo es solo una referencia | Fuera del proyecto |
| Mover a un estudiante de nivel de forma automática | Fuera del proyecto: lo decide la secretaría (CE-56) |
| Migración de las notas de 2021 (RF-22, RN-18, RN-19) | Spec de migración |
| Asistencia diaria (el conteo de las 3 semanas): el sistema registra la decisión, no lleva la lista de asistencia | Fuera del proyecto |
| Bloqueo por intentos, correo de restablecimiento y cierre por inactividad (001·CE-10, CE-63 a CE-69, CE-88 a CE-90) | Spec 004 |

## Datos de prueba

Todos sintéticos (constitución, principio 3). Grupos de cada programa con
inscripciones que cubren todas las combinaciones de condición, notas en los bordes
de cada regla (74, 75, 79, 80, 89, 90) y un grupo iniciado antes de 2023.

## Criterios de finalización

- Los 62 CE con test automático en verde, o con renglón firmado en la lista de comprobación manual si son de interfaz.
- Tabla de trazabilidad CE → RF/RN/Q completa, sin huecos.
- `npm run test` y `npx tsc --noEmit` sin errores.
- Pruebas de seguridad del bloque (Newman) en verde contra la copia local.
- Lista de comprobación manual completa.

## Lista de comprobación manual

| # | Qué hacer | Qué debe pasar | CE | Verificado |
|---|---|---|---|---|
| 1 | Entrar como profesor desde un teléfono (360 px) | Ve solo sus grupos, sin desplazamiento horizontal | CE-1, RNF-06 || ☑ 2026-11-02 |
| 2 | Pegar en la barra de direcciones el enlace del acta de otro profesor | Acceso negado | CE-4 || ☑ 2026-11-02 |
| 3 | Capturar el acta completa de un grupo de 10 estudiantes | Se termina en menos de 10 minutos | RNF-02 || ☑ 2026-11-02 |
| 4 | Escribir 769 en un parcial | Se rechaza con la regla, sin borrar lo demás | CE-8 || ☑ 2026-11-02 |
| 5 | Dejar un parcial sin condición | La nota aparece como Provisional y dice qué falta | CE-16 || ☑ 2026-11-02 |
| 6 | Registrar 85, 90 y un Justificado | Nota final 88 | CE-14, CE-17 || ☑ 2026-11-02 |
| 7 | Registrar 76 en un grupo de Intermediate | Reprobado, en rojo | CE-19, CE-22 || ☑ 2026-11-02 |
| 8 | Como Asistente, condicionar una nota de 78 en Intermediate y luego intentarlo con una de 70 | La primera se acepta con justificación; la segunda se rechaza | CE-29, CE-30 || ☑ 2026-11-02 |
| 9 | Autorizar una reprogramación como Asistente y anotar la nota como profesor | El parcial queda Reprogramado y su nota sustituye al 0 | CE-32, CE-34 || ☑ 2026-11-02 |
| 10 | Marcar como profesor que un estudiante dejó de asistir y decidir como Asistente una baja por inasistencia | Faltantes en 0 y estado Reprobado | CE-37, CE-39 || ☑ 2026-11-02 |
| 11 | Intentar entregar con un parcial sin condición | Se rechaza y lista lo que falta | CE-43 || ☑ 2026-11-02 |
| 12 | Entregar el acta y tratar de cambiar una nota como profesor | No se puede | CE-45, CE-47 || ☑ 2026-11-02 |
| 13 | Imprimir el acta entregada | Formato oficial, reprobadas en rojo, fecha y hora de entrega | CE-50 a CE-53 || ☑ 2026-11-02 |
| 14 | Inscribir a un reprobado en el nivel siguiente | Advertencia y motivo obligatorio | CE-54 || ☑ 2026-11-02 |
| 15 | Revisar qué datos del estudiante ve el profesor | Solo nombre, apellidos y código | CE-5 || ☑ 2026-11-02 |

## Impacto en el documento del curso

| Pregunta | Cambio en el SRS |
|---|---|
| Q1 | La reprogramación de un parcial la autoriza la Asistente; el profesor solo anota la nota. Nuevo atributo de Parcial: autorización de reprogramación (fecha y recibo opcional). CU-14 A1. |
| Q2 | CU-14 A2 cambia: el profesor avisa que el estudiante dejó de asistir; la Asistente decide retiro justificado (Retirada) o baja por inasistencia (Reprobado). Nuevo flujo alterno en CU-17 o caso de uso nuevo de la Asistente. |
| Q3 | RN-05: el Condicionado solo se puede asignar dentro de la franja de la regla aplicable. |
| Cliente | El curso principal tiene 16 niveles consecutivos para todas las edades (Beginners = 1–2, Intermediate = 6–11, Advanced = 12–13); la regla va por número de nivel: 75 en 1–5, 80 en 6–13, 90 en 14–16. Conversation y Conversation Avanzada: 80. El Condicionado existe en todos los programas, con la franja de las tres notas bajo la mínima. El curso de niños es un programa aparte. Anexo C: quedan pendientes los cortes de 3–5 y 14–16, Especial y la fecha del 80. Direcciones de las sucursales. |
| Q4 | CU-10: advertencia con motivo al inscribir a un reprobado en un nivel superior o a quien no cumplió un Condicionado. |
| Q5 | CU-16: la constancia de entrega es el acta impresa en el formato oficial de ADEI. |
| Q6 | RNF-10: el profesor ve solo nombre, apellidos y código de sus estudiantes. |
| Regla | `ReglaAprobacion` lleva una marca de provisional; solo las provisionales se corrigen. La Asistente la administra desde los catálogos (CU-05). |

## Dudas abiertas

Ninguna. Las respuestas de la cliente se incorporaron arriba, y lo que ella no
precisó se decidió así (decisión de Dirk, 2026-11-01: resolver por lógica, sin más
preguntas):

- **Valores sin confirmar** (cortes de los niveles 3–5 y 14–16, regla de Especial, fecha del 80):
  entran como provisionales y se corrigen como dato.
- **«Nivel superior» entre programas** (CE-54 y CE-55): dentro de un programa manda el
  número de nivel. El curso principal va del 1 al 16, y Conversation sigue con
  Conversation Avanzada. Especial, gramática y el curso de niños no se comparan con
  otros programas.

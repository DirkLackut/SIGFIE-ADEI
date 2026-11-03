# Spec 003 — Consulta y reportes

**Estado:** aprobada (2026-11-02, Dirk: «esta bien no hay problema», tras ver la maqueta del Excel) · clarificación cerrada
**Fecha:** 2026-11-02
**Requisitos del SRS que cubre:** RF-10, RF-11, RF-13, RF-15 (consulta de la bitácora),
RF-17, RF-18, RF-19, RF-20, RF-21 · RN-07, RN-08, RN-13, RN-14, RN-15, RN-20, RN-21,
RN-23, RN-24 · RNF-01, RNF-03, RNF-05, RNF-06, RNF-07, RNF-08, RNF-10 ·
Fase 2, §6.6 (CA-05 a CA-07)

## Contexto y objetivo

Es la tercera spec del núcleo y la que cierra el motivo del proyecto. El sistema de
2018 se abandonó porque **filtraba y entregaba listas incompletas sin avisar**
(entrevista, P7). Con esta spec, la Asistente de Dirección obtiene cualquier listado
combinando criterios, con el total a la vista y la garantía de que la lista está
completa. Si no lo está, el sistema lo dice y no muestra nada a medias
(constitución, principio 6; RN-23).

Además, el sistema devuelve en formato lo que ya sabe, para que nadie lo vuelva a
escribir a mano: el historial académico, la Hoja de matrícula prellenada, el
listado exportado a Excel y el respaldo completo. Registra las facturas de la
academia sin invadir el ámbito fiscal. Lleva el estado de matrícula (Activo,
Desertor, Egresado). Por último, da a la Asistente y a la Dirección el panel de
entrega de actas, el reporte por sucursal y la bitácora.

Orden del núcleo: 001 Base y registro → 002 Captura académica → **003 Consulta y
reportes**.

## Actores

- **Asistente de Dirección**: filtra, exporta, consulta historiales, registra
  facturas, cambia el estado de matrícula, imprime formatos, ve el panel de actas y
  el reporte, y hace el respaldo completo.
- **Dirección** (Director y Sub-directora): consulta todo lo anterior sin modificar
  nada, y es la única que lee la bitácora (001·CE-94).
- **Profesor**: no gana nada en esta spec. Si intenta entrar, se le niega y la
  denegación queda registrada.

## Casos de uso del SRS involucrados

CU-04 Consultar bitácora · CU-11 Registrar factura · CU-12 Cambiar estado de
matrícula · CU-19 Consultar historial académico · CU-20 Filtrar estudiantes ·
CU-21 Exportar resultados · CU-22 Generar formato prellenado · CU-23 Monitorear
entrega de actas · CU-24 Generar reporte estadístico · CU-25 Generar respaldo completo

## Historias de usuario

- HU-04: Como asistente de dirección, quiero filtrar estudiantes combinando sucursal, nivel, modalidad, profesor, estado y rango de fechas, para obtener el listado exacto que necesito en cada consulta.
- HU-05: Como asistente de dirección, quiero consultar el historial académico completo de un estudiante, con todos los niveles que ha cursado y sus calificaciones, para conocer su trayectoria en la academia.
- HU-07: Como asistente de dirección, quiero registrar si un estudiante está activo, desertó o egresó, para controlar con exactitud la cartera vigente de cada sucursal.
- HU-08: Como asistente de dirección, quiero registrar el número de factura y el monto correspondiente a la inscripción de un estudiante en un nivel, para poder rastrear el comprobante físico desde el expediente.
- HU-09: Como asistente de dirección, quiero generar el recibo y el historial académico de un estudiante ya llenos con sus datos, para no volver a escribir a mano información que el sistema ya tiene.
- HU-10: Como asistente de dirección, quiero exportar o imprimir el resultado de cualquier búsqueda, para compartir información con la dirección, archivarla formalmente o analizarla por mi cuenta.
- HU-11: Como asistente de dirección, quiero ver qué profesores han entregado sus actas y cuáles están pendientes, para dar seguimiento al cierre de cada ciclo sin tener que preguntar uno por uno.
- HU-12: Como asistente de dirección, quiero que el sistema informe sobre el uso responsable de los datos al ingresar, para cumplir la Ley 787 *(aquí: la parte de la bitácora consultable)*.
- HU-16: Como sub-directora, quiero consultar un resumen de estudiantes activos, desertores y egresados por sucursal, para dar seguimiento a la operación sin depender de consultas manuales a la asistente de dirección.

## Criterios de aceptación (EARS)

Cada criterio declara el requisito, la regla o el criterio del SRS que lo origina.
Los marcados con un código de clarificación (A, C, L) resuelven un punto de
`clarificacion.md`. «La Asistente» es quien tiene el rol Asistente de Dirección;
«Dirección», quien tiene ese rol; los permisos se suman (RN-17).

### A. Filtrado con verificación de completitud (CU-20, RF-10, RN-23)

- **CE-1** · *RF-10, CU-20 paso 2* — EL SISTEMA ofrecerá a la Asistente y a Dirección filtrar con estos criterios, todos tomados de catálogos o de listas cerradas, nunca de texto libre: sucursal, programa, nivel, modalidad, horario, profesor, estado de matrícula, estado de inscripción, estado académico y un rango de fechas.
- **CE-2** · *A1* — EL SISTEMA presentará el resultado en una de dos vistas, a elección del usuario: **Inscripciones**, con un renglón por cada nivel cursado (estudiante + grupo), y **Estudiantes**, con un renglón por estudiante. La vista inicial será Inscripciones.
- **CE-3** · *A1* — EN la vista Estudiantes, EL SISTEMA incluirá a un estudiante cuando cumpla los criterios propios del estudiante (sucursal, estado de matrícula) y tenga al menos una inscripción que cumpla los criterios de inscripción. SI no se eligió ningún criterio de inscripción, ENTONCES incluirá también a los estudiantes sin inscripciones.
- **CE-4** · *A2* — EN la vista Inscripciones, EL SISTEMA aplicará el criterio de sucursal a la sucursal del grupo. EN la vista Estudiantes, lo aplicará a la sucursal del estudiante.
- **CE-5** · *A3* — EL SISTEMA aplicará el rango de fechas a los grupos que estuvieron en curso algún día del rango: inicio no posterior al final del rango y término no anterior a su comienzo. Cualquiera de los dos extremos del rango puede quedar vacío.
- **CE-6** · *RN-07, CU-20 paso 4* — CUANDO el usuario elige una modalidad, EL SISTEMA ofrecerá solo los horarios de esa modalidad. SI se recibe un horario que no pertenece a la modalidad elegida, ENTONCES rechazará la consulta indicando el criterio que falla.
- **CE-7** · *RN-08, CU-20 E1* — SI la fecha final del rango es anterior a la inicial, o alguna fecha no existe o no tiene año de cuatro cifras, ENTONCES EL SISTEMA rechazará la consulta indicando el criterio que falla, sin borrar los demás criterios.
- **CE-8** · *CU-20 paso 2* — CUANDO el usuario elige un programa, EL SISTEMA ofrecerá solo los niveles de ese programa. SI se recibe un nivel de otro programa, ENTONCES rechazará la consulta.
- **CE-9** · *CU-20 A4* — SI el usuario no elige ningún criterio, ENTONCES EL SISTEMA devolverá todos los registros de la vista elegida con su total.
- **CE-10** · *RF-10, RN-23, CU-20 pasos 5 a 8* — CUANDO se ejecuta un filtrado, EL SISTEMA obtendrá el total y los registros en una sola operación atómica y mostrará el total junto a los resultados.
- **CE-11** · *RN-23, principio 6, CU-20 E2* — SI la cantidad de registros obtenida no coincide con el total calculado, ENTONCES EL SISTEMA no mostrará ningún resultado, informará un error de completitud y lo registrará en la bitácora como incidente.
- **CE-12** · *001·CE-85* — CUANDO el resultado tiene más registros de los que caben en una página, EL SISTEMA mostrará el total real y permitirá recorrer todas las páginas, sin límite máximo de resultados.
- **CE-13** · *001·CE-44, CU-20 A1* — SI no hay coincidencias, ENTONCES EL SISTEMA informará «0 resultados» de forma explícita, nunca con una lista vacía sin mensaje.
- **CE-14** · *CU-20 paso 8* — EN la vista Inscripciones, EL SISTEMA mostrará por renglón: código ADEI, apellidos y nombres, sucursal del grupo, código de grupo, programa y nivel, modalidad y horario, profesor, inicio y término, estado de inscripción, nota final y estado académico. Las notas reprobadas irán en rojo.
- **CE-15** · *CU-20 paso 8* — EN la vista Estudiantes, EL SISTEMA mostrará por renglón: código ADEI, apellidos y nombres, cédula, sucursal, estado de matrícula, último nivel cursado y cuántas inscripciones cumplen los criterios.
- **CE-16** · *002·D24* — EL SISTEMA filtrará por estado académico con el mismo cálculo que muestra el acta (002), de modo que un estudiante Pendiente, Aprobado, Reprobado o Condicionado aparezca igual en los dos lugares.
- **CE-17** · *CU-20 paso 9, RF-15* — CUANDO se ejecuta un filtrado, EL SISTEMA registrará en la bitácora los criterios usados, la vista y el total obtenido.
- **CE-18** · *001·CE-46* — SI un usuario cuyo único rol es Profesor intenta filtrar, exportar, consultar un historial o ver un reporte de esta spec, ENTONCES EL SISTEMA se lo negará y registrará la denegación.
- **CE-19** · *L1* — EL SISTEMA ordenará los resultados por apellidos, nombres y código ADEI, sin distinguir tildes, y en la vista Inscripciones, además, por fecha de inicio del grupo.
- **CE-20** · *RNF-01, RNF-07, CA-07* — MIENTRAS haya hasta 20,000 inscripciones y 20,000 estudiantes registrados, EL SISTEMA responderá cualquier filtrado en menos de 2 segundos.
- **CE-21** · *CA-05, CA-06* — EL SISTEMA devolverá, al filtrar por cada modalidad, exactamente las inscripciones de esa modalidad, y sin criterios, exactamente todas las inscripciones registradas.
- **CE-22** · *L2* — CUANDO el usuario cambia un criterio, EL SISTEMA conservará los demás y volverá a la primera página.
- **CE-23** · *RNF-03* — EL SISTEMA mantendrá los criterios elegidos en la dirección de la página, de modo que una consulta se pueda volver a abrir, guardar como favorito o compartir con otro usuario con permiso.

### B. Exportación e impresión del resultado (CU-21, RF-19, RNF-08)

- **CE-24** · *RF-19, CU-21* — CUANDO la Asistente o Dirección exporta un resultado, EL SISTEMA generará un archivo de Excel (.xlsx) con los mismos registros y las mismas columnas de la vista activa, todos, no solo la página visible.
- **CE-25** · *RN-23, principio 6* — SI la cantidad de registros del archivo no coincide con el total del resultado, ENTONCES EL SISTEMA no entregará el archivo e informará el error de completitud (igual que CE-11).
- **CE-26** · *L3* — EL SISTEMA pondrá en el archivo, antes de la tabla, la fecha y hora de la exportación, quién la hizo, los criterios usados y el total de registros.
- **CE-27** · *RF-19 excepción* — SI el resultado tiene 0 registros, ENTONCES EL SISTEMA no generará el archivo y lo dirá.
- **CE-28** · *RF-15, RNF-10* — CUANDO se exporta o se imprime un resultado, EL SISTEMA lo registrará en la bitácora con los criterios y el total.
- **CE-29** · *HU-10* — CUANDO la Asistente o Dirección imprime un resultado, EL SISTEMA presentará una versión para imprimir con el emblema de ADEI, el título, los criterios, el total y la fecha, con todas las filas del resultado y la numeración continua entre hojas.
- **CE-30** · *L4* — EL SISTEMA escribirá en el archivo las fechas como fechas, las notas como números y los códigos (ADEI, cédula, grupo) como texto, para que Excel no los altere.

### C. Respaldo completo (CU-25, RNF-08)

- **CE-31** · *RNF-08, CU-25* — CUANDO la Asistente pide el respaldo completo, EL SISTEMA generará un archivo de Excel con una hoja por cada conjunto de datos de su organización: estudiantes, tutores y su vínculo, grupos, inscripciones, parciales, resultados académicos, facturas y su vínculo, y los catálogos (sucursales, niveles, modalidades, horarios, profesores, reglas de aprobación).
- **CE-32** · *RNF-08* — EL SISTEMA pondrá en la primera hoja del respaldo la fecha y hora, quién lo generó y el total de filas de cada hoja. SI el total de alguna hoja no coincide con el de la base en el mismo instante, ENTONCES no entregará el archivo.
- **CE-33** · *A4, 001·CE-94* — EL SISTEMA dejará fuera del respaldo las cuentas de usuario, las contraseñas y la bitácora.
- **CE-34** · *A4* — SI alguien sin el rol Asistente de Dirección pide el respaldo completo, ENTONCES EL SISTEMA se lo negará y registrará la denegación.
- **CE-35** · *RF-15* — CUANDO se genera un respaldo, EL SISTEMA lo registrará en la bitácora con el total de filas por hoja.

### D. Historial académico (CU-19, RF-11)

- **CE-36** · *CU-19 paso 4* — CUANDO la Asistente o Dirección abre el historial de un estudiante, EL SISTEMA presentará su código ADEI, nombre, cédula, sucursal, estado de matrícula y fecha del último cambio de estado.
- **CE-37** · *CU-19 paso 5, RF-11* — EL SISTEMA presentará todas sus inscripciones en orden cronológico por fecha de inicio del grupo, cada una con código de grupo, programa y nivel, modalidad y horario, profesor, sucursal, inicio y término, I, II, III con su condición, nota final, estado académico, estado de inscripción y factura asociada.
- **CE-38** · *CU-19 paso 6* — EL SISTEMA destacará las notas reprobadas en rojo y marcará los niveles Condicionados con su justificación.
- **CE-39** · *002* — EL SISTEMA mostrará la nota de un acta todavía Abierta marcada como provisional, igual que en el acta (002·CE-16).
- **CE-40** · *CU-19 A2* — SI el estudiante no tiene inscripciones, ENTONCES EL SISTEMA mostrará sus datos con la indicación «Sin niveles cursados».
- **CE-41** · *CU-19 paso 7* — CUANDO se abre un historial, EL SISTEMA lo registrará en la bitácora.
- **CE-42** · *L5* — EL SISTEMA no mostrará en el historial las inscripciones anuladas por error (001·CE-58): quedan solo en la bitácora.
- **CE-43** · *CU-19 A1, CU-22* — EL SISTEMA permitirá exportar el historial a Excel e imprimirlo, con el emblema de ADEI y los mismos datos de CE-36 y CE-37.

### E. Hoja de matrícula prellenada (CU-22, RF-18)

- **CE-44** · *RF-18, HU-09* — CUANDO la Asistente pide la Hoja de matrícula de una inscripción, EL SISTEMA la presentará lista para imprimir o guardar en PDF, con la estructura del formato impreso de ADEI (`docs/formatos/hoja-de-matricula.jpg`).
- **CE-45** · *RF-18* — EL SISTEMA llenará la hoja con lo que registra: nombres, apellidos, fecha de nacimiento, edad, dirección, cédula, celular, correo, tutor (nombre, cédula y teléfono), contacto de emergencia, fecha de ingreso (la de registro del estudiante), nivel, horario, inicio y término del nivel, profesor, curso (el programa), «Inscrito por» (el usuario que hizo la inscripción) y, de la factura asociada a la inscripción, «N.º Recibo» (serie y número) y «Paga» (monto y moneda).
- **CE-46** · *RF-18 excepción, A5* — SI un dato que el sistema registra está vacío para ese estudiante, ENTONCES EL SISTEMA escribirá «sin registro» en su lugar. Nunca inventará un valor.
- **CE-47** · *A5* — EL SISTEMA dejará como línea en blanco, para llenarse a mano, los campos del formato que el sistema no registra: lugar donde vive, nivel de escolaridad, requisitos entregados (fotocopia de cédula, tutor, partida de nacimiento, foto) y el recuadro de la foto.
- **CE-48** · *RN-21, RNF-10* — EL SISTEMA no imprimirá los campos «Estado civil» ni «Padece de alguna enfermedad».
- **CE-49** · *L6* — SI el estudiante tiene más de un tutor, ENTONCES EL SISTEMA imprimirá el primero que se vinculó y dirá cuántos más hay.
- **CE-50** · *RF-15* — CUANDO se genera una Hoja de matrícula, EL SISTEMA lo registrará en la bitácora.
- **CE-51** · *A6* — EL SISTEMA permitirá generar la Hoja de matrícula solo a la Asistente: es un formato de la secretaría con datos personales completos.

### F. Facturas (CU-11, RF-17, RN-13, RN-14)

- **CE-52** · *RF-17, PB-12* — CUANDO la Asistente registra una factura, EL SISTEMA exigirá número, serie, fecha de emisión, monto, moneda, forma de pago y al menos un estudiante amparado.
- **CE-53** · *Diccionario: Factura* — EL SISTEMA aceptará como número un entero de 1 a 5 cifras; como serie, una letra (se guarda en mayúscula, valor inicial «B»); como moneda, US$ o C$; y como forma de pago, Efectivo, Tarjeta o Transferencia (valor inicial Efectivo).
- **CE-54** · *RN-13* — SI ya existe una factura con la misma serie y el mismo número en la organización, ENTONCES EL SISTEMA rechazará el registro e indicará la factura existente.
- **CE-55** · *RN-13, Diccionario* — SI el monto no está entre 0.01 y 9,999.99, ENTONCES EL SISTEMA lo rechazará.
- **CE-56** · *RF-17, A7* — SI el monto supera US$200, o C$7,325 en córdobas (el mismo valor a la tasa oficial fija del BCN de 36.6243), ENTONCES EL SISTEMA advertirá que es un monto atípico y pedirá confirmar.
- **CE-57** · *Diccionario: fechaEmision* — SI la fecha de emisión es posterior a hoy, no existe o su año no tiene cuatro cifras, ENTONCES EL SISTEMA la rechazará.
- **CE-58** · *RN-14* — EL SISTEMA guardará el monto en su moneda de origen, sin convertirlo.
- **CE-59** · *RN-13, D5 del análisis* — EL SISTEMA permitirá que una factura ampare a varios estudiantes (recibos familiares).
- **CE-60** · *RN-13, CU-11* — CUANDO la Asistente asocia la factura a una inscripción, EL SISTEMA exigirá que la inscripción sea de uno de los estudiantes amparados. SI esa inscripción ya tiene una factura, ENTONCES lo rechazará.
- **CE-61** · *CU-11 extiende CU-10* — EL SISTEMA permitirá registrar la factura desde la inscripción del estudiante en el grupo, con el estudiante y la inscripción ya elegidos, y también desde el expediente del estudiante.
- **CE-62** · *L7* — MIENTRAS la Asistente corrige una factura registrada por error, EL SISTEMA exigirá un motivo, aplicará las mismas validaciones del registro y conservará el valor anterior en la bitácora.
- **CE-63** · *L7* — CUANDO la Asistente anula una factura registrada por error, EL SISTEMA exigirá un motivo, la quitará de los estudiantes y de la inscripción y conservará todos sus datos en la bitácora.
- **CE-64** · *PB-12* — EL SISTEMA no generará ni imprimirá facturas: solo registra los datos de la factura impresa en el talonario.
- **CE-65** · *RF-17* — EL SISTEMA mostrará las facturas de un estudiante en su expediente y en su historial, con número, serie, fecha, monto y moneda.
- **CE-66** · *001·CE-61* — SI Dirección intenta registrar, corregir o anular una factura, ENTONCES EL SISTEMA lo rechazará.

### G. Estado de matrícula (CU-12, RF-13, RN-20)

- **CE-67** · *RF-13, CU-12* — CUANDO la Asistente cambia el estado de matrícula de un estudiante a Activo, Desertor o Egresado, EL SISTEMA guardará el estado nuevo y su fecha.
- **CE-68** · *RF-13 excepción* — SI el estado elegido es igual al actual, ENTONCES EL SISTEMA rechazará el cambio.
- **CE-69** · *A8* — EL SISTEMA propondrá como fecha del cambio la de hoy y permitirá una anterior. SI la fecha es posterior a hoy o anterior al último cambio de estado del estudiante, ENTONCES la rechazará.
- **CE-70** · *A8* — EL SISTEMA aceptará una observación opcional de hasta 300 caracteres con el cambio.
- **CE-71** · *C1* — SI el estudiante tiene alguna inscripción En curso al pasar a Desertor o Egresado, ENTONCES EL SISTEMA lo advertirá, mostrará esas inscripciones y pedirá confirmar. El cambio no modifica las inscripciones: cada una se resuelve en su acta (002).
- **CE-72** · *RF-03, 001·CE-55* — MIENTRAS el estudiante esté Desertor o Egresado, EL SISTEMA rechazará inscribirlo; CUANDO vuelve a Activo, lo permitirá de nuevo.
- **CE-73** · *RF-15, principio 8* — CUANDO cambia el estado de matrícula, EL SISTEMA registrará en la bitácora el estado y la fecha anteriores y los nuevos.
- **CE-74** · *001·CE-61* — SI Dirección intenta cambiar el estado de matrícula, ENTONCES EL SISTEMA lo rechazará.

### H. Panel de entrega de actas (CU-23, RF-20)

- **CE-75** · *RF-20, CU-23* — CUANDO la Asistente o Dirección elige un período, EL SISTEMA mostrará por profesor: grupos con término en el período, actas entregadas, actas pendientes y, entre las pendientes, las vencidas (término ya pasado y acta todavía Abierta).
- **CE-76** · *A9* — EL SISTEMA propondrá como período el mes en curso.
- **CE-77** · *CU-23* — CUANDO el usuario abre el renglón de un profesor, EL SISTEMA listará sus grupos del período con código, nivel, horario, término, estado del acta, fecha de entrega y avance de captura (inscripciones completas de total).
- **CE-78** · *RF-20 excepción* — SI no hay grupos con término en el período, ENTONCES EL SISTEMA lo dirá de forma explícita.
- **CE-79** · *principio 6* — EL SISTEMA mostrará los totales del período (grupos, entregadas, pendientes, vencidas) y comprobará que sean la suma de los renglones de los profesores.
- **CE-80** · *L8* — EL SISTEMA contará el grupo con su profesor actual, aunque haya cambiado durante el período (001·CE-51).

### I. Reporte por sucursal (CU-24, RF-21)

- **CE-81** · *RF-21, HU-16* — CUANDO la Asistente o Dirección abre el reporte, EL SISTEMA mostrará por sucursal del estudiante cuántos están Activos, Desertores y Egresados hoy, con el total de cada sucursal y el total general.
- **CE-82** · *A10, HU-16* — CUANDO el usuario elige un período, EL SISTEMA mostrará además por sucursal: estudiantes registrados en el período, estudiantes que pasaron a Desertor en el período y estudiantes que pasaron a Egresado en el período.
- **CE-83** · *A10* — EL SISTEMA propondrá como período el mes en curso.
- **CE-84** · *CU-24* — CUANDO el usuario elige una sucursal, EL SISTEMA limitará el reporte a esa sucursal.
- **CE-85** · *RF-21 excepción* — SI no hay estudiantes en el período o en la sucursal elegida, ENTONCES EL SISTEMA mostrará los conteos en 0 con la indicación «Sin datos en el período», nunca una tabla vacía.
- **CE-86** · *principio 6* — EL SISTEMA obtendrá los conteos de cada sucursal y el total general en una sola operación, y comprobará que el total general sea la suma de las sucursales.
- **CE-87** · *Persona 2: «reportes visuales y directos»* — EL SISTEMA acompañará los conteos con barras proporcionales, con el número siempre escrito al lado.
- **CE-88** · *L9* — CUANDO el usuario abre una cifra del estado actual (Activos, Desertores o Egresados de una sucursal), EL SISTEMA abrirá el filtrado en la vista Estudiantes con esa sucursal y ese estado de matrícula, y el total coincidirá con la cifra.

### J. Bitácora (CU-04, RF-15, RN-15)

- **CE-89** · *RF-15, CU-04, 001·CE-94* — CUANDO Dirección consulta la bitácora, EL SISTEMA mostrará los registros de su organización, del más reciente al más antiguo, con fecha y hora, usuario, tipo de acción, entidad, registro afectado y detalle.
- **CE-90** · *CU-04* — EL SISTEMA permitirá filtrar la bitácora por rango de fechas, usuario, tipo de acción y entidad, con el total visible y todas las páginas recorribles (igual que CE-10 a CE-13).
- **CE-91** · *RF-15* — CUANDO Dirección abre un registro de modificación, EL SISTEMA mostrará los campos que cambiaron con su valor anterior y su valor nuevo.
- **CE-92** · *RN-15* — EL SISTEMA no ofrecerá ninguna forma de modificar ni eliminar registros de la bitácora.
- **CE-93** · *001·CE-94* — SI alguien sin el rol Dirección intenta consultar la bitácora, ENTONCES EL SISTEMA se lo negará y registrará la denegación.
- **CE-94** · *A11, RNF-10* — EL SISTEMA mostrará en la bitácora las cédulas y los teléfonos que aparezcan en valores anteriores o nuevos con solo sus últimos 4 caracteres visibles.

### K. Para todas las pantallas de esta spec

- **CE-95** · *RNF-05, RN-24, 001·CE-62* — EL SISTEMA aplicará cada permiso de esta spec sobre los datos mismos, de modo que se cumpla también cuando la petición no pasa por la interfaz, y nunca devolverá datos de otra organización.
- **CE-96** · *RNF-06* — EL SISTEMA permitirá usar el filtrado, el historial, el panel de actas y el reporte en una pantalla de 360 px de ancho sin desplazamiento horizontal de la página; las tablas anchas se desplazarán dentro de su propio marco.
- **CE-97** · *001·CE-101* — SI una operación se refiere a un estudiante, grupo, inscripción o factura que no existe o que el usuario no puede ver, ENTONCES EL SISTEMA responderá «no existe» (HTTP 404).
- **CE-98** · *Principio 9* — EL SISTEMA imprimirá los formatos de esta spec (resultado, historial, Hoja de matrícula) en hoja carta, con el emblema y los colores del manual de ADEI, y el rojo solo en las notas reprobadas.

## Requisitos no funcionales aplicables

| RNF | Qué exige en esta spec | Umbral |
|---|---|---|
| RNF-01 | Filtrado, historial, reporte | Menos de 2 s |
| RNF-03 | Filtrado | La Asistente combina 3 criterios en su primera sesión, tras 1 h de capacitación |
| RNF-05 | Permisos | Aplicados sobre los datos, entre roles y entre organizaciones |
| RNF-06 | Filtrado, historial, panel, reporte | 360 px sin desplazamiento horizontal de la página |
| RNF-07 | Volumen | 20,000 inscripciones y 20,000 estudiantes sin degradar RNF-01 |
| RNF-08 | Respaldo | La Asistente lo genera sola y contiene todos los registros |
| RNF-10 | Ley 787 | Cada consulta, exportación y respaldo queda en la bitácora; la Hoja de matrícula no lleva estado civil ni salud |

## Casos límite

- Un estudiante con tres inscripciones que cumplen los criterios: tres renglones en
  la vista Inscripciones y uno en la vista Estudiantes, que dice «3».
- Filtrar por estado académico «Reprobado» mientras el acta sigue Abierta: una inscripción
  con parciales sin capturar está Pendiente, no Reprobada, aunque lo capturado ya sea bajo
  (002·CE-21); aparece al filtrar por Pendiente. CE-16 usa el mismo cálculo del acta.
- Un grupo cuyo término es exactamente el primer día del rango: entra (CE-5).
- La Asistente pide la página 40 de un resultado de 3 páginas: ve la última página
  vacía con el total real y el aviso de que esa página no existe, como en la búsqueda (001).
- Una factura familiar para tres hermanos, asociada a la inscripción de uno solo: los
  tres la ven en su historial; solo esa inscripción la lleva en la Hoja de matrícula.
- Un estudiante pasa a Desertor y vuelve a Activo el mismo mes: el reporte del mes lo
  cuenta como Activo hoy y no lo cuenta entre los que pasaron a Desertor, porque solo
  se conoce el último cambio de estado (A10).
- Un respaldo con 20,000 estudiantes: el archivo se genera en una sola descarga.
- Una factura de US$34 en Efectivo, que es el caso más común en 2021.
- Exportar un resultado de 1 renglón: se genera el archivo con 1 fila.
- Un profesor que ve el enlace de un filtrado compartido por la Asistente: se le niega
  (CE-18) y queda registrado.

## Fuera de alcance

| Qué | Dónde se espera |
|---|---|
| Marcar en el historial las notas corregidas o con condición inferida en la migración (CU-19 paso 6, RN-19) | Spec 005: llegan con los datos migrados |
| Exportar a Excel la Hoja de matrícula (RF-18 dice «PDF o Excel») | No se hace: es un formato para imprimir y firmar. El historial sí se exporta a Excel (CE-43) |
| Generar o imprimir facturas fiscales | Fuera del proyecto (PB-12, ámbito de la DGI) |
| Respaldos automáticos o programados | Fuera del proyecto: la capa gratuita de Supabase no los incluye y el respaldo lo hace la Asistente (CE-31) |
| Bloqueo por intentos, correo de restablecimiento, cierre por inactividad | Spec 004 |
| Gráficos interactivos o tableros con filtros cruzados | No se hacen: CE-87 pide barras simples con el número al lado |
| Guardar consultas con nombre dentro del sistema | No se hace: la dirección de la página guarda los criterios (CE-23) |

## Datos de prueba

Todos sintéticos (constitución, principio 3). Ningún nombre, cédula ni teléfono de los
archivos de la academia. Para CE-20 se genera un conjunto de 20,000 estudiantes y
20,000 inscripciones ficticios repartidos entre las cuatro modalidades, con los
conteos de cada una conocidos de antemano (CE-21).

## Criterios de finalización

- Los 98 CE con test automático en verde, o con renglón firmado en la lista de comprobación manual si son de interfaz.
- Tabla de trazabilidad CE → RF/RN/A completa, sin huecos.
- `npm run test` y `npx tsc --noEmit` sin errores.
- Pruebas de seguridad del bloque (Newman) en verde contra la copia local.
- Lista de comprobación manual completa.

## Lista de comprobación manual

| # | Qué hacer | Qué debe pasar | CE | Verificado |
|---|---|---|---|---|
| 1 | Como Asistente, filtrar por sucursal + modalidad Sabatino + estado académico Reprobado | Solo aparecen esos, con el total; los horarios ofrecidos son solo los de Sabatino | CE-1, CE-6, CE-10, RNF-03 | ☑ 3-nov |
| 2 | Poner la fecha final antes que la inicial | Se rechaza indicando el criterio; los demás criterios siguen puestos | CE-7 | ☑ 3-nov |
| 3 | Cambiar a la vista Estudiantes con los mismos criterios | Un renglón por estudiante con la cantidad de inscripciones | CE-2, CE-15 | ☑ 3-nov |
| 4 | Filtrar algo sin coincidencias | «0 resultados» explícito | CE-13 | ☑ 3-nov |
| 5 | Exportar un resultado de más de una página y abrirlo en Excel | Todas las filas, las mismas columnas, los criterios arriba y las fechas como fechas | CE-24, CE-26, CE-30 | ☑ 3-nov |
| 6 | Imprimir el mismo resultado | Emblema, criterios, total y numeración continua | CE-29 | ☑ 3-nov |
| 7 | Copiar la dirección del filtrado y abrirla como profesor | Acceso negado | CE-18, CE-23 | ☑ 3-nov |
| 8 | Abrir el historial de un estudiante con un nivel reprobado y uno condicionado | Orden cronológico, reprobada en rojo, Condicionado con su justificación | CE-37, CE-38 | ☑ 3-nov |
| 9 | Imprimir la Hoja de matrícula de un menor con tutor | Formato de ADEI, datos llenos, «sin registro» donde falta, sin estado civil ni salud | CE-44 a CE-48 | ☑ 3-nov |
| 10 | Registrar una factura familiar de dos hermanos y asociarla a la inscripción de uno | Se ve en los dos expedientes; el número sale en la Hoja de matrícula de esa inscripción | CE-59 a CE-61, CE-45 | ☑ 3-nov |
| 11 | Registrar una factura de US$250 | Pide confirmar el monto atípico | CE-56 | ☑ 3-nov |
| 12 | Pasar a Desertor a un estudiante con una inscripción En curso y luego intentar inscribirlo | Advierte la inscripción; después la inscripción nueva se rechaza | CE-71, CE-72 | ☑ 3-nov |
| 13 | Abrir el panel de actas del mes | Por profesor, entregadas, pendientes y vencidas, con los totales | CE-75, CE-79 | ☑ 3-nov |
| 14 | Abrir el reporte por sucursal como Sub-directora y tocar la cifra de Desertores | Conteos por sucursal con barras; la cifra abre el filtrado correspondiente | CE-81, CE-87, CE-88 | ☑ 3-nov |
| 15 | Como Dirección, buscar en la bitácora el cambio de estado del punto 12 | Aparece con el estado anterior y el nuevo; la cédula sale enmascarada | CE-89 a CE-91, CE-94 | ☑ 3-nov |
| 16 | Como Asistente, generar el respaldo completo y abrirlo | Una hoja por conjunto, los totales en la primera, sin cuentas ni bitácora | CE-31 a CE-33 | ☑ 3-nov |
| 17 | Abrir el filtrado y el historial en un teléfono (360 px) | Sin desplazamiento horizontal de la página | CE-96 | ☑ 3-nov |

Verificada en producción el 3-nov-2026 (evidencia: `evidencias\spec-003\pruebas-manuales\INDICE.md`, fuera del repositorio). El renglón 6 se aprobó tras las correcciones de los PR #5 y #6 (hallazgo 1); el 7, tras el #5 (hallazgo 2: la negación queda en la bitácora).

## Impacto en el documento del curso

| Origen | Cambio en el SRS |
|---|---|
| A1 | CU-20: el resultado tiene dos vistas, Inscripciones y Estudiantes. CA-05 se mide en la vista Inscripciones |
| A3 | CU-20: el rango de fechas se aplica a los grupos en curso dentro del rango |
| A4 | CU-25: el respaldo no incluye cuentas ni bitácora; solo lo genera la Asistente |
| A7 | Diccionario de datos, `Factura.monto`: el umbral de confirmación es US$200 o C$7,325 |
| A8 | RF-13: la fecha del cambio de estado la propone el sistema (hoy) y la Asistente puede poner una anterior; se agrega una observación opcional |
| A10 | RF-21: el reporte tiene una parte de estado actual y una de movimientos del período |
| A11 | CU-04: la bitácora muestra cédulas y teléfonos enmascarados |
| Plan | Bitácora: nuevo tipo de acción «Incidente» para los errores de completitud (CE-11) |

# Spec 001 — Base y registro

**Estado:** aprobada (2026-10-29) · clarificación cerrada · pendiente de plan
**Fecha:** 2026-10-28
**Requisitos del SRS que cubre:** RF-01, RF-02, RF-03, RF-09, RF-12, RF-14, RF-15, RF-16 ·
RN-01, RN-02, RN-06, RN-07, RN-08, RN-09, RN-10, RN-11, RN-15, RN-16, RN-17, RN-21, RN-22, RN-23 ·
RNF-01, RNF-04, RNF-05, RNF-06, RNF-07, RNF-10 ·
Retroalimentación del docente (Fases 1 y 2): plan de mejora, acciones 2 y 6

## Contexto y objetivo

Es la primera de tres specs que forman el núcleo de SIGFIE-ADEI. Construye lo
que todo lo demás necesita: que solo entre quien debe, que cada persona vea solo
lo que le corresponde, que todo quede registrado, y que existan los datos sobre
los que se trabajará después — catálogos, estudiantes, grupos e inscripciones.

Ataca directamente dos defectos medidos en el archivo de 2021: el mismo
estudiante escrito de varias formas (17 % de coincidencia de nombres entre los
dos archivos de la academia) y los valores escritos a mano (94 variantes para
unos 30 niveles, 37 para 11 horarios). Después de esta spec, ninguno de los dos
puede volver a ocurrir en un registro nuevo.

Orden del núcleo: **001 Base y registro** → 002 Captura académica → 003 Filtrado
con verificación de completitud.

## Actores

- **Asistente de Dirección** — opera todo lo de esta spec.
- **Dirección** (Director y Sub-directora) — solo ingresa y busca; no modifica nada.
- **Profesor** — en esta spec solo ingresa al sistema; su trabajo llega en la 002.
- **Usuario** — actor abstracto: cualquiera de los anteriores al autenticarse.

## Casos de uso del SRS involucrados

CU-01 Iniciar sesión · CU-02 Aceptar aviso de privacidad · CU-03 Gestionar
cuentas de usuario · CU-05 Gestionar catálogos · CU-06 Registrar estudiante ·
CU-07 Registrar datos del tutor · CU-08 Actualizar datos del estudiante ·
CU-09 Abrir grupo · CU-10 Inscribir estudiante en grupo · CU-18 Buscar estudiante

## Historias de usuario

- HU-01: Como asistente de dirección, quiero ingresar con mi usuario y contraseña, para que solo el personal autorizado acceda a la información.
- HU-02: Como asistente de dirección, quiero registrar un estudiante con un identificador único, para que nunca existan dos expedientes de la misma persona.
- HU-03: Como asistente de dirección, quiero buscar un estudiante por su nombre o identificación, para localizar su expediente en segundos.
- HU-06: Como asistente de dirección, quiero actualizar la información de un estudiante, para mantener sus datos correctos.
- HU-12: Como asistente de dirección, quiero que el sistema informe sobre el uso responsable de los datos al ingresar, para cumplir la Ley 787.

## Criterios de aceptación (EARS)

Cada criterio declara el requisito, la regla o la pregunta de la entrevista
(P1–P8) que lo origina. Los marcados **P** son alcance nuevo respecto al SRS:
ver la sección "Impacto en el documento del curso". Los marcados con un código
de clarificación (A, C, L, K, T) resuelven un hallazgo de `clarificacion.md`. Los
marcados **Retro** responden al plan de mejora del docente.

### A. Acceso y cuentas

- **CE-1** · *RF-14* — CUANDO un usuario ingresa el nombre de usuario y la contraseña correctos de una cuenta Activa, EL SISTEMA le concederá acceso con los permisos de sus roles.
- **CE-2** · *RN-17* — EL SISTEMA otorgará a un usuario con varios roles la suma de los permisos de cada uno.
- **CE-3** · *RF-14* — SI las credenciales no son correctas, ENTONCES EL SISTEMA negará el acceso con un mensaje que no revele cuál de los dos datos falló.
- **CE-4** · *RF-14* — SI la cuenta está Inactiva, ENTONCES EL SISTEMA negará el acceso aunque la contraseña sea correcta.
- **CE-5** · *CU-03* — CUANDO la Asistente crea una cuenta, EL SISTEMA exigirá un nombre de usuario único de 4 a 30 caracteres, al menos un rol y una contraseña inicial de al menos 8 caracteres.
- **CE-6** · *CU-03* — DONDE la cuenta tenga el rol Profesor, EL SISTEMA la vinculará a exactamente un profesor del catálogo, y ese profesor no podrá tener una segunda cuenta.
- **CE-7** · *CU-03* — CUANDO la Asistente desactiva una cuenta, EL SISTEMA impedirá nuevos ingresos con ella sin eliminar la cuenta ni su historial de auditoría.
- **CE-8** · *P2, A4* — CUANDO la Asistente restablece la contraseña de un usuario, EL SISTEMA generará una contraseña temporal y se la mostrará una sola vez, para que la entregue en persona.
- **CE-70** · *A4* — SI una contraseña temporal no se usa en 72 horas, ENTONCES EL SISTEMA la invalidará.
- **CE-9** · *P2* — MIENTRAS un usuario tenga una contraseña temporal, EL SISTEMA no le dará acceso a ninguna función hasta que la cambie por una propia.
- **CE-10** · *P2* — DONDE el usuario tenga un correo registrado, EL SISTEMA le permitirá solicitar por sí mismo un enlace de restablecimiento enviado a ese correo.
- **CE-11** · *P2* — SI se solicita un restablecimiento por correo para un usuario inexistente o sin correo, ENTONCES EL SISTEMA responderá con el mismo mensaje que en el caso exitoso.
- **CE-71** · *A5* — EL SISTEMA dará al enlace de restablecimiento una validez de 1 hora.
- **CE-72** · *A5* — CUANDO un enlace de restablecimiento se usa, EL SISTEMA lo invalidará para cualquier uso posterior.
- **CE-12** · *RNF-04* — EL SISTEMA no almacenará ninguna contraseña en forma legible ni recuperable.
- **CE-13** · *CU-03, RN-17 · derivado (T2)* — SI una acción dejaría al sistema sin ninguna cuenta Activa con el rol Asistente de Dirección, ENTONCES EL SISTEMA la rechazará.
- **CE-63** · *P7, A2* — SI se registran 5 intentos de ingreso fallidos con un mismo nombre de usuario dentro de un lapso de 15 minutos, ENTONCES EL SISTEMA bloqueará el ingreso con ese nombre de usuario durante 15 minutos, exista o no la cuenta.
- **CE-64** · *P7* — MIENTRAS un nombre de usuario esté bloqueado, EL SISTEMA no validará la contraseña y mostrará el mismo mensaje exista o no la cuenta.
- **CE-65** · *P7* — CUANDO transcurren 15 minutos desde el bloqueo, EL SISTEMA lo levantará sin intervención de nadie.
- **CE-66** · *P7, CU-03* — CUANDO la Asistente levanta el bloqueo de una cuenta antes de tiempo, EL SISTEMA permitirá ingresar de inmediato.
- **CE-67** · *P7* — CUANDO un usuario ingresa con éxito, EL SISTEMA reiniciará su conteo de intentos fallidos.
- **CE-68** · *P7, RF-15* — CUANDO una cuenta se bloquea o se desbloquea, EL SISTEMA lo registrará en la auditoría.
- **CE-69** · *A3* — EL SISTEMA tratará el nombre de usuario sin distinguir mayúsculas, tanto para su unicidad como para el ingreso y el conteo de intentos fallidos.
- **CE-88** · *A1* — SI pasan 30 minutos sin actividad en una sesión, ENTONCES EL SISTEMA la cerrará.
- **CE-89** · *A1* — CUANDO faltan 2 minutos para el cierre por inactividad, EL SISTEMA avisará al usuario y le permitirá seguir conectado.
- **CE-90** · *A1* — SI una sesión cumple 12 horas, ENTONCES EL SISTEMA la cerrará aunque haya actividad.

### B. Aviso de privacidad

- **CE-14** · *RF-16, RN-16* — CUANDO un usuario inicia sesión, EL SISTEMA le presentará el aviso de privacidad vigente antes de mostrar cualquier dato.
- **CE-15** · *RN-16* — MIENTRAS el usuario no haya aceptado el aviso en la sesión en curso, EL SISTEMA no le dará acceso a ninguna función.
- **CE-16** · *RF-16* — CUANDO el usuario acepta el aviso, EL SISTEMA registrará la fecha, la hora y la versión aceptada.
- **CE-87** · *RNF-06, T3* — EL SISTEMA permitirá completar el ingreso, la aceptación del aviso y el cambio de contraseña en una pantalla de 360 px de ancho sin desplazamiento horizontal.

### C. Auditoría

- **CE-17** · *RF-15* — CUANDO se crea o modifica una cuenta, un valor de catálogo, un estudiante, un tutor, un grupo o una inscripción, EL SISTEMA registrará usuario, tipo de acción, entidad, registro afectado, valor anterior, valor nuevo y fecha-hora.
- **CE-18** · *RF-15* — CUANDO un usuario inicia sesión, es denegado o realiza una búsqueda, EL SISTEMA registrará la acción con su usuario y fecha-hora, y en las búsquedas el texto buscado.
- **CE-19** · *RN-15* — SI cualquier usuario, de cualquier rol, intenta modificar o eliminar un registro de auditoría, ENTONCES EL SISTEMA lo rechazará.
- **CE-20** · *RF-15* — SI una acción no puede quedar registrada en la auditoría, ENTONCES EL SISTEMA no la aplicará.
- **CE-94** · *K3, RN-15* — EL SISTEMA permitirá leer la auditoría únicamente a los usuarios con rol Dirección.

### D. Catálogos

- **CE-21** · *RF-02* — EL SISTEMA no ofrecerá campo de texto libre para nivel, modalidad, horario, profesor ni sucursal en ningún formulario.
- **CE-22** · *RF-02, A7* — SI se intenta crear un nivel, una modalidad, un horario o una sucursal que ya existe, comparando sin distinguir mayúsculas, tildes ni espacios exteriores, ENTONCES EL SISTEMA lo rechazará e indicará el valor existente.
- **CE-74** · *A7* — EL SISTEMA considerará que ya existe: un nivel con el mismo nombre o el mismo código; una modalidad o una sucursal con el mismo nombre; un horario con la misma modalidad, hora de inicio y hora de fin.
- **CE-75** · *A7* — SI se registra un profesor con los mismos nombres y apellidos que otro, ENTONCES EL SISTEMA advertirá la coincidencia y pedirá confirmar que es otra persona.
- **CE-23** · *RN-22* — SI se intenta eliminar un valor de catálogo que ya está en uso, ENTONCES EL SISTEMA lo impedirá y ofrecerá desactivarlo.
- **CE-24** · *RN-22* — MIENTRAS un valor de catálogo esté desactivado, EL SISTEMA no lo ofrecerá en registros nuevos.
- **CE-25** · *RN-22* — MIENTRAS un valor de catálogo esté desactivado, EL SISTEMA lo seguirá mostrando en los registros que ya lo usan.
- **CE-26** · *RN-07* — EL SISTEMA asociará cada horario a exactamente una modalidad.
- **CE-27** · *Diccionario: Horario.horaFin* — SI la hora de fin de un horario no es posterior a la de inicio, ENTONCES EL SISTEMA lo rechazará.
- **CE-28** · *Diccionario: Sucursal.esCentral* — EL SISTEMA mantendrá exactamente una sucursal marcada como central.
- **CE-83** · *L6* — CUANDO la Asistente desactiva un profesor del catálogo que tiene una cuenta Activa, EL SISTEMA se lo advertirá y le ofrecerá desactivar también la cuenta.

### E. Estudiantes

- **CE-29** · *RF-01, RN-01, P8* — CUANDO la Asistente registra un estudiante sin coincidencias, EL SISTEMA le asignará un código ADEI único con formato `ADEI-AAAA-NNNNN`, donde `AAAA` es el año de registro y el correlativo `NNNNN` reinicia cada año, estado de matrícula Activo y origen Captura, y mostrará el código asignado.
- **CE-30** · *RN-01* — SI la cédula ingresada ya pertenece a otro estudiante, ENTONCES EL SISTEMA rechazará el registro y mostrará el expediente existente.
- **CE-31** · *CU-06 A2* — SI no se ingresa cédula y ya existe un estudiante con los mismos nombres, apellidos y fecha de nacimiento, comparando sin distinguir mayúsculas ni tildes, ENTONCES EL SISTEMA mostrará ese expediente y pedirá confirmar que se trata de otra persona antes de registrar.
- **CE-32** · *CU-06 A2* — CUANDO la Asistente confirma que es otra persona, EL SISTEMA registrará el estudiante y dejará esa decisión en la auditoría.
- **CE-79** · *L1, RN-01* — SI se ingresa una cédula y existe un estudiante sin cédula con los mismos nombres, apellidos y fecha de nacimiento, ENTONCES EL SISTEMA mostrará ese expediente y ofrecerá completarlo con la cédula en lugar de crear uno nuevo.
- **CE-33** · *RN-02, CU-07* — SI el estudiante tiene menos de 18 años a la fecha de registro, ENTONCES EL SISTEMA exigirá al menos un tutor con nombre completo, cédula y teléfono.
- **CE-34** · *Diccionario: Estudiante.contactoEmergencia* — SI el estudiante tiene menos de 18 años, ENTONCES EL SISTEMA exigirá un contacto de emergencia.
- **CE-35** · *Diccionario: Estudiante.telefono* — SI el estudiante tiene 18 años o más, ENTONCES EL SISTEMA exigirá su teléfono.
- **CE-36** · *CU-06 E3, A9* — SI la fecha de nacimiento es posterior a hoy o la edad resultante es menor de 4 o mayor de 99 años, ENTONCES EL SISTEMA rechazará el dato.
- **CE-37** · *CU-06 E2* — SI un campo no cumple el formato del diccionario de datos, ENTONCES EL SISTEMA indicará el campo y la regla incumplida sin borrar lo ya ingresado.
- **CE-76** · *A10* — CUANDO se ingresa una cédula con la letra final en minúscula, EL SISTEMA la aceptará y la guardará en mayúscula.
- **CE-77** · *A11* — EL SISTEMA calculará toda fecha del día y toda edad según la hora de Nicaragua (UTC−6).
- **CE-38** · *CU-07* — DONDE el tutor ya esté registrado con la misma cédula, EL SISTEMA permitirá vincularlo a otro estudiante sin volver a capturar sus datos.
- **CE-82** · *L4, RN-02* — CUANDO la Asistente desvincula un tutor de un estudiante, EL SISTEMA lo permitirá, salvo que sea el único tutor de un menor de 18 años.
- **CE-39** · *RN-21, RNF-10* — EL SISTEMA no solicitará estado civil ni condición de salud en ningún formulario.
- **CE-40** · *RF-12* — CUANDO la Asistente modifica los datos personales de un estudiante, EL SISTEMA aplicará las mismas validaciones del registro, con la excepción de CE-80.
- **CE-41** · *RF-12, RN-01* — EL SISTEMA no permitirá modificar el código ADEI de un estudiante por ningún medio.
- **CE-80** · *L2* — SI un estudiante de 18 años o más no tiene teléfono registrado, ENTONCES EL SISTEMA advertirá la falta al editarlo, sin impedir que se guarden otros cambios.
- **CE-81** · *L3, RN-02* — SI una modificación de la fecha de nacimiento convierte al estudiante en menor de 18 años, ENTONCES EL SISTEMA exigirá un tutor antes de guardar.
- **CE-86** · *L10* — SI un estudiante fue modificado por otra sesión después de que la Asistente abrió su edición, ENTONCES EL SISTEMA no sobrescribirá esos cambios y le avisará.

### F. Búsqueda

- **CE-42** · *RF-09, A8* — CUANDO un usuario con rol Asistente de Dirección o Dirección escribe 3 o más caracteres, EL SISTEMA mostrará todos los estudiantes cuyo nombre completo, cédula o código ADEI contenga ese texto, sin distinguir mayúsculas ni tildes, ni guiones en el caso de la cédula, junto con el total de coincidencias.
- **CE-43** · *RF-09* — SI se escriben menos de 3 caracteres, ENTONCES EL SISTEMA no ejecutará la búsqueda e indicará el mínimo requerido.
- **CE-44** · *RF-09, RN-23* — SI no hay coincidencias, ENTONCES EL SISTEMA informará "0 resultados" de forma explícita, nunca con una lista vacía sin mensaje.
- **CE-45** · *RNF-01, RNF-07* — MIENTRAS haya hasta 20,000 estudiantes registrados, EL SISTEMA responderá cualquier búsqueda en menos de 2 segundos.
- **CE-46** · *CU-18* — SI un usuario cuyo único rol es Profesor intenta buscar estudiantes, ENTONCES EL SISTEMA se lo negará y registrará la denegación.
- **CE-73** · *A6* — EL SISTEMA ejecutará la búsqueda cuando el usuario deje de escribir, no por cada carácter.
- **CE-85** · *L9, K1, RN-23* — CUANDO una búsqueda tiene más resultados de los que caben en una página, EL SISTEMA mostrará el total real y permitirá recorrer todas las páginas, sin límite máximo de resultados.

### G. Grupos

- **CE-47** · *CU-09, RN-06, C2* — CUANDO la Asistente abre un grupo, EL SISTEMA exigirá exactamente un nivel, una modalidad, un horario, un profesor y una sucursal, y que el nivel, el horario y el profesor estén activos.
- **CE-48** · *CU-09, P8* — CUANDO se abre un grupo, EL SISTEMA le asignará un código único con formato `G-AAAA-NNNN`, cuyo correlativo reinicia cada año, y dejará su acta en estado Abierta.
- **CE-49** · *RN-07* — SI el horario elegido no pertenece a la modalidad elegida, ENTONCES EL SISTEMA rechazará el grupo.
- **CE-50** · *RN-08* — SI la fecha de término no es posterior a la de inicio, ENTONCES EL SISTEMA rechazará el grupo.
- **CE-50a** · *RN-08, prueba manual 12* — SI una fecha del grupo no existe o su año no tiene cuatro cifras, si la fecha de inicio queda a más de un año de hoy (antes o después), o si la de término queda a más de un año de la de inicio, ENTONCES EL SISTEMA rechazará el grupo indicando la regla. *(Añadido el 2026-11-01: el campo de fecha del navegador dejaba teclear años de seis cifras, como «602026».)*
- **CE-51** · *P6, L5* — MIENTRAS el acta del grupo esté Abierta, EL SISTEMA permitirá a la Asistente cambiar el profesor asignado por otro profesor activo, exigiendo un motivo.
- **CE-52** · *P6, RN-10* — CUANDO se cambia el profesor de un grupo, EL SISTEMA retirará de inmediato al profesor anterior el acceso a ese grupo.
- **CE-53** · *P6, RN-11* — SI el acta del grupo está Entregada, ENTONCES EL SISTEMA no permitirá cambiar su profesor.
- **CE-91** · *L7* — EL SISTEMA permitirá abrir un grupo con fecha de inicio anterior a hoy.
- **CE-92** · *L7* — SI la fecha de término de un grupo es anterior a hoy, ENTONCES EL SISTEMA rechazará abrirlo.

### H. Inscripciones

- **CE-54** · *RF-03* — CUANDO la Asistente inscribe a un estudiante en un grupo, EL SISTEMA registrará la inscripción en estado En curso con la fecha del día.
- **CE-55** · *RF-03* — SI el estudiante no está en estado Activo, ENTONCES EL SISTEMA rechazará la inscripción.
- **CE-56** · *RN-09* — SI el estudiante ya está inscrito en ese grupo, ENTONCES EL SISTEMA rechazará la segunda inscripción.
- **CE-57** · *RF-03* — SI el acta del grupo está Entregada, ENTONCES EL SISTEMA rechazará nuevas inscripciones.
- **CE-93** · *L7* — SI la fecha de término del grupo ya pasó, ENTONCES EL SISTEMA rechazará nuevas inscripciones en él.
- **CE-58** · *P6* — MIENTRAS el acta esté Abierta, EL SISTEMA permitirá a la Asistente anular una inscripción hecha por error, exigiendo un motivo.
- **CE-59** · *P6, RF-15* — CUANDO se anula una inscripción, EL SISTEMA conservará en la auditoría todos sus datos tal como estaban.
- **CE-60** · *P6* — SI la inscripción ya tiene algún parcial registrado, ENTONCES EL SISTEMA no permitirá anularla.
- **CE-84** · *L8* — SI se inscribe a un estudiante en un grupo cuyas fechas y horario se superponen con otra inscripción En curso del mismo estudiante, ENTONCES EL SISTEMA advertirá la superposición y pedirá confirmar.

### I. Permisos

- **CE-61** · *RF-14, C1* — SI un usuario cuyos roles son solo Dirección intenta crear o modificar estudiantes, tutores, grupos, inscripciones, valores de catálogo o cuentas de otros usuarios, ENTONCES EL SISTEMA lo rechazará.
- **CE-78** · *C1* — EL SISTEMA permitirá a todo usuario, cualquiera sea su rol, aceptar el aviso de privacidad y cambiar su propia contraseña.
- **CE-62** · *RNF-05* — EL SISTEMA aplicará cada restricción de permiso sobre los datos mismos, de modo que se cumpla también cuando la petición no pasa por la interfaz.

### J. Organización (aislamiento multi-tenant)

Una **organización** es una academia que usa el sistema. ADEI es la primera y, por
ahora, la única. Sus tres sucursales pertenecen a la misma organización: la
Asistente de Dirección sigue viendo las tres. Multi-sede y multi-tenant son cosas
distintas, y el sistema tiene las dos.

- **CE-95** · *Retro-2* — EL SISTEMA asociará cada cuenta, valor de catálogo, estudiante, tutor, grupo, inscripción y registro de auditoría a exactamente una organización.
- **CE-96** · *Retro-2, RNF-05* — EL SISTEMA mostrará a cada usuario únicamente datos de su propia organización.
- **CE-97** · *Retro-2* — SI una operación relacionaría registros de organizaciones distintas, ENTONCES EL SISTEMA la rechazará.
- **CE-98** · *Retro-2* — EL SISTEMA aplicará la unicidad de cédulas, códigos y valores de catálogo dentro de cada organización.
- **CE-99** · *Retro-2, CE-48* — EL SISTEMA formará el código de estudiante con el prefijo de su organización y llevará los correlativos de estudiantes y de grupos por separado para cada organización. El código de grupo conserva el formato `G-AAAA-NNNN` del diccionario de datos, porque solo se muestra dentro de su organización.
- **CE-100** · *Retro-6, CE-62* — SI un usuario intenta leer o modificar un registro de otra organización, aunque la petición no pase por la interfaz, ENTONCES EL SISTEMA no se lo devolverá ni lo modificará.

## Requisitos no funcionales aplicables

| RNF | Qué exige en esta spec | Umbral |
|---|---|---|
| RNF-01 | Búsqueda | Menos de 2 s |
| RNF-04 | Contraseñas | Derivación de clave con salt; nunca texto plano |
| RNF-05 | Permisos | Aplicados sobre los datos, no solo en pantalla |
| RNF-06 | Ingreso, aviso y cambio de contraseña | Operables a 360 px de ancho sin desplazamiento horizontal |
| RNF-07 | Volumen | 20,000 estudiantes sin degradar RNF-01 |
| RNF-10 | Ley 787 | Roles, aviso con aceptación, auditoría, sin datos innecesarios |

## Restricciones para el plan

- **K2** — CE-10 depende de un servicio de envío de correo. El plan debe verificar
  que el servicio elegido cabe en una capa gratuita apta para uso real
  (constitución, principio 11), o justificar la alternativa.

## Casos límite

- Estudiante que cumple 18 años: la edad se calcula a la fecha de registro; si cumple años ese mismo día, ya es mayor de edad.
- Tutor que tiene a cargo a varios hermanos: un solo registro de tutor vinculado a varios estudiantes (CE-38).
- Nombres con tildes, eñes y apóstrofes: "Gutiérrez", "Muñoz", "D'Arbelles" se aceptan y se encuentran escribiendo sin tilde.
- Búsqueda por apellido y nombre en orden inverso ("Gutierrez Ana"): no está cubierta; se busca el texto tal cual sobre el nombre completo.
- Código ADEI al cambiar de año: el primero de 2027 es `ADEI-2027-00001`; no choca con `ADEI-2026-00001` porque el año forma parte del código.
- Profesor desactivado en el catálogo con grupos abiertos: sus grupos existentes no cambian; no aparece para grupos nuevos (CE-24, CE-25).
- Cambio de profesor de un grupo cuyo profesor nuevo no tiene cuenta todavía: se permite; el grupo queda sin quien lo vea hasta que se cree la cuenta.
- Sesión expirada a mitad de un formulario: el sistema pide ingresar de nuevo y no aplica la acción a medias.
- Dos registros simultáneos con la misma cédula: solo uno se acepta; el otro recibe el rechazo de CE-30.
- La Asistente intenta desactivarse a sí misma siendo la única Asistente: rechazado (CE-13).
- Alguien escribe mal a propósito la contraseña de la Asistente para dejarla fuera: el bloqueo dura 15 minutos y se levanta solo (CE-65); nadie puede bloquearla de forma permanente.

## Fuera de alcance

| Qué | Dónde se espera |
|---|---|
| Lo que ve y hace el profesor tras ingresar: sus grupos, parciales, nota final, estado académico, entrega de acta (RF-04 a RF-08) | Spec 002 |
| Filtrado multicriterio con verificación de completitud (RF-10) | Spec 003 |
| Migración del acervo de 2021 y revisión de registros (RF-22, CU-26, CU-27) | Spec posterior |
| Historial académico (RF-11) y cambio de estado de matrícula (RF-13) | Spec posterior |
| Facturas (RF-17, CU-11), formatos prellenados (RF-18), exportación (RF-19) | Spec posterior |
| Panel de actas (RF-20), reporte estadístico (RF-21), respaldo completo (CU-25) | Spec posterior |
| Consulta de la bitácora por Dirección (CU-04): en esta spec se registra, no se consulta | Spec posterior |
| Modificación de un acta entregada (CU-17) | Spec 002 o posterior |
| Inscripciones en estado Trasladada o Retirada | Spec 002 |
| Landing page pública | Última spec |
| Crear o administrar organizaciones desde el sistema; un usuario en varias organizaciones | Fuera del proyecto. La organización ADEI se crea en la migración de base |

En esta spec todos los estudiantes quedan en estado Activo: nadie puede todavía
cambiarlo. CE-55 se verifica con datos de prueba preparados para ese fin.

## Datos de prueba

Todos sintéticos (constitución, principio 3). Ningún nombre, cédula ni teléfono
de los archivos de la academia. Se genera un conjunto de 20,000 estudiantes
ficticios para verificar CE-45.

## Criterios de finalización

- Los 100 CE con test automático en verde, o con renglón firmado en la lista de comprobación manual si son de interfaz.
- Tabla de trazabilidad CE → RF/RN/P completa, sin huecos.
- `npm run test` y `npx tsc --noEmit` sin errores.
- Lista de comprobación manual completa.

## Lista de comprobación manual

| # | Qué hacer | Qué debe pasar | CE | Verificado |
|---|---|---|---|---|
| 1 | Ingresar desde un teléfono (360 px) con una cuenta de profesor | Ingreso, aviso y cambio de contraseña operables sin desplazamiento horizontal | CE-14, RNF-06 | ☐ |
| 2 | Ingresar con contraseña equivocada y luego con usuario inexistente | Mismo mensaje en los dos casos | CE-3 | ☐ |
| 3 | Restablecer la contraseña de un profesor como Asistente e ingresar con ella | Obliga a cambiarla antes de hacer cualquier cosa | CE-8, CE-9 | ☐ |
| 4 | Solicitar el enlace por correo con una cuenta que tiene correo | Llega el enlace y permite fijar una contraseña nueva | CE-10 | ☐ |
| 5 | Cerrar el aviso sin aceptarlo | No se accede a ninguna función | CE-15 | ☐ |
| 6 | Revisar cada formulario | Ningún campo de texto libre para nivel, modalidad, horario, profesor o sucursal; ninguno pide estado civil ni salud | CE-21, CE-39 | ☐ |
| 7 | Registrar un estudiante de 12 años sin tutor | Se exige el tutor | CE-33 | ☐ |
| 8 | Registrar a dos hermanos con el mismo tutor | El tutor se captura una sola vez | CE-38 | ☐ |
| 9 | Ingresar una cédula mal formada | Se indica el campo y la regla, sin borrar lo demás | CE-37 | ☐ |
| 10 | Buscar "gutierrez" con un estudiante "Gutiérrez" registrado | Aparece, con el total visible | CE-42 | ☐ |
| 11 | Buscar un texto sin coincidencias | "0 resultados" explícito | CE-44 | ☐ |
| 12 | Elegir la modalidad Sabatino al abrir un grupo | Solo se ofrecen horarios de Sabatino | CE-49 | ☐ |
| 13 | Cambiar el profesor de un grupo y entrar como el profesor anterior | Ya no tiene acceso a ese grupo | CE-52 | ☐ |
| 14 | Fallar 5 veces el ingreso con un usuario existente y 5 con uno inexistente | Mismo mensaje de bloqueo en los dos casos | CE-63, CE-64 | ☐ |

## Impacto en el documento del curso

Las respuestas de la entrevista agregan alcance que el SRS no tenía. Cuando se
incorpore la retroalimentación del docente, estos cambios deben llevarse al
documento consolidado:

| Pregunta | Cambio en el SRS |
|---|---|
| P1 | El núcleo se implementa en tres specs: base y registro, captura académica, filtrado. |
| P2 | Clase `Usuario`: nuevo atributo `correo` (opcional) y marca de contraseña temporal. CU-03 incluye restablecer la contraseña. Nuevo flujo de autoservicio por correo. |
| P3 | CU-03 entra en el núcleo. |
| P4 | El aviso de privacidad inicia como versión v0.1, borrador redactado por el equipo, pendiente de revisión de la Dirección. |
| P5 | CU-08 / RF-12 entra en el núcleo. |
| P6 | CU-09: el profesor de un grupo puede cambiarse mientras el acta esté Abierta, con motivo. CU-10: una inscripción hecha por error puede anularse mientras el acta esté Abierta y no tenga parciales, con motivo. |
| P7 | CU-01: bloqueo temporal de 15 minutos tras 5 intentos fallidos seguidos, que se levanta solo o lo levanta la Asistente. Base: OWASP Authentication Cheat Sheet y NIST SP 800-63B. |
| Retro | Nueva clase `Organizacion` (código, nombre). `Sucursal` y todas las clases de datos pasan a pertenecer a una organización. Responde a las acciones 2 y 6 del plan de mejora del docente |
| P8 | Diccionario de datos: los correlativos de `codigoADEI` y `codigoGrupo` reinician cada año. |

## Dudas abiertas

- [NECESITA ACLARACIÓN] Texto definitivo del aviso de privacidad: lo debe revisar la Dirección de ADEI. Se trabaja con el borrador v0.1.

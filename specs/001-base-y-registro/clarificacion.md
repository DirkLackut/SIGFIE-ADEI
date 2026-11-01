# Clarificación — Spec 001 Base y registro

**Fecha:** 2026-10-29 · **Estado:** cerrada · 29 de 29 resueltos y aplicados a `spec.md` (A1, L7 y K3 aprobados por Dirk el 2026-10-29)

Revisión de QA sobre la spec aprobada. Solo detecta; las resoluciones se
deciden después y se aplican a `spec.md` con su diff.

## 1. Ambigüedades

- **A1** · CE-14, CE-15 — No se define cuánto dura una sesión ni cuándo expira por inactividad. La PC de la Sucursal Central es compartida.
- **A2** · CE-63 — "5 intentos fallidos seguidos" no tiene ventana de tiempo: ¿cuentan 5 fallos repartidos en tres días?
- **A3** · CE-5, CE-63 — No se dice si el nombre de usuario distingue mayúsculas: ¿"Aura" y "aura" son el mismo usuario y comparten el conteo de bloqueo?
- **A4** · CE-8 — No se dice cómo recibe el usuario la contraseña temporal ni si vence.
- **A5** · CE-10 — No se dice cuánto tiempo es válido el enlace de restablecimiento ni si sirve más de una vez.
- **A6** · CE-42, CE-18 — No se dice si la búsqueda corre mientras se escribe o al confirmar. Si corre mientras se escribe, CE-18 registraría una búsqueda por cada letra.
- **A7** · CE-22 — "Valor que ya existe" no está definido por catálogo: dos profesores distintos pueden llamarse igual; un horario se identifica por modalidad + hora de inicio + hora de fin.
- **A8** · CE-42 — No se dice si buscar una cédula ignora los guiones ("0012003" vs "001-200").
- **A9** · CE-36 — No se dice si 4 y 99 años están dentro o fuera del rango.
- **A10** · CE-37 — No se dice si la letra final de la cédula se acepta en minúscula.
- **A11** · CE-54 — "La fecha del día" no dice en qué hora: el servidor puede estar en otro huso horario y, cerca de la medianoche, registrar el día siguiente.

## 2. Contradicciones

- **C1** · CE-61 vs CE-9, CE-16, CE-18 — CE-61 prohíbe a Dirección crear o modificar "cualquier registro", pero para usar el sistema Dirección tiene que aceptar el aviso, cambiar su contraseña temporal y generar registros de auditoría al buscar.
- **C2** · CE-47 vs diccionario de datos — CE-47 exige que la sucursal esté "activa", pero la entidad Sucursal no tiene atributo `activo` en el diccionario.

## 3. Casos límite no cubiertos

- **L1** · CE-31 — La detección de duplicados solo corre cuando **no** se ingresa cédula. Si se registra a alguien **con** cédula y ya existe la misma persona sin cédula (nombre + fecha de nacimiento iguales), entra como estudiante nuevo.
- **L2** · CE-40 — Un estudiante registrado como menor cumple 18 años: al editar cualquier otro dato, CE-35 exigiría su teléfono y bloquearía la edición si no lo tiene.
- **L3** · CE-40 — Cambiar la fecha de nacimiento puede convertir a un adulto en menor sin tutor.
- **L4** · CE-38 — No se cubre desvincular un tutor, ni qué pasa si es el único tutor de un menor.
- **L5** · CE-51 — No se exige que el profesor nuevo esté activo al cambiar el profesor de un grupo (CE-47 solo lo exige al abrirlo).
- **L6** · CE-7, CE-24 — Desactivar a un profesor en el catálogo no dice qué pasa con su cuenta de usuario.
- **L7** · CE-48, CE-54 — No se dice si se puede abrir un grupo con fechas ya pasadas, ni inscribir en un grupo cuya fecha de término ya pasó.
- **L8** · CE-56 — RN-09 impide la doble inscripción en el mismo grupo, pero nada dice si un estudiante puede estar en dos grupos con fechas superpuestas.
- **L9** · CE-42 — Una búsqueda de 3 letras ("ana") puede devolver miles de estudiantes; no se dice cómo se presentan todos.
- **L10** · CE-40 — Dos sesiones editando al mismo estudiante a la vez: no se dice cuál cambio prevalece ni si se avisa.

## 4. Conflictos con la constitución

- **K1** · Principio 6 ↔ L9 — Si una búsqueda con miles de resultados se presenta por páginas, hay que definir que paginar no es "resultado parcial": el total debe ser el real y todas las páginas alcanzables.
- **K2** · Principio 11 ↔ CE-10 — El restablecimiento por correo depende de un servicio de envío de correo. Hay que verificar en el plan que cabe en una capa gratuita apta para uso real.
- **K3** · Principio 3 / RNF-10 ↔ CE-18 — Registrar el texto buscado guarda cédulas y nombres en la auditoría. Es legítimo (Ley 787 pide auditoría), pero no se define quién puede leerlo ni por cuánto tiempo se conserva.

## 5. Trazabilidad débil

- **T1** · CE-27, CE-28, CE-34, CE-35 — Citan "Diccionario" sin el atributo concreto (sección 5 del SRS).
- **T2** · CE-13 — Cita RN-17 (varios roles por usuario), que no habla de proteger a la última Asistente; es un criterio derivado sin origen explícito.
- **T3** · RNF-06 — Declarado en la spec, sin ningún CE; solo aparece en la lista de comprobación manual.

**Total: 29 hallazgos** (11 ambigüedades, 2 contradicciones, 10 casos límite, 3 conflictos, 3 de trazabilidad).

---

## Resolución

Los hallazgos con respuesta lógica se resolvieron y aplicaron a `spec.md`. Los que
dependen de una decisión del usuario o de ADEI quedan como propuesta.

| Hallazgo | Resolución | Criterio |
|---|---|---|
| A1 | Cierre a los 30 min sin actividad, aviso a los 28, máximo 12 horas | CE-88, CE-89, CE-90 |
| A2 | Los 5 fallos cuentan dentro de un lapso de 15 minutos | CE-63 |
| A3 | El nombre de usuario no distingue mayúsculas, ni para unicidad ni para el bloqueo | CE-69 |
| A4 | La contraseña temporal se muestra una vez a la Asistente y vence en 72 horas | CE-8, CE-70 |
| A5 | Enlace de restablecimiento válido 1 hora y de un solo uso | CE-71, CE-72 |
| A6 | La búsqueda se ejecuta al dejar de escribir, no por cada letra | CE-73 |
| A7 | Identidad de duplicado definida por catálogo; profesores homónimos se advierten, no se rechazan | CE-22, CE-74, CE-75 |
| A8 | La búsqueda por cédula ignora guiones | CE-42 |
| A9 | 4 y 99 años son válidos | CE-36 |
| A10 | La letra de la cédula se acepta en minúscula y se guarda en mayúscula | CE-76 |
| A11 | Fechas y edades en hora de Nicaragua (UTC−6) | CE-77 |
| C1 | Dirección no modifica datos de la academia, pero sí acepta el aviso y cambia su contraseña | CE-61, CE-78 |
| C2 | La sucursal no tiene estado activo; CE-47 exige activos solo nivel, horario y profesor | CE-47 |
| L1 | Con cédula, si existe la misma persona sin cédula, se ofrece completar su expediente | CE-79 |
| L2 | Falta de teléfono en un adulto se advierte al editar, sin bloquear | CE-40, CE-80 |
| L3 | Si la nueva fecha de nacimiento lo vuelve menor, se exige tutor | CE-81 |
| L4 | Se puede desvincular un tutor, salvo el único de un menor | CE-82 |
| L5 | El profesor nuevo de un grupo debe estar activo | CE-51 |
| L6 | Al desactivar un profesor con cuenta Activa, se advierte y se ofrece desactivar la cuenta | CE-83 |
| L7 | Se abre un grupo ya iniciado, no uno terminado; no se inscribe en un grupo terminado | CE-91, CE-92, CE-93 |
| L8 | Inscripciones superpuestas en fecha y horario se advierten y se confirman | CE-84 |
| L9 | Paginación con total real y todas las páginas alcanzables | CE-85 |
| L10 | No se sobrescriben cambios hechos por otra sesión | CE-86 |
| K1 | Paginar no es resultado parcial mientras se cumpla CE-85 | CE-85 |
| K2 | Pasa como restricción obligatoria del plan | spec.md → Restricciones para el plan |
| K3 | Solo Dirección lee la auditoría; nadie la borra | CE-94, CE-19 |
| T1 | Se cita el atributo concreto del diccionario | CE-27, CE-28, CE-34, CE-35 |
| T2 | CE-13 marcado como derivado de CU-03 y RN-17 | CE-13 |
| T3 | RNF-06 obtiene su propio criterio | CE-87 |

## Propuestas aprobadas (2026-10-29)

**A1 — Duración de la sesión.** Cierre por inactividad a los 30 minutos y duración
máxima de 12 horas (una jornada). A los 28 minutos sin actividad aparece un aviso
para seguir conectado; si nadie responde, la sesión se cierra y lo que no se había
guardado se pierde. Motivo: la PC de la Sucursal Central es compartida y tiene
abiertos datos de menores.

**L7 — Grupos con fechas pasadas.** Al arrancar el sistema habrá niveles que ya
empezaron. Propuesta: se puede abrir un grupo con fecha de inicio pasada, pero no
con fecha de término pasada; y no se inscribe en un grupo cuya fecha de término ya
pasó. Los grupos ya terminados entran solo por la migración.

**K3 — Quién lee lo buscado.** El texto de cada búsqueda queda en la auditoría.
Propuesta: solo Dirección puede leer la auditoría (CU-04, spec posterior); nadie la
borra (RN-15, el SRS ya la declara inalterable, por lo que se conserva sin límite de
tiempo). La Asistente no ve las búsquedas de los demás.

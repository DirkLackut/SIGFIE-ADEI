# Plan — Spec 002 Captura académica

**Fecha:** 2026-11-02 · **Estado:** aprobado junto con la spec (Dirk: «comienza entonces»)
**Base:** el plan de la 001 sigue vigente (arquitectura, seguridad, auditoría,
pruebas, identidad visual). Aquí solo va lo nuevo.

## 1. Qué se agrega

| Capa | Nuevo |
|---|---|
| Base | Migraciones `012_captura_academica.sql` y `013_catalogo_cliente.sql` |
| Dominio | `src/dominio/notas.ts` (cálculo, redondeo, estado, franja) y `src/dominio/ruta.ts` (posición de un nivel en su ruta) |
| Datos | `src/datos/actas.ts` (llamadas a las operaciones de la 012) |
| Pantallas | `/mis-grupos` y `/mis-grupos/[id]` (profesor); sección «Acta» en `/grupos/[id]` (Asistente y Dirección); `/actas/[id]/imprimir` (los tres, sin el menú del sistema); `/reglas` (Asistente registra, Dirección consulta, CE-58), enlazada desde Catálogos |
| Pruebas | `tests/dominio/notas.test.ts`, `ruta.test.ts`; `tests/bd/t18-…` a `t21-…` en PGlite |

Sin dependencias nuevas. El acta impresa es una página con estilos de impresión
(`@media print`); el navegador la guarda en PDF.

## 2. Decisiones

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D24 | **El estado académico se calcula al leer**, en una vista con `security_invoker`, no se guarda | Guardar nota y estado con un trigger | CE-27 exige que corregir una regla provisional cambie todos los grupos evaluados con ella. Guardado, habría que recalcular miles de filas en cada corrección; calculado, siempre es coherente. Una nota de 3 enteros se calcula en microsegundos |
| D25 | **El cálculo vive dos veces**: en SQL (la verdad) y en `dominio/notas.ts` (vista previa mientras se escribe) | Solo SQL, o solo TypeScript | Principio 1 (la regla en la base) y principio 4 (lógica pura testeable). Igual que `superposicion.ts` en la 001: los dos se prueban con los mismos casos |
| D26 | **Las tablas nuevas no se escriben directo por la API**: solo tienen políticas de lectura; toda escritura pasa por funciones `security definer` que comprueban rol, grupo y estado del acta | Políticas de escritura por rol, como en la 001 | Las reglas de quién escribe qué dependen del estado del acta, de la fecha de término y de la autorización de reprogramación. En una función se leen y se prueban; en políticas quedarían repartidas. Cumple igual CE-60: la única puerta es la función |
| D27 | **Un parcial sin fila es un parcial sin condición** | Tres filas creadas al inscribir, con condición nula | Menos estados posibles: la fila existe solo cuando el parcial tiene condición. RN-12 se comprueba contando filas |
| D28 | **La ruta de un nivel se calcula en una función**: curso principal 1→16; Conversation sigue con Conversation Avanzada; los demás programas son rutas propias | Una tabla de rutas | Son dos rutas fijas que dio la cliente; una tabla y su pantalla serían más código que el problema |
| D29 | **El acta se lee con una sola función** (`acta_del_grupo`) que devuelve encabezado, filas y resumen, y registra la denegación si quien pide no tiene acceso | Varias consultas desde la pantalla | CE-5 (el profesor solo ve nombre y código; la tabla `estudiante` no es legible para él) y CE-4 (la denegación debe quedar registrada sin deshacerse, igual que `buscar_estudiantes`) |

## 3. Modelo de datos (012)

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `regla_aprobacion` | programa, nivel_desde, nivel_hasta, vigente_desde, nota_minima, condicionado_desde, nota_condicion, provisional | 1 ≤ desde ≤ hasta ≤ 99; notas 0–100; `condicionado_desde < nota_minima`; las dos de Condicionado juntas o ninguna. Sin superposición (trigger, CE-26). Solo se modifica o borra si era provisional (trigger, CE-28) |
| `parcial` | inscripcion_id, numero (1–3), condicion, valor, reprogramacion_autorizada, recibo_reprogramacion | Único (inscripción, número). Valor obligatorio y 0–100 si Registrado o Reprogramado, nulo si no (CE-8 a CE-10). Reprogramado exige autorización (CE-35). Llave foránea a `inscripcion` **sin** cascada: anular una inscripción con parciales falla (001·CE-60) |
| `calificacion` | inscripcion_id (único), condicionado, justificacion_condicionado, aviso_inasistencia, aviso_inasistencia_en, baja_inasistencia, version | Justificación obligatoria si condicionado. `version` sube en cada cambio de la inscripción: es la protección de CE-12 |

Todas con `organizacion_id`, llaves foráneas compuestas, RLS y el trigger de
auditoría de la 001 (CE-59, CE-61). La regla de aprobación se ve con las otras tablas
de catálogo.

**Vista `resultado_academico`** (`security_invoker`, D24): una fila por inscripción
con parciales, faltantes, nota exacta, nota final, provisional, la regla aplicada
(id, mínima, franja, provisional), `sin_regla` y el estado:

1. Retirada o Trasladada → sin nota ni estado (CE-38, CE-40).
2. Tres Justificados → sin nota; «decidir retiro» (CE-18).
3. Baja por inasistencia → Reprobado (CE-39).
4. Algún parcial sin fila → Provisional, estado Pendiente (CE-16, CE-21).
5. Sin regla → Pendiente y `sin_regla` (CE-23).
6. Condicionado marcado → Condicionado (CE-29).
7. Nota redondeada ≥ mínima → Aprobado; si no, Reprobado (CE-17, CE-19).

La regla aplicable es la del programa y el orden del nivel con la `vigente_desde`
más reciente que no pase la fecha de inicio del grupo (CE-20). El redondeo es
`round()` de PostgreSQL, que lleva las mitades hacia arriba en positivos (CE-17).

## 4. Operaciones (012)

Todas `security definer` con `search_path = ''`, comprueban `acceso_habilitado()` y
la organización, y responden «no existe» con `PT404` (001·CE-101).

| Función | Quién | Qué hace | CE |
|---|---|---|---|
| `mis_grupos()` | Profesor | Sus grupos con el avance (completas / total) | CE-1 a CE-3 |
| `acta_del_grupo(grupo)` | Profesor del grupo, Asistente, Dirección | Encabezado, filas (solo nombre, apellidos y código para el profesor), resultados, resumen. A otro profesor: registra la denegación y responde `denegado` | CE-4 a CE-6, CE-42, CE-58 |
| `guardar_parciales(inscripcion, parciales, version, motivo)` | Profesor con acta Abierta; Asistente con acta Entregada y motivo | Reemplaza los tres parciales de la inscripción; rechaza si cambió la versión | CE-7 a CE-13, CE-34 a CE-36, CE-47 a CE-49 |
| `autorizar_reprogramacion(inscripcion, numero, recibo)` | Asistente | Solo sobre un No presentado y antes del término | CE-32, CE-33 |
| `avisar_inasistencia(inscripcion, observacion)` | Profesor, acta Abierta | Deja el aviso para la Asistente | CE-37 |
| `decidir_salida(inscripcion, decision, motivo, confirmar)` | Asistente | `retiro`, `baja`, `traslado` o `continua` (descarta el aviso si el estudiante volvió); con parciales con valor, pide confirmar | CE-37 a CE-41 |
| `condicionar(inscripcion, justificacion)` y `quitar_condicionado(inscripcion, motivo)` | Asistente | Solo dentro de la franja | CE-29 a CE-31 |
| `entregar_acta(grupo, confirmar)` | Profesor del grupo | Sin confirmar devuelve el resumen o lo que falta; confirmado, entrega en una sola transacción y pasa las inscripciones En curso a Completada | CE-42 a CE-46 |
| `inscribir(…)` (se reemplaza) | Asistente | Agrega la respuesta `antecedente` con motivo obligatorio | CE-54 a CE-56 |
| `anular_inscripcion(…)` (se reemplaza) | Asistente | Rechaza si hay parciales; si solo hay un aviso, lo borra con ella. Pasa a `security definer` porque borra en `calificacion` | 001·CE-60 |
| `guardar_regla(datos)` y `eliminar_regla(id)` | Asistente | Agregar, corregir o borrar una regla; los triggers de la tabla deciden si se puede | CE-25 a CE-28 |

Las de la Asistente usan `interno.exigir_asistente()` y `interno.anotar_motivo()`
de la 001, de modo que el motivo queda en la auditoría de la fila que cambió.

## 5. Permisos (RLS de lectura)

| Tabla o vista | Asistente | Dirección | Profesor |
|---|---|---|---|
| `regla_aprobacion` | lee | lee | lee |
| `parcial`, `calificacion`, `resultado_academico` | lee | lee | lee solo los de sus grupos |

Nadie escribe directo en las tablas nuevas (D26). La lista de funciones que un
usuario puede ejecutar crece con las de la sección 4; la vigilan
`tests/bd/t11-permisos.test.ts` y `scripts/verificar-supabase.mts`.

## 6. Catálogo con las respuestas de la cliente (013)

Solo actúa sobre la organización con código `ADEI`; en las pruebas sin semilla no
hace nada.

1. (En la 012, porque es estructura.) `nivel.publico` acepta además `Todos`, y `nivel.programa` acepta `Curso principal` y `Curso de niños`; los nombres anteriores se siguen aceptando para niveles ya usados.
2. Beginners, Intermediate y Advanced pasan al programa **Curso principal** (público
   Todos) con orden 1–2, 6–11 y 12–13. Se agregan «Nivel 3», «Nivel 4», «Nivel 5»,
   «Nivel 14», «Nivel 15» y «Nivel 16».
3. Los 16 niveles «Principiante» se borran si nadie los usa; si alguno se usó, se
   desactivan (RN-22).
4. Direcciones completas de las tres sucursales, solo si todavía tienen la de la semilla.
5. Reglas de aprobación de la tabla de la spec, con su marca de provisional.

## 7. Pantallas

- **Navegación:** el profesor ve «Inicio» y «Mis grupos». `dominio/acceso.ts` agrega
  `/mis-grupos` (profesor) y `/actas` (los tres roles; la base decide).
- **Mis grupos:** tarjetas con código, nivel, horario, sucursal, fechas, estado del
  acta y avance. Diseñada a 360 px primero.
- **Acta del profesor:** una tarjeta por estudiante con los tres parciales (valor y
  condición), la nota calculada al escribir (`notas.ts`) y el estado. Guarda por
  estudiante. Botones «Dejó de asistir» y «Entregar acta» con el resumen. Teclado
  numérico en el teléfono.
- **Acta en `/grupos/[id]`:** misma tabla en solo lectura para Dirección; la
  Asistente ve las acciones de reprogramación, salida, Condicionado y, si el acta
  está Entregada, la modificación con motivo.
- **Acta impresa:** formato oficial de la Hoja de registro de notas (skill
  `marca-adei`; foto y decisiones en `docs/formatos/README.md`): 20 renglones por hoja y
  numeración continua en la siguiente; NP, J y R en las celdas; «C» junto a la final
  condicionada; nota del pie del formato; emblema, encabezado bilingüe, datos del grupo, tabla
  N.º / Nombres y apellidos / I / II / III / Final, reprobadas en rojo, «Entregado» y
  «Firma del profesor». Botón «Imprimir o guardar en PDF».
- **Regla de aprobación:** página `/reglas` (no una pestaña de Catálogos, porque Dirección
  también la consulta y Catálogos es solo de la Asistente), con la tabla de reglas, la marca
  de provisional y el formulario para agregar o corregir; Catálogos la enlaza.
- **Inscribir:** la respuesta `antecedente` muestra el aviso y pide el motivo.

## 8. Pruebas

| Archivo | Qué cubre |
|---|---|
| `tests/dominio/notas.test.ts` | Cálculo, redondeo, provisional, tres Justificados, franja; los mismos vectores que la prueba de SQL |
| `tests/dominio/ruta.test.ts` | Posición de un nivel en su ruta |
| `t18-regla-aprobacion` | Restricciones, superposición, provisional, vigencia por fecha de inicio |
| `t19-parciales-y-resultado` | Tabla `parcial`, vista, todos los casos de la sección 3 |
| `t20-operaciones-acta` | Cada función de la sección 4 con cada rol, incluido el aislamiento por organización |
| `t21-catalogo-cliente` | La 013 sobre la semilla: niveles, direcciones, reglas |

Además: el recorrido E2E de la 001 se extiende con el flujo del acta, y la colección
de Newman de seguridad gana la carpeta «002» (profesor ajeno, Dirección escribiendo,
acta entregada, reprogramación sin autorizar).

## 9. Riesgos

- **Nombres de los niveles 3–5 y 14–16 desconocidos:** se cargan como «Nivel N» y la
  Asistente los renombra; la regla no depende del nombre.
- **El cálculo calculado al leer** se vuelve lento con muchas filas: la vista filtra
  por grupo o por estudiante; la 003 medirá el filtrado con 20,000 estudiantes.
- **Producción:** la 013 cambia el catálogo real; se prueba antes en la copia local con
  la semilla, y `verificar:supabase` se actualiza con las funciones nuevas.

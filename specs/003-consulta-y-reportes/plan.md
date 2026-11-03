# Plan — Spec 003 Consulta y reportes

**Fecha:** 2026-11-02 · **Estado:** aprobado junto con la spec
**Base:** siguen vigentes los planes de la 001 (arquitectura, seguridad, auditoría,
pruebas, identidad visual) y de la 002 (D24 a D29). Aquí solo va lo nuevo.

## 1. Qué se agrega

| Capa | Nuevo |
|---|---|
| Base | Migración `014_consulta_y_reportes.sql`: tablas `factura` y `factura_estudiante`, tipo de acción «Incidente» en la bitácora, y las operaciones de §4 |
| Dominio | `src/dominio/filtro.ts` (criterios ↔ dirección de la página, coherencia, descripción en palabras), `xlsx.ts` (escritor de Excel), `factura.ts`, `estado-matricula.ts`, `periodo.ts` (mes en curso en Managua), `enmascarar.ts` (cédulas y teléfonos de la bitácora), `hoja-matricula.ts` (qué va en cada campo, «sin registro» o en blanco) y `exportacion.ts` (qué lleva cada archivo de Excel; agregado en T8) |
| Datos | `src/datos/consultas.ts`, `facturas.ts`, `reportes.ts` (llamadas a las operaciones de la 014) |
| Pantallas | `/consultas` (filtrado); historial, facturas y estado de matrícula en `/estudiantes/[id]`; facturas en la fila de inscripción de `/grupos/[id]`; `/panel-actas` (panel de entrega; *no `/actas`, que ya es la ruta del acta impresa y la abre también el profesor*); `/reportes`; `/bitacora` (solo Dirección); `/respaldo` (solo Asistente) |
| Impresión | `/consultas/imprimir`, `/estudiantes/[id]/historial/imprimir`, `/inscripciones/[id]/matricula`, en el grupo `(impresion)` de la 002 |
| Descargas | Manejadores de ruta que devuelven `.xlsx`: `/consultas/exportar` y `/estudiantes/[id]/historial/exportar`. El respaldo se arma en el navegador (§6) |
| Pruebas | `tests/dominio/*` de cada módulo nuevo; `tests/bd/t22-…` a `t28-…` en PGlite; `tests/app/t29-consultas.test.ts` |

Una dependencia nueva: **`fflate`** (D33).

## 2. Decisiones

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D30 | **El filtrado es una sola función** (`filtrar`) que valida los criterios, cuenta y obtiene la página en la misma consulta (`count(*) over ()`), compara lo obtenido con lo esperado y, si no cuadra, registra un «Incidente» y devuelve `incompleto` sin filas | Contar en una consulta y traer en otra, o filtrar desde la pantalla con PostgREST | Principio 6 y CE-10, CE-11. Con dos consultas, una inscripción nueva entre las dos ya da una diferencia: exactamente el modo de falla de 2018. En una sola, el total y las filas salen del mismo instante. La comparación queda igual como defensa, y la app la repite antes de armar un archivo (CE-25) |
| D31 | **Los criterios viajan en la dirección de la página** (`/consultas?modalidad=…&estado_academico=…`) y el formulario es GET | Guardarlos en el estado de la pantalla o en la base | CE-22, CE-23: la consulta se puede volver a abrir, guardar como favorito o pasar a Dirección. El mismo texto alimenta la exportación y la impresión, así que las tres ven el mismo resultado |
| D32 | **La vista Estudiantes es un `exists` sobre las inscripciones**, no un `group by` del resultado de Inscripciones | Agrupar las filas de Inscripciones | CE-3 exige incluir a los estudiantes sin inscripciones cuando no hay criterios de inscripción; un agrupado los perdería. El `exists` también da la cantidad de inscripciones que cumplen (CE-15) |
| D33 | **El Excel se escribe con un módulo propio (`dominio/xlsx.ts`) y `fflate` para comprimir** | SheetJS (`xlsx` en npm), ExcelJS, o un CSV | El paquete `xlsx` de npm quedó congelado en la 0.18.5 (comprobado con `npm view` el 2-nov), con dos avisos de seguridad (contaminación de prototipo y ReDoS) que solo se corrigen fuera de npm. ExcelJS arrastra decenas de dependencias para algo que aquí es escribir tablas. Un CSV pierde los tipos (CE-30) y Excel lo abre mal con tildes. Un `.xlsx` es un zip de XML: escribirlo son ~150 líneas probables con pruebas. `fflate` no tiene dependencias y comprime, cosa necesaria porque Vercel Hobby limita la respuesta a 4.5 MB (§6). La versión se consulta con `npm view` al instalar (AGENTS.md) |
| D34 | **Las facturas siguen D26**: solo políticas de lectura; registrar, corregir y anular pasan por funciones `security definer` | Políticas de escritura por rol | Las reglas cruzan tablas: el estudiante de la inscripción debe estar entre los amparados, una inscripción con a lo sumo una factura, la fecha no posterior a hoy en Managua. En una función se leen y se prueban juntas |
| D35 | **Lo que se imprime es una página con estilos de impresión**, igual que el acta (002); el navegador la guarda en PDF | Generar el PDF en el servidor | Sin dependencias y con la misma solución que ya se probó en producción (002·T16, prueba 13) |
| D36 | **El reporte y el panel se calculan al pedirlos**, en una función cada uno, con los totales y la suma comprobada en la misma consulta | Tablas de resumen mantenidas por triggers | Con 20,000 registros un conteo agrupado tarda milisegundos. Una tabla de resumen es otro lugar donde los números pueden no cuadrar (principio 6) |
| D37 | **La bitácora se enmascara al leerla**, en la función `bitacora`, no al guardarla | Guardar enmascarado | La bitácora es inalterable y debe conservar el valor real (RN-15, principio 8). Enmascarar en la función hace que ni siquiera la respuesta de la API lleve la cédula completa (CE-94) |

## 3. Modelo de datos (014)

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `factura` | serie, numero, fecha_emision, monto, moneda, forma_pago, inscripcion_id (nula), version | Serie `^[A-Z]$`; número 1–99,999; monto `numeric(6,2)` entre 0.01 y 9,999.99 (CE-55); moneda `USD` o `NIO`; forma de pago `Efectivo`, `Tarjeta`, `Transferencia`. Única (organización, serie, número) (CE-54). Única (organización, inscripción) cuando no es nula (CE-60). Llave foránea compuesta a `inscripcion` |
| `factura_estudiante` | factura_id, estudiante_id | Llave primaria (factura, estudiante). Llaves foráneas compuestas. Borrar la factura borra sus vínculos (anular, CE-63) |

Ambas con `organizacion_id`, RLS de lectura para Asistente y Dirección y el trigger de
auditoría de la 001. Sin columnas nuevas en `estudiante`: `fecha_cambio_estado` ya
existe (005), y la observación del cambio va al `detalle` de la bitácora.

`auditoria.tipo_accion` suma **«Incidente»** (CE-11). La restricción se reemplaza con
un `alter table`; los registros existentes no cambian.

Lo que la base no puede comprobar con un `CHECK` porque depende de la fecha de hoy
(CE-57, CE-69) o de otras tablas (CE-60) lo comprueban las funciones de §4, igual
que en la 002.

## 4. Operaciones (014)

Todas `security definer`, igual que las de la 002: leen sin pasar por RLS, así que
cada una comprueba a mano la organización, la puerta de acceso y el rol (*cambio al
implementar, T3: el borrador decía que `filtrar` y `bitacora` leerían con los permisos
de quien pregunta; así no podían llamar a las auxiliares de `interno` ni registrar el
incidente*). Todas devuelven `denegado` y registran la denegación cuando quien pide no
tiene el rol, igual que `buscar_estudiantes` (001), porque un error desharía el registro.

| Función | Hace | CE |
|---|---|---|
| `filtrar(p_criterios jsonb, p_vista text, p_pagina int, p_destino text)` | Valida coherencia (horario de la modalidad, nivel del programa, fechas), arma el filtro sobre `inscripcion` + `grupo` + `resultado_academico` (002) o sobre `estudiante` con `exists`, cuenta y obtiene en una consulta, compara, registra la consulta o el incidente. `p_destino` = `pantalla` (50 por página), `exportar` o `imprimir` (todas las filas) | CE-1 a CE-21, CE-24, CE-25, CE-28 |
| `historial_academico(p_estudiante)` | Identificación + inscripciones (sin las anuladas) con parciales, resultado y facturas; registra la consulta | CE-36 a CE-42 |
| `hoja_matricula(p_inscripcion)` | Los campos del formato con el primer tutor y el número de tutores; solo Asistente; registra | CE-44 a CE-51 |
| `registrar_factura(p_datos, p_estudiantes uuid[], p_inscripcion, p_confirmar)` | CE-52 a CE-61; devuelve `atipico` si falta confirmar | CE-52 a CE-61 |
| `corregir_factura(p_id, p_version, p_datos, p_estudiantes, p_inscripcion, p_motivo, p_confirmar)` · `anular_factura(p_id, p_motivo)` | Mismas validaciones; motivo obligatorio | CE-62, CE-63 |
| `cambiar_estado_matricula(p_estudiante, p_estado, p_fecha, p_observacion, p_confirmar)` | Valida estado y fecha; devuelve `advertir` con las inscripciones En curso si falta confirmar | CE-67 a CE-74 |
| `panel_actas(p_desde, p_hasta)` | Por profesor y en total, con la suma comprobada; y el detalle por grupo | CE-75 a CE-80 |
| `reporte_sucursales(p_desde, p_hasta, p_sucursal)` | Estado actual y movimientos, por sucursal y en total, con la suma comprobada | CE-81 a CE-86 |
| `bitacora(p_filtros jsonb, p_pagina int)` | Solo Dirección; total y página juntos; valores enmascarados | CE-89 a CE-94 |
| `respaldo()` | Solo Asistente; todos los conjuntos y sus totales en una sola consulta, que ve un solo instante; registra | CE-31 a CE-35 |

`inscribir` (001/002) ya rechaza a un estudiante que no está Activo (001·CE-55); CE-72
solo agrega la prueba con el cambio de estado real.

## 5. Pantallas

Cargan antes la skill `marca-adei`. Densas, con la tabla a la vista (AGENTS.md).

- **`/consultas`**: criterios en una franja arriba (en el teléfono, plegable), el
  conmutador Inscripciones/Estudiantes, el total grande junto al título y la tabla
  paginada de 50 en 50. Los selectores dependientes (horario según modalidad, nivel
  según programa) se filtran en el navegador y la base vuelve a comprobarlos. Botones
  «Exportar a Excel» e «Imprimir».
- **`/estudiantes/[id]`**: la sección «Inscripciones» actual pasa a ser «Historial
  académico» (CE-36 a CE-43), con «Exportar» e «Imprimir». Se agregan «Facturas»
  (lista, registrar, corregir, anular) y el cambio de estado de matrícula junto a la
  insignia del estado.
- **`/grupos/[id]`**: en cada inscripción, «Factura…» (registrar con el estudiante ya
  elegido, CE-61) y «Hoja de matrícula».
- **`/panel-actas`**: período (mes en curso), totales arriba y una fila por profesor que
  se despliega en sus grupos. Las vencidas en dorado (aviso), no en rojo (principio 9).
- **`/reportes`**: período y sucursal; tabla de estado actual con barras de CSS y el
  número al lado; tabla de movimientos. Cada cifra del estado actual es un enlace a
  `/consultas` (CE-88).
- **`/bitacora`**: filtros, total, tabla; al abrir un renglón de modificación, la
  lista de campos que cambiaron.
- **`/respaldo`**: una explicación corta de qué incluye y qué no, y el botón de
  descarga.

Menú: la Asistente suma Consultas, Actas, Reportes y Respaldo; Dirección suma Consultas,
Actas, Reportes y Bitácora. `dominio/acceso.ts` registra las rutas nuevas con sus roles.

## 5b. Cómo se ven los archivos de Excel

Maqueta mostrada a Dirk el 2-nov, con datos inventados; se aprueba con la spec. Lo escribe `dominio/xlsx.ts`
con estilos propios; no se usa ninguna plantilla.

**Listado exportado (CE-24 a CE-30) y historial (CE-43).** Una hoja:

| Filas | Qué va | Estilo |
|---|---|---|
| 1 | «ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI» | 14 pt, negrita, marino `#03214C` |
| 2 | Título: «Listado de inscripciones», «Listado de estudiantes» o «Historial académico de …» | 12 pt, negrita, marino |
| 3–4 | Fecha y hora, quién lo generó; criterios en palabras (`filtro.ts`). En el historial: código, cédula, sucursal y estado | 10 pt, gris |
| 5 | «Total: N registros. El listado está completo.» | 10 pt, negrita, marino |
| 7 | Encabezado de columnas | Fondo marino, letra blanca en negrita, ajuste de texto |
| 8… | Un renglón por registro, numerado | 10 pt, línea fina gris abajo; códigos en letra de ancho fijo y como texto; fechas `dd/mm/aaaa`; nota final en negrita; **nota y estado reprobados en rojo `#DD0E0E`**, nada más en rojo |
| Al final | «Fin del listado: N de N registros.» | 10 pt, cursiva, gris |

Además: el encabezado queda fijo al bajar (panel inmovilizado en la fila 8), con
autofiltro de Excel en cada columna, porque la Asistente trabaja con filtros. Ancho de
columna según el contenido. Para imprimir desde Excel: carta horizontal, ajustada al
ancho de una hoja, el encabezado repetido en cada hoja y «Página N de M» al pie.

**Respaldo (CE-31 a CE-35).** Primera hoja «Índice» con el mismo encabezado de 3
filas, la nota «No incluye cuentas de usuario ni bitácora» y la tabla Hoja · Filas ·
Qué contiene. Después, una hoja por conjunto, con el encabezado de columnas en la fila
1 (marino, fijo, con autofiltro) y los datos sin adornos, para que se puedan volver a
cargar. Las columnas usan nombres legibles («Fecha de nacimiento»), no los de la base.

**Letra: Calibri**, la de Excel. Montserrat es la letra de la marca en pantalla y en
papel, pero casi nunca está instalada en las computadoras donde se abriría el archivo,
y Excel la cambiaría por otra al azar. Los colores sí son los del manual.

El Excel no lleva el emblema: una imagen dentro de un `.xlsx` obliga a manejar dibujos
y anclas, para un archivo que se usa para analizar datos. Lo que se imprime en papel
(§5, D35) sí lleva el emblema.

## 5c. Formatos impresos

| Impreso | Base | Qué se adapta |
|---|---|---|
| Hoja de registro de notas | Formato de ADEI (002, en producción) | Nada nuevo |
| **Hoja de matrícula** | Formato de ADEI (`docs/formatos/hoja-de-matricula.jpg`), se reproduce: emblema, «ACADEMIA DE ENSEÑANZA EN INGLES / HOJA DE MATRICULA», recuadro de foto, secciones Datos del alumno, Datos del tutor y Datos de la academia | Sin «Estado civil» ni «Padece de alguna enfermedad» (CE-48). Se llenan además «Inscrito por», «N.º Recibo» y «Paga» con lo que ahora registra el sistema. Quedan en blanco el recuadro de foto, lugar donde vive, escolaridad y requisitos entregados. Carta vertical, una hoja |
| **Listado del filtrado** | No hay formato en papel: hoy es una hoja de Excel | Encabezado como el del acta (emblema a la izquierda, «Academia de Enseñanza en Inglés», título en mayúsculas), criterios y total, tabla numerada con el encabezado repetido en cada hoja, «Hoja N de M». Carta horizontal por las columnas |
| **Historial académico** | No hay formato en papel (el SRS lo llama «el formato que la organización nunca logró») | Mismo encabezado; datos del estudiante; tabla cronológica Grupo · Nivel · Horario · Profesor · Sucursal · Inicio · Término · I · II · III · Final · Estado · Factura. Carta **horizontal** (cambio en T12: con 14 columnas no cabía en vertical) |
| Factura contado | Documento fiscal | No se reproduce (CE-64) |

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El estado académico se calcula al leer (D24) y el filtrado lo pide para 20,000 inscripciones | Prueba de rendimiento con 20,000 inscripciones en PGlite (CE-20). Si pasa de 2 s, el filtro de estado se aplica después de los demás criterios, sobre menos filas; si aun así no alcanza, se discute con Dirk antes de guardar el estado |
| Vercel Hobby limita a 4.5 MB la respuesta de una función | El `.xlsx` va comprimido (D33). **Medido el 2-nov (T8) con 20,000 estudiantes y 20,000 inscripciones:** el listado exportado pesa 1.6 MB y sale del servidor; el respaldo pesa 8.1 MB, así que **se arma en el navegador**: la página `/respaldo` llama a `respaldo()` directo a Supabase con la sesión de la persona (la política de contenido ya permite esa conexión), arma el Excel con el mismo `xlsx.ts` y lo descarga. Sigue siendo una sola consulta, así que CE-32 (un solo instante) se cumple igual, y los 31 MB de datos no pasan por Vercel |
| Vercel Hobby limita la duración de una función | El respaldo de 20,000 se mide en la copia local; se espera que tarde segundos. Si se acercara al límite vigente del plan, se arma por partes como en el riesgo anterior |
| La Hoja de matrícula no cabe en una carta con los datos largos (dirección de 200 caracteres) | Se mide con datos de largo máximo, como el acta en la 002 (T13) |

## 7. Pruebas

- **PGlite** (`tests/bd/`): t22 filtrado y completitud (incluido el incidente forzado,
  con una función de prueba que hace no cuadrar la cuenta), t23 historial y Hoja de
  matrícula, t24 facturas, t25 estado de matrícula, t26 panel y reporte, t27 bitácora
  y respaldo, t28 rendimiento con 20,000 (CE-20, CE-21).
- **Dominio**: cada módulo nuevo; `xlsx.test.ts` descomprime el archivo con `fflate` y
  revisa el XML (tipos de celda, CE-30).
- **App**: `t29-consultas` contra PGlite, como `t25-actas` en la 002.
- **Newman**: carpeta «003» contra la copia local (permisos de cada función por rol,
  organización ajena, criterios manipulados).
- **E2E** en la copia local con datos sintéticos, a 1280 y 360 px, e Impeccable.

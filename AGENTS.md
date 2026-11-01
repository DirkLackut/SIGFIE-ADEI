# AGENTS.md — SIGFIE-ADEI

Instrucciones para cualquier agente de IA que trabaje en este repositorio.
Leer **siempre** antes de tocar nada, y después `docs/constitution.md`.

---

## Qué es este proyecto

Sistema web de gestión y filtrado de información estudiantil para la **Academia
de Enseñanza en Inglés ADEI**, Sucursal Central (Altamira, Managua). Cliente
real. Proyecto de la asignatura Ingeniería de Software I, UNI, grupo
3M4-SIS-S, docente MSc. Walter José Quintero Acevedo.

Reemplaza un flujo de trabajo basado en hojas de Excel y tres formatos impresos.
El sistema anterior (2018) fue abandonado porque **entregaba resultados de
búsqueda incompletos sin avisar**. Evitar que eso se repita es la razón de
existir del proyecto: ver el principio 6 de la constitución.

Autores del documento académico: Dirk Donley Martínez Lackut (2024-1731U) y
Eddy Horacio Marenco Zapata (2024-1513U).
**El trabajo técnico lo realizan Dirk y Claude en sesión conjunta.** Las tareas
de `tasks.md` no se reparten entre personas: se dimensionan para una sesión de
trabajo y se ejecutan de una en una.

---

## Método: Spec-Driven Development

El orden no se salta y no se adelanta:

```
constitución → spec → clarificación → plan → tareas → implementación → validación
```

Un cambio de requisito **nunca** empieza por el código:

```
nuevo requisito → spec → plan → tareas → código
```

### Archivos y orden de lectura

| Orden | Archivo | Qué contiene |
|---|---|---|
| 1 | `AGENTS.md` | Este archivo |
| 2 | `docs/constitution.md` | Principios innegociables |
| 3 | `specs/00N-*/spec.md` | El QUÉ y el POR QUÉ. Requisitos en notación EARS |
| 4 | `specs/00N-*/plan.md` | El CÓMO. Módulos, modelo de datos, decisiones justificadas |
| 5 | `specs/00N-*/tasks.md` | T1…Tn, cada una con sus RF y su "Hecho cuando:" |

La spec activa es la de mayor número que todavía tenga tareas sin marcar.

### Reglas de ejecución

- **Una tarea por vez, en orden.** Se implementa `Tn` con sus tests, se corre la
  suite completa y la verificación obligatoria (al final de este archivo), y se
  marca `Tn` como hecha.
- **Modo por bloques** (acordado con Dirk el 2026-10-30). Dentro de un bloque de
  `tasks.md` se sigue con `Tn+1` sin pedir permiso. Se para y se reporta solo:
  1. al terminar el bloque;
  2. cuando una tarea necesita la PC (Supabase, Vercel, el navegador);
  3. cuando aparece algo que cambia la spec o el plan, o una decisión de Dirk;
  4. cuando algo falla y no se puede resolver sin cambiar el criterio.
- **Tests primero.** Se escribe el test, se lo ve fallar, se implementa.
- **Nada fuera de la spec.** Si durante la implementación aparece algo no
  especificado, se pregunta; no se decide por cuenta propia.

---

## Dónde corre cada cosa

El entorno de la conversación con Claude **no llega a Supabase ni a Vercel** (solo a
npm y PyPI). Por eso:

| Se hace en la conversación | Se hace en la PC (Claude Code en VS Code, o Dirk) |
|---|---|
| Specs, plan, tareas | `supabase link`, `supabase db push`, `supabase gen types` |
| Migraciones SQL y sus pruebas en PGlite | Verificación de Supabase real sin dejar rastro (`npm run verificar:supabase`) |
| Lógica de dominio y sus pruebas | `npm run dev` y la revisión en el navegador |
| Código de la app, `tsc` y `build` | Despliegue en Vercel |

## Comandos

```bash
npm run dev            # servidor de desarrollo en localhost:3000 (Next.js)
npm run build          # compilación de producción; debe pasar antes de desplegar
npm run test           # corre la suite completa (Vitest) y termina
npm run test -- <ruta> # corre un solo archivo de tests
npx tsc --noEmit       # verificación de tipos sin generar archivos
```

Base de datos (requiere `supabase login` hecho una vez por el usuario):

```bash
npm run tipos         # genera src/tipos/base-de-datos.ts (esquema public)
npx supabase db push  # aplica supabase/migrations/ en orden
```

---

## Reglas sobre la base de datos

1. Todo cambio de esquema se escribe primero como archivo numerado en
   `supabase/migrations/` (`001_catalogos.sql`, `002_estudiantes.sql`, …). Nunca
   SQL suelto en el editor web sin que quede el archivo en el repositorio.
2. Antes de cada `supabase db push` se anuncia qué archivo se va a aplicar.
3. **Ningún comando destructivo sin petición explícita en el momento**:
   `db reset`, `DROP TABLE`, `DELETE` sin `WHERE`, `TRUNCATE`. No se asume
   autorización por una conversación anterior.
4. **Hay un solo proyecto Supabase (`sigfie-adei`) y será el de producción.** Nada
   de pruebas que escriban datos en él: solo verificaciones de lectura, en
   transacciones que se deshacen, o sobre filas ficticias que se borran al final
   (ver `scripts/verificar-supabase.mts`). La auditoría no se puede borrar.

## Claves y secretos

- Viven solo en `.env.local` (fuera de git). **Ningún agente lo lee, lo muestra ni
  lo copia**; lo llena Dirk en su PC. Las claves y contraseñas nunca pasan por el chat.
- `SUPABASE_DB_URL` (contraseña de la base, rol con todos los permisos) solo sirve
  para la verificación de T16. Dirk decidió conservarla en `.env.local` (30-oct);
  el archivo está fuera de git y la app no la usa.

---

## Estilo de código

- Identificadores, comentarios, mensajes y commits **en español**, igual que el
  SRS: `calcularNotaFinal`, `Inscripcion`, `verificarCompletitud`.
- Los nombres de entidades coinciden exactamente con el diagrama de clases de
  la Fase 2: `Estudiante`, `Grupo`, `Inscripcion`, `Calificacion`, `Sucursal`,
  `RegistroAuditoria`, `LoteMigracion`, `RegistroEnRevision`,
  `CondicionInferida`, `ReglaAprobacion`, `Organizacion` (Fase 2 v2.1).
- Cada test cita en su descripción el requisito que cubre:
  `test("RN-04: la nota final es el promedio de los tres parciales", …)`.
- Las fechas se inyectan como parámetro en la lógica pura; nunca `new Date()`
  dentro de una función que se vaya a testear.

---

## Identidad visual

Fuente: *Manual de Identidad Corporativa* de ADEI (plan §14, constitución
principio 9). **Antes de tocar cualquier pantalla, carga la skill `marca-adei`.**

| | Valor |
|---|---|
| Color principal | Marino `#03214C` |
| Paleta oficial | Azul oscuro `#3B5A9E`, Celeste `#3F95FF`, Verde `#05C167`, Cian profundo `#00545A`, Dorado `#A57E14`, Rojo `#DD0E0E` (solo reprobadas) |
| Texto | `#212529` sobre blanco |
| Tipografía | Montserrat (interfaz) y Libre Baskerville (títulos) |
| Logo | Emblema oficial en vector, `public/marca/emblema.svg`; nunca redibujado |

Dos registros distintos y no se mezclan:

- **Landing page pública**: sigue el sitio de ADEI (adei-eta.com). Secciones
  amplias, fotografías, aire.
- **Pantallas de trabajo**: densas. La usuaria principal domina Excel avanzado y
  Power BI; una tabla compacta con filtros siempre visibles le sirve más que
  tarjetas espaciadas. Las pantallas que reemplazan un formato impreso
  conservan su estructura (encabezado de grupo, tabla numerada, columnas
  I / II / III / Final, reprobadas en rojo).

Evitar los vicios de interfaz generada: gradientes morados, bordes muy
redondeados en todo, un icono decorativo por tarjeta, fondo gris con tarjetas
blancas flotando.

---

## Privacidad — no negociable

`NOTAS 2021.xlsx` y `recibos.xlsx` contienen nombres, cédulas y teléfonos de
personas reales, **incluidas personas menores de edad**, y este repositorio es
público. No se agregan al repositorio, no se pegan sus contenidos en archivos de
prueba, no se suben fragmentos en issues ni en commits. Los tests usan datos
sintéticos.

---

## Verificación obligatoria al terminar una tarea

Antes de marcar `Tn` como hecha:

1. `npm run test` en verde.
2. `npx tsc --noEmit` sin errores.
3. Cada RF cubierto por la tarea tiene al menos un test que lo nombra.
4. `git status` no muestra ningún `.xlsx`, `.csv` ni `.env`.
5. `npm audit --omit=dev` da 0 vulnerabilidades. *Excepción documentada
   (2026-10-31):* `npm audit` completo reporta 16 avisos moderados de
   `minimatch` < 11.0.1, que solo llegan por ESLint 9 (herramienta de desarrollo,
   no va a la app publicada). ESLint 9 necesita la API de minimatch 3, así que no
   se puede actualizar sin romperlo. Se revisa cuando ESLint lo resuelva.
6. Se marca la tarea con su nota en `tasks.md`. En modo por bloques se sigue con
   la siguiente y se reporta al terminar el bloque (ver "Reglas de ejecución").

**Versiones de dependencias:** se consultan con `npm view <paquete> version` al
momento de instalar, nunca de memoria. (29-oct: fijar versiones de memoria dejó
7 vulnerabilidades, 3 críticas, incluida una del cliente de autenticación.)

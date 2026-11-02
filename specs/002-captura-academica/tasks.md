# Tareas — Spec 002 Captura académica

Se ejecutan por bloques, igual que la 001: dentro de un bloque se sigue sin parar;
se para al terminar el bloque, cuando una tarea necesita la PC, cuando algo cambia
la spec o el plan, o cuando algo falla sin arreglo dentro del criterio.

**Aquí** = en la nube de trabajo, con PGlite y la copia local. **PC** = en la
computadora de Dirk.

## Bloque A — Base de datos (cada migración con sus pruebas en PGlite)

- [x] **T1 · Aquí** `012_captura_academica.sql`, parte 1: `regla_aprobacion` con sus
  restricciones y triggers (superposición, solo provisional se modifica), RLS y
  auditoría. CE-20, CE-24 a CE-28. Prueba: `t18-regla-aprobacion`.
- [x] **T2 · Aquí** Parte 2: `parcial`, `calificacion`, vista `resultado_academico`.
  CE-7 a CE-10, CE-14 a CE-23, CE-38 a CE-40, CE-59. Prueba: `t19-parciales-y-resultado`.
- [x] **T3 · Aquí** Parte 3: operaciones de la sección 4 del plan y el reemplazo de
  `inscribir`. CE-1 a CE-6, CE-11 a CE-13, CE-29 a CE-58, CE-60 a CE-62. Prueba:
  `t20-operaciones-acta`.
- [x] **T4 · Aquí** `013_catalogo_cliente.sql`: curso principal de 16 niveles,
  direcciones, reglas iniciales. Prueba: `t21-catalogo-cliente` y ajuste de `t15`.
- [x] **T5 · Aquí** Lista de funciones en `t11-permisos` y en `scripts/verificar-supabase.mts`.

> Bloque A cerrado el 2026-11-02: 573 pruebas en verde (36 archivos), `tsc` y `eslint` limpios.

## Bloque B — Dominio puro

- [x] **T6 · Aquí** `dominio/notas.ts` y `dominio/ruta.ts`, con los mismos vectores de
  prueba que la base (D25).

> Bloque B cerrado el 2026-11-02: pruebas escritas primero y vistas fallar; 598 en verde,
> `tsc`, `eslint` y `npm audit --omit=dev` (0 vulnerabilidades) limpios.

## Bloque C — Pantallas

- [x] **T7 · Aquí** Navegación del profesor y «Mis grupos». CE-1 a CE-3, RNF-06.
- [x] **T8 · Aquí** Acta del profesor: captura, nota en vivo, aviso de inasistencia,
  entrega. CE-5 a CE-18, CE-37, CE-42 a CE-47, RNF-02.
- [x] **T9 · Aquí** Acta en `/grupos/[id]` para la Asistente y Dirección: reprogramación,
  salida, Condicionado, modificación del acta entregada. CE-29 a CE-41, CE-48, CE-49, CE-58.
- [x] **T10 · Aquí** Acta impresa en el formato oficial. CE-50 a CE-53.
- [x] **T11 · Aquí** Regla de aprobación en Catálogos. CE-24 a CE-28.
- [x] **T12 · Aquí** Inscribir con antecedente. CE-54 a CE-56.

> Bloque C cerrado el 2026-11-02. Pruebas nuevas primero: `acceso` (rutas `/mis-grupos`,
> `/actas`, `/reglas`), `catalogos` (programas nuevos), `acta-impresa` (20 renglones,
> NP/J/R, rojo solo en la final reprobada), `regla` (formulario) y `t25-actas` (capa de
> datos contra PGlite). 624 pruebas en verde, `tsc` y `eslint` limpios. Cambios al plan:
> la regla va en `/reglas` (Dirección la consulta, CE-58); `entregar_acta` dice primero
> «sin calificaciones» (CE-44) antes de listar faltantes. `src/tipos/base-de-datos.ts`
> lleva a mano la tabla `regla_aprobacion` hasta que T15 corra `npm run tipos`.
> La revisión visual (1280 y 360 px) es de T13.

## Bloque D — Verificación y entrega

- [x] **T13 · Aquí** Recorrido E2E en la copia local, incluido 360 px, y revisión de
  Impeccable sobre las pantallas nuevas.
- [x] **T14 · Aquí** Carpeta «002» de la colección de Newman contra la copia local.

> T13 (2026-11-02): recorrido automático en la copia local con datos inventados, como
> profesor, Asistente y Dirección: 38 comprobaciones en orden, 0 errores del navegador,
> sin desplazamiento lateral a 360 px. Acta impresa: 1 hoja carta por cada 20 renglones
> (medido: 278.9 mm de 279.4). Correcciones que salieron de mirar las pantallas: casillas
> de condición legibles, «Decisiones…» como enlace en la fila en lugar de un botón por
> estudiante, orden alfabético sin importar tildes, la impresa ya no se pasaba a una hoja
> extra. Impeccable `detect`: Montserrat aceptada (marca-adei); «card inside card» y
> «cramped padding» son el mismo patrón de tabla en sección de la 001, sin cambio.
> T14: colección completa 103 peticiones, 152 comprobaciones, 0 fallos. Un hallazgo
> corregido en la 012: una condición inventada devolvía la fila rechazada
> (`docs/seguridad/resultados.md` §10).
- [ ] **T15 · PC** Rama `spec/002-captura-academica`, `npx supabase db push --linked`
  (012 y 013), `npm run tipos`, `npm run verificar:supabase`, Pull Request y despliegue.
- [ ] **T16 · PC** Lista de comprobación manual de la spec (15 renglones), con evidencia.

## Trazabilidad: criterios por tarea

| CE | Tareas |
|---|---|
| CE-1 a CE-6 | T3, T7, T8 |
| CE-7 a CE-13 | T2, T3, T8 |
| CE-14 a CE-23 | T2, T6, T8 |
| CE-24 a CE-28 | T1, T11 |
| CE-29 a CE-41 | T2, T3, T9 |
| CE-42 a CE-49 | T3, T8, T9 |
| CE-50 a CE-53 | T10 |
| CE-54 a CE-56 | T3, T12 |
| CE-57 a CE-62 | T1 a T3, T14 |

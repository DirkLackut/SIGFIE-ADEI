# Clarificación — Spec 002 Captura académica

**Fecha:** 2026-11-02 · **Estado:** cerrada · 9 de 9 resueltos

Revisión de la spec aprobada. Por decisión de Dirk (2026-11-01), las dudas no se
preguntan: se resuelven por lógica con lo que dicen el SRS, la cliente y la spec 001.
Cada resolución queda aquí para que se pueda revisar.

## 1. Ambigüedades

- **A1** · CE-30, CE-55 — «Nivel siguiente» para la nota que exige un Condicionado.
  **Resuelto:** el que sigue en la ruta del programa (curso principal 1→16;
  Conversation → Conversation Avanzada). La nota exigida es la del Condicionado.
- **A2** · CE-7 — ¿Puede el profesor capturar antes de la fecha de inicio del grupo?
  **Resuelto:** sí. La spec no lo limita y algunos grupos se abren con anticipación.
- **A3** · CE-48 — ¿Captura la Asistente mientras el acta está Abierta? **Resuelto:** no.
  El SRS da la captura al profesor (CU-14); la Asistente interviene en lo que la spec
  le asigna (reprogramación, retiro, baja, traslado, Condicionado) y en el acta
  entregada. Si el profesor no puede capturar, se cambia el profesor del grupo
  (001·CE-51).
- **A4** · CE-12 — ¿De qué tamaño es lo que se protege de la edición simultánea?
  **Resuelto:** cada inscripción. Dos sesiones pueden capturar estudiantes distintos
  del mismo acta sin estorbarse.
- **A5** · CE-29, CE-31 — ¿Se puede condicionar antes o después de entregar el acta?
  **Resuelto:** en los dos momentos; es una decisión de la Asistente, con su
  justificación, y queda en la auditoría.

## 2. Contradicciones

- **C1** · CE-39 vs RN-12 — La baja por inasistencia no es Retirada ni Trasladada,
  así que RN-12 le exigiría tres parciales con condición. **Resuelto:** al decidir la
  baja, el sistema deja como No presentado los parciales que faltan (CE-39), y con
  eso la inscripción cumple RN-12.

## 3. Casos límite

- **L1** · CE-27 — Una regla provisional se corrige después de entregar actas que la
  usaron. **Resuelto:** el estado se calcula siempre con la regla vigente de los
  datos, así que la corrección se ve también en las actas entregadas; la auditoría
  guarda la regla anterior y la nueva.
- **L2** · CE-1 — Un usuario es Asistente y además Profesor (RN-17). **Resuelto:**
  como profesor captura en sus grupos igual que cualquier profesor; como Asistente
  hace lo de la Asistente. Los permisos se suman.
- **L3** · CE-13 — Una inscripción con parciales ya capturados se marca Retirada.
  **Resuelto:** los parciales se conservan en la auditoría y en la base, pero no
  cuentan (CE-41 lo advierte antes).

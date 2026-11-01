---
name: spec-generator
description: Usa esta skill cuando se pida crear, redactar o revisar una especificación (spec) de una funcionalidad de SIGFIE-ADEI. Guía la entrevista de requisitos y produce un spec.md trazable al SRS de las Fases 1 y 2.
---

# Generador de specs — SIGFIE-ADEI

Convierte un bloque de requisitos del SRS en una especificación acordada y
verificable. La spec es el contrato: si algo no está aquí, no se implementa.

## Diferencia importante respecto a un proyecto nuevo

Este proyecto **ya tiene requisitos aprobados**: el documento consolidado de las
Fases 1 y 2 contiene RF-01…RF-22, las reglas de negocio RN-01…RN-23, los
requisitos no funcionales en FURPS+, el diagrama de casos de uso (27 casos,
5 actores), el diagrama de clases de análisis y tres diagramas de secuencia
(DS-01, DS-02, DS-03).

Por lo tanto una spec aquí **no inventa requisitos: recorta un subconjunto del
SRS y lo vuelve verificable.** Consecuencias:

- Los números `RF-NN` y `RN-NN` **se conservan tal como están en el SRS**. No se
  renumeran, no se reescriben, no se fusionan.
- Los criterios de aceptación propios de la spec se numeran `CE-1`, `CE-2`, … y
  cada uno **declara a qué RF o RN del SRS corresponde**. Esa es la tabla de
  trazabilidad que se usa en la validación final y en la defensa.
- **Ojo con la colisión de nombres:** la sección 6.6 del SRS ya usa `CA-01`…`CA-07`
  para los criterios de aceptación del modo de falla de 2018. Por eso los
  criterios de una spec se llaman `CE-n` (criterio de la especificación). Un
  `CE` puede citar un `CA` del SRS como trazabilidad, igual que cita un RF o RN.
- Si un criterio no se puede amarrar a ningún RF ni RN del SRS, es alcance
  nuevo: se marca como tal y se pregunta antes de incluirlo.

## Proceso

1. **Lee el contexto**, en este orden: `docs/constitution.md`, `AGENTS.md`, las
   specs anteriores de `specs/`, y el fragmento del SRS que cubre esta
   funcionalidad (requisitos, reglas de negocio y el diagrama de secuencia
   correspondiente, si existe).
2. **Entrevista.** Preguntas de **UNA en UNA**, máximo 6, esperando respuesta
   antes de la siguiente. Se preguntan solo las cosas que el SRS deja abiertas:
   casos límite, comportamiento ante error, qué queda fuera. No se pregunta lo
   que el SRS ya responde — eso se lee. No se proponen soluciones técnicas: si
   se pregunta "¿cómo lo harías?", se redirige al QUÉ.
   Prioriza preguntas cuya respuesta cambie lo que hay que construir.
3. **Elige el número.** Mira `specs/` y usa el siguiente libre con tres
   dígitos: `specs/NNN-<nombre-en-kebab-case>/spec.md`.
4. **Redacta** usando `spec-template.md` de esta skill, sin saltarte secciones.
   Los criterios de aceptación van **siempre en notación EARS**. Cada criterio
   debe ser verificable: si no se te ocurre cómo comprobarlo, está mal escrito.
5. **Marca lo que no sepas** como `[NECESITA ACLARACIÓN: pregunta concreta]`.
   Nunca rellenes un hueco inventando: un hueco visible es información, una
   suposición silenciosa es deuda.
6. **Pide aprobación explícita** al terminar. No pases al plan ni escribas
   código hasta tenerla.

## Reglas

- La spec describe **QUÉ** y **POR QUÉ**. Prohibido incluir stack, arquitectura,
  nombres de archivos, esquemas de tablas, SQL, algoritmos o firmas de
  funciones: eso va en el plan.
- Incluye **siempre** la sección "Fuera de alcance". Es la que evita que la
  funcionalidad crezca sola.
- Un requisito, una frase. Si necesitas un "y" para unir dos comportamientos,
  son dos requisitos.
- Sin adjetivos no medibles: "rápido", "intuitivo", "amigable" no son
  requisitos. Escribe el umbral (el SRS casi siempre ya lo tiene) o no lo
  escribas.
- Ninguna spec puede contradecir el principio 6 de la constitución: no existe
  el resultado parcial silencioso.
- Ningún ejemplo, dato de prueba ni caso límite usa datos reales de estudiantes.
  Se inventan nombres.
- Idioma: español, igual que el SRS.

## Notación EARS

Cinco patrones. Elige el que corresponda, no mezcles:

| Patrón | Forma | Cuándo |
|---|---|---|
| Ubicuo | EL SISTEMA \<hará\> | siempre cierto |
| Dirigido por evento | CUANDO \<disparador\>, EL SISTEMA \<hará\> | responde a algo |
| Estado | MIENTRAS \<estado\>, EL SISTEMA \<hará\> | durante una condición |
| Opcional | DONDE \<característica\>, EL SISTEMA \<hará\> | solo si está presente |
| No deseado | SI \<condición\>, ENTONCES EL SISTEMA \<hará\> | errores y casos límite |

Ejemplo bien escrito, con su trazabilidad:

> **CE-7** · *RN-23, RF-10* — SI la cantidad de registros obtenidos por una
> consulta de filtrado no coincide con el total esperado calculado en la misma
> operación, ENTONCES EL SISTEMA no mostrará ningún resultado, informará que la
> consulta no pudo completarse y registrará el incidente en la auditoría.

Mal escrito, para contrastar:

> ~~CE-7: El sistema debe mostrar los resultados de forma rápida y confiable.~~
>
> Sin patrón EARS, sin criterio verificable, dos ideas en una frase, dos
> adjetivos no medibles y sin trazabilidad al SRS.

## Al revisar una spec existente

Si se pide revisar en vez de crear, no reescribas: **detecta y lista**,
numerado, en cinco bloques — (1) ambigüedades, (2) contradicciones entre
criterios, (3) casos límite no cubiertos, (4) conflictos con la constitución,
(5) criterios sin trazabilidad a ningún RF o RN del SRS. No propongas
soluciones hasta que te lo pidan.

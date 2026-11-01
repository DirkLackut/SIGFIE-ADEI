# Spec NNN — <Nombre de la funcionalidad>

**Estado:** borrador · pendiente de aprobación
**Fecha:** <AAAA-MM-DD>
**Requisitos del SRS que cubre:** RF-…, RN-…

## Contexto y objetivo
<Qué problema del cliente resuelve y por qué merece la pena. Un párrafo. Si
resuelve una falla documentada del sistema anterior, decirlo aquí.>

## Actores
<Quién la usa, con los nombres de actor del diagrama de casos de uso de la
Fase 2.>

## Casos de uso del SRS involucrados
<CU-NN — nombre. Solo los que esta spec implementa.>

## Historias de usuario
- H1: Como \<rol\> quiero \<acción\> para \<beneficio\>.

## Criterios de aceptación (EARS)

Cada criterio declara el requisito o la regla del SRS que verifica.

- **CE-1** · *RF-…* — CUANDO \<evento\>, EL SISTEMA \<respuesta\>.
- **CE-2** · *RN-…* — SI \<condición no deseada\>, ENTONCES EL SISTEMA \<respuesta\>.
- **CE-3** · *RF-…* — MIENTRAS \<estado\>, EL SISTEMA \<respuesta\>.
- **CE-4** · *RN-…* — EL SISTEMA \<comportamiento permanente\>.

## Requisitos no funcionales aplicables
<Solo los del SRS que esta spec debe cumplir, citados por su número, con su
umbral medible.>

## Casos límite
<Vacíos, duplicados, datos fuera de catálogo, valores en el borde del rango,
acentos y mayúsculas, registros simultáneos, sesión expirada...>

## Fuera de alcance
<Lo que explícitamente NO se hace en esta spec, aunque esté en el SRS. Indicar
en qué spec futura se espera que entre.>

## Criterios de finalización
- Todos los CE con test automático en verde, o con renglón firmado en la lista
  de comprobación manual si son de interfaz.
- Tabla de trazabilidad CE → RF/RN completa, sin huecos.
- `npm run test` y `npx tsc --noEmit` sin errores.

## Lista de comprobación manual
| # | Qué hacer | Qué debe pasar | CE | Verificado |
|---|---|---|---|---|
| 1 | | | | ☐ |

## Dudas abiertas
- [NECESITA ACLARACIÓN] \<duda\>

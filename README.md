# SIGFIE-ADEI

Sistema de Gestión y Filtrado de Información Estudiantil
**Academia de Enseñanza en Inglés ADEI** — Sucursal Central, Altamira, Managua

Proyecto de la asignatura Ingeniería de Software I · Universidad Nacional de
Ingeniería · Grupo 3M4-SIS-S · 2026

---

## El problema

La academia administra matrícula, grupos y calificaciones con hojas de Excel y
tres formatos impresos. Un sistema anterior (2018) fue abandonado porque
**entregaba resultados de búsqueda incompletos sin avisar al usuario**, lo que
provocó decisiones tomadas sobre información parcial.

Que eso no se repita es el requisito central del proyecto: toda consulta de
filtrado verifica su propia completitud y, si no cuadra, falla de forma visible
en lugar de devolver una lista a medias.

## Documentación

| Archivo | Contenido |
|---|---|
| `docs/constitution.md` | Principios innegociables del proyecto |
| `AGENTS.md` | Instrucciones de trabajo, comandos y convenciones |
| `specs/` | Especificaciones por funcionalidad, con trazabilidad al SRS |
| `supabase/migrations/` | Esquema de base de datos, versionado y numerado |

El SRS completo (Fases 1 y 2: estudio preliminar, requerimientos, casos de uso,
clases de análisis y diagramas de secuencia) se entrega como documento
académico y no forma parte de este repositorio.

## Método

Spec-Driven Development: constitución → spec → plan → tareas → implementación →
validación. Un cambio de requisito empieza siempre por la spec, nunca por el
código.

## Stack

Next.js (App Router) · TypeScript · Supabase (PostgreSQL) · Vercel
Migración puntual del acervo histórico en Python.

## Privacidad

Los archivos de origen de la academia contienen datos personales de estudiantes
y **no se versionan en este repositorio**. Las pruebas usan datos sintéticos.
Ver principio 3 de la constitución y la Ley 787 de Protección de Datos
Personales de Nicaragua.

## Autores

Dirk Donley Martínez Lackut (2024-1731U)
Eddy Horacio Marenco Zapata (2024-1513U)

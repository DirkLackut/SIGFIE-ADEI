# Constitución — SIGFIE-ADEI

Sistema de Gestión y Filtrado de Información Estudiantil
Academia de Enseñanza en Inglés ADEI — Sucursal Central, Altamira, Managua

Principios innegociables. Toda spec, todo plan y toda tarea debe cumplirlos.
Si una tarea exige violar uno, se detiene el trabajo y se discute el principio,
no se hace la excepción.

---

1. **Las reglas viven en la base.** Toda regla de negocio expresable como
   `CHECK`, `UNIQUE`, llave foránea, columna generada, trigger o política RLS se
   implementa en PostgreSQL. El frontend valida para avisar al usuario, nunca
   como última defensa.

2. **La spec manda.** Ningún comportamiento se implementa si no está en la spec
   activa. Si falta una decisión, se detiene el trabajo y se pregunta. No se
   inventa el requisito.

3. **Los datos de estudiantes no entran al repositorio.** El repositorio es
   público y los archivos de origen contienen nombres, cédulas y teléfonos de
   personas, incluidas personas menores de edad. `.gitignore` excluye `.xlsx`,
   `.csv`, `.tsv` y volcados de base. Las pruebas usan datos sintéticos.

4. **Lógica separada de interfaz.** El cálculo y la validación viven en módulos
   puros, sin acceso a red ni a base de datos, ejecutables y testeables sin
   navegador.

5. **Tests como puerta.** La lógica de negocio y las restricciones de la base
   llevan test automático. Cada tarea termina con la suite en verde; está
   prohibido avanzar en rojo. La interfaz se verifica con lista de comprobación
   manual, firmada al cerrar cada spec.

6. **Nunca un resultado parcial.** Toda consulta de filtrado obtiene el total
   esperado y los resultados en una sola operación atómica. Si las cantidades no
   coinciden, se devuelve error y se registra el incidente. Jamás se entrega una
   lista incompleta como si estuviera completa.

7. **Stack fijo.** Next.js (App Router) + TypeScript + Supabase (PostgreSQL).
   Despliegue en Vercel Hobby para desarrollo y prototipo académico; la
   operación real de ADEI va en un hosting gratuito que permita uso comercial,
   a definir en la spec de despliegue. El código no usa nada exclusivo de Vercel. La migración del acervo histórico se ejecuta una sola vez con Python.
   Sin ORM. Cada dependencia nueva exige justificación escrita en el plan, con
   la alternativa descartada. Render quedó identificado como opción para
   necesidades que Vercel no cubre (procesos prolongados, tareas programadas
   pesadas, un servicio Python desplegado); no se usa hoy y no está descartado.

8. **Todo cambio deja rastro.** Las escrituras sobre calificaciones,
   inscripciones y usuarios registran usuario, fecha y hora, valor anterior y
   valor nuevo (Ley 787 de Protección de Datos Personales).

9. **La identidad es la de ADEI**, según su Manual de Identidad Corporativa.
   Marino `#03214C` como color principal y la paleta oficial del manual;
   Montserrat para la interfaz y Libre Baskerville (la versión libre de la
   Baskerville del emblema) para títulos. El logo se usa en las versiones del
   manual, nunca redibujado. Las pantallas que reemplazan un formato impreso
   conservan su estructura, y lo que se imprime (actas) sigue el formato oficial
   de ADEI. El rojo se reserva para las notas reprobadas, porque ahí significa algo.
   *Enmienda del 2026-10-31 (decisión de Dirk, con el manual entregado por ADEI):
   antes decía verde `#61BA6D`, dorado `#FBB710` y solo Montserrat, valores
   tomados del sitio web cuando aún no se tenía el manual.*

10. **Idioma.** Identificadores, código, documentación, mensajes al usuario y
    mensajes de commit en español, igual que el SRS, para que la trazabilidad
    entre documento y código sea directa.

11. **Costo cero, sin excepciones.** Solo capas gratuitas, en desarrollo y en
    producción. Ningún plan pago, ni siquiera para resolver una limitación: si
    una función solo existe en un plan pago, se implementa por cuenta propia o
    se renuncia a ella. Se respetan los términos de uso de cada capa gratuita.
    Si una decisión acerca el proyecto a un límite, se advierte antes de tomarla.

12. **Alcance incremental.** Una spec se cierra validada requisito por
    requisito antes de abrir la siguiente.

# Plan de pruebas de seguridad (T33)

**Sistema:** SIGFIE-ADEI · **Spec:** 001 (base y registro) · **Fecha:** 2026-11-01
**Referencia:** [OWASP Top 10:2025](https://top10.owasp.org/2025/)
**Resultados:** [`resultados.md`](resultados.md)

## 1. Objetivo

Comprobar que SIGFIE-ADEI resiste los diez riesgos más comunes de las aplicaciones
web según OWASP, con pruebas que se pueden repetir y que dejan evidencia. El sistema
guarda datos personales de estudiantes, incluidos menores de edad (Ley 787), así que
la prioridad es que **nadie vea ni cambie lo que no le corresponde**.

## 2. Alcance y reglas

| | |
|---|---|
| **Se prueba** | La aplicación (Next.js, compilada como en producción) y su API (Supabase: autenticación y PostgREST), con las 11 migraciones y las políticas RLS. |
| **Dónde** | **Solo en una copia local**: PostgreSQL 16, Supabase Auth (GoTrue) y PostgREST 12.2.3 corriendo en la máquina de pruebas, con la misma base de datos que producción. |
| **Con qué datos** | **Solo datos sintéticos.** Cuatro cuentas inventadas y dos organizaciones: ADEI y una «Academia Ficticia de Prueba». Ningún dato de los Excel reales. |
| **Prohibido** | Escanear o atacar el proyecto de Supabase de producción (`sigfie-adei`) o la dirección de Vercel, que usan la base real. Un escaneo activo inserta y modifica datos. |
| **Fuera de alcance** | Bloqueo por intentos fallidos y recuperación por correo (spec 004); la infraestructura de Supabase y Vercel, que administran ellos. |

## 3. Herramientas

| Herramienta | Versión | Para qué |
|---|---|---|
| **Newman** (Postman por línea de comandos) | 6.2.3, con el informe `htmlextra` 1.23.1 | Pruebas dirigidas: cada petición prueba una regla concreta y dice qué esperaba. Se ejecutan igual cada vez. |
| **OWASP ZAP** | 2.17.0 (SHA-256 verificado contra el manifiesto oficial de ZAP) | Escáner automático: recorre el sitio, revisa cada respuesta (escaneo pasivo) y ataca los parámetros (escaneo activo). Encuentra lo que no se nos ocurrió probar. |
| **Vitest + PGlite** | 5.0.5 / 0.5.13 | Las pruebas automáticas del proyecto, que ya incluyen los permisos (RLS) de cada rol en una base PostgreSQL real. |
| **npm audit** | npm 10 | Vulnerabilidades conocidas en las dependencias. |

Se eligió Newman en vez de Postman con ventana porque deja la colección como un
archivo versionado y la ejecución como un comando: cualquiera la repite y obtiene el
mismo resultado. ZAP es el escáner de código abierto que mantiene la comunidad OWASP.

## 4. Pruebas por categoría

| OWASP 2025 | Riesgo para SIGFIE | Cómo se prueba | Herramienta |
|---|---|---|---|
| **A01** Control de acceso roto | Que alguien sin sesión, un Profesor o la Asistente de otra organización lea o cambie expedientes. | Pantallas sin sesión; lecturas con la clave pública; lecturas y cambios entre organizaciones; un Profesor que intenta registrar, darse el rol de Asistente, leer la auditoría o ver el grupo de otro profesor; Dirección que intenta escribir; sesión sin aceptar el aviso; redirección abierta en «Salir». | Newman (29 peticiones), Vitest (permisos por rol) |
| **A02** Configuración insegura | Encabezados que faltan (clickjacking, CSP), esquema interno expuesto, registro público abierto. | Encabezados de la respuesta; `Accept-Profile: interno`; alta de cuenta desde fuera; página inexistente sin traza. | Newman, ZAP (pasivo) |
| **A03** Cadena de suministro | Una dependencia con vulnerabilidad o una versión que cambia sola. | `npm audit --omit=dev`; versiones exactas en `package.json`; verificación SHA-256 de lo descargado. | npm audit, revisión |
| **A04** Fallas criptográficas | Que la clave de servicio llegue al navegador o que se acepte una sesión falsificada. | Buscar la clave en el HTML y en cada archivo JavaScript; token con la firma alterada; token sin firma (`alg: none`). | Newman |
| **A05** Inyección | SQL en la búsqueda o en los filtros; HTML que se ejecute al mostrar un expediente (XSS). | Comillas, `UNION SELECT` y comodines en la búsqueda; filtro con comillas; nombre con `<script>`; dirección con HTML guardada y mostrada. | Newman, ZAP (activo) |
| **A06** Diseño inseguro | Que la seguridad dependa de la pantalla y no de la base. | Se prueba la API directamente, saltándose las pantallas: si la base no lo permite, no pasa (plan §5.4, decisión D6). | Newman (todas las de A01) |
| **A07** Fallas de autenticación | Averiguar qué cuentas existen; reutilizar una sesión cerrada. | Mismo mensaje para cuenta existente e inexistente; el token de renovación deja de servir al salir. | Newman |
| **A08** Integridad de software y datos | Que se acepten datos firmados por otro, o código sin verificar. | Firma de los tokens (A04); lockfile; auditoría inalterable (A09). | Newman, revisión |
| **A09** Registro y alertas | Que la auditoría se pueda falsificar, borrar o leer sin permiso. | Escribir eventos sin sesión o con un tipo inventado; modificar o borrar la auditoría; leerla sin ser Dirección. | Newman, Vitest |
| **A10** Condiciones excepcionales | Que un dato inesperado tumbe el servicio o muestre trazas internas. | Identificadores mal formados, expediente inexistente, JSON roto, tipos equivocados: deben dar 4xx, nunca 5xx ni trazas. | Newman, ZAP (activo) |

## 5. Procedimiento

1. Levantar la copia local con la base vacía y aplicar las 11 migraciones.
2. Crear los datos sintéticos con el recorrido de pantallas (Playwright) y con
   `preparar.mjs` (cuenta Profesor y la segunda organización).
3. **Newman:** `newman run sigfie-seguridad.postman_collection.json -e entorno-local.json`.
4. **ZAP, línea base:** recorrido y escaneo pasivo sin sesión (`zap/linea-base.yaml`).
5. **ZAP, completo:** recorrido, escaneo pasivo y activo con la sesión de la Asistente
   sintética (`zap/completo.yaml`). Se excluyen «Salir» y «Cuentas» para que el
   escáner no cierre ni desactive su propia sesión.
6. Guardar los informes HTML en `docs/seguridad/informes/`.

Las pruebas se corren **antes y después** de corregir, para mostrar el efecto de
cada corrección con la misma colección.

## 6. Criterios de aceptación

- Newman: **0 fallos**.
- ZAP: **ninguna alerta de riesgo Alto.** Cada alerta Media o Baja queda corregida o
  justificada en `resultados.md`.
- `npm audit --omit=dev`: **0 vulnerabilidades**.

## 7. Qué se hace con un hallazgo

Igual que con los defectos de las pruebas manuales: **primero la spec**. Se agrega
el criterio que faltaba, después se corrige el código con su prueba automática, y se
vuelve a correr la misma prueba de seguridad para confirmar que ya pasa.

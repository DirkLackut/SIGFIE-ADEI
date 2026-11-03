# Resultados de las pruebas de seguridad (T34)

**Sistema:** SIGFIE-ADEI · **Fecha:** 2026-11-01 · **Plan:** [`plan.md`](plan.md)
**Referencia:** OWASP Top 10:2025

## 1. Resumen

| | Antes de corregir | Después de corregir |
|---|---|---|
| **Newman:** 79 peticiones y 107 comprobaciones | **7 fallos** | **0 fallos** |
| **ZAP, línea base** (sin sesión, pasivo) | 0 Altas · 3 Medias · 3 Bajas | 0 Altas · 2 Medias · 1 Baja |
| **ZAP, completo** (con sesión, pasivo y activo) | — | 0 Altas · 2 Medias · 1 Baja |
| **npm audit --omit=dev** | 0 vulnerabilidades | 0 vulnerabilidades |

Las pruebas encontraron **3 hallazgos**, y los tres quedaron corregidos:
1. Faltaban los encabezados de seguridad (A02).
2. Un pedido sobre algo inexistente respondía «error del servidor» (A10).
3. Las dependencias no tenían versión exacta (A03).

**No se encontró ninguna forma de ver o cambiar datos ajenos** (A01). Las alertas de
ZAP que quedan son falsos positivos o un riesgo aceptado, justificados en la sección 5.

Todo se ejecutó contra la **copia local con datos sintéticos**. No se envió ningún
pedido de prueba a Supabase de producción ni a Vercel.

## 2. Entorno de prueba

- **Aplicación:** Next.js 16.4.3 compilada con `next build` y servida con `next start`,
  igual que en producción.
- **API:** PostgreSQL 16, Supabase Auth (GoTrue) y PostgREST 12.2.3, en la máquina de
  pruebas, detrás de una pasarela que imita la dirección única de Supabase.
- **Base de datos:** las 11 migraciones del repositorio, las mismas que producción.
- **Datos sintéticos.** No se usó ningún dato de los Excel reales.
  - Organización ADEI con su Asistente (`aura.gomez`), su Profesora (`carla.mena`),
    una cuenta de Dirección (`diana.direccion`), los estudiantes «PRUEBA» del
    recorrido de pantallas y un grupo de otro profesor («PRUEBA Luis»).
  - «Academia Ficticia de Prueba», con su propia Asistente (`otra.asistente`) y un
    estudiante «OTRAORG Secreto». Sirve para probar que una organización no ve los
    datos de otra.

## 3. Cómo se usó Newman

**Newman** es la versión de línea de comandos de **Postman**: ejecuta una *colección*
de peticiones HTTP y, después de cada una, unas comprobaciones escritas en JavaScript
(`pm.test`). Se usó la versión 6.2.3 con el informe HTML `htmlextra` 1.23.1.

**La colección.** Se escribe con un generador (`herramientas/generar-coleccion.mjs`),
para que cada prueba quede legible y con nombre en español. El generador produce
`sigfie-seguridad.postman_collection.json`, que también se abre en Postman. La
colección tiene una carpeta por categoría de OWASP:

| Carpeta | Peticiones | Ejemplo |
|---|---|---|
| 0 · Preparación | 9 | Inicia sesión con las cuatro cuentas sintéticas y acepta el aviso. |
| A01 · Control de acceso | 29 | La Asistente de otra organización intenta cambiar el teléfono de un estudiante de ADEI. |
| A02 · Configuración | 4 | Revisa los encabezados de seguridad de la pantalla de ingreso. |
| A04 · Secretos y criptografía | 3 | Envía un token sin firma (`alg: none`) que dice ser `service_role`. |
| A05 · Inyección | 7 | Busca `' OR 1=1 --` y guarda una dirección con `<script>`. |
| A07 · Autenticación | 4 | Compara el error de una cuenta que existe con el de una que no existe. |
| A09 · Registro | 4 | Intenta modificar la auditoría. |
| A10 · Errores | 4 | Pide un grupo con un identificador mal formado. |

**Cómo prueba la API y las pantallas.**
- **API:** las peticiones van directo a Supabase (`/auth/v1` y `/rest/v1`) con el token
  de cada cuenta. Así se prueba la base sin pasar por las pantallas: si la base no lo
  permite, no pasa, aunque alguien se salte la aplicación.
- **Pantallas:** se envía la misma cookie de sesión que usaría el navegador, que la
  colección arma con el formato de `@supabase/ssr`.

**Un ejemplo completo:** la prueba de XSS almacenado.
1. La Asistente registra un adulto con la dirección
   `<script>alert("xss")</script><img src=x onerror=alert(1)>`. La base lo acepta,
   porque la dirección es texto libre.
2. Se abre el expediente con la cookie de la Asistente.
3. Se comprueba que el HTML no contiene la etiqueta `<script>` del dato y que sí
   aparece escapada (`&lt;script&gt;`). Es decir, se muestra como texto y no se ejecuta.

**Un ejemplo con control:** CSRF en las acciones de Next.
1. La colección envía la acción de ingreso con el encabezado `Origin` del propio sitio,
   y responde normalmente. Ese es el control, para saber que el método funciona.
2. La envía otra vez con `Origin: https://sitio-malicioso.example`, y Next la aborta.

**Freno de seguridad.** La colección tiene un script que corre antes de cada petición:
si `app` o `api` no son `127.0.0.1` o `localhost`, no envía nada. Se probó apuntando
la API a la dirección de producción, y Newman terminó con **0 peticiones enviadas**.
`preparar.mjs` y `cookie.mjs` tienen el mismo freno.

**Comando:**

```
newman run sigfie-seguridad.postman_collection.json -e entorno-local.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-skipHeaders "Authorization,apikey,Cookie,Set-Cookie"
```

El informe HTML omite los encabezados con tokens y los cuerpos de los inicios de
sesión. Además, `limpiar-informe.py` borra del HTML cualquier token, contraseña o
correo de las cuentas sintéticas que quede, así que no contiene ninguno.

## 4. Cómo se usó OWASP ZAP

**ZAP** (Zed Attack Proxy) es el escáner de seguridad web de código abierto del
proyecto OWASP. Hace dos cosas:
- **Escaneo pasivo:** recorre el sitio como un navegador y revisa cada respuesta,
  por ejemplo los encabezados y la información que se filtra.
- **Escaneo activo:** ataca cada parámetro que encuentra con cargas de inyección SQL,
  XSS, inclusión de rutas, inyección de comandos y otras, y observa si la respuesta
  delata una debilidad.

**Instalación verificada.** Se descargó ZAP 2.17.0 de las versiones oficiales en
GitHub. Antes de usarlo se comparó su SHA-256 con el publicado en el manifiesto
oficial de ZAP (`ZapVersions.xml`), y coincidieron (`efe799aa…3ddde5a`).

**Ejecución sin ventana.** Se usó el *Automation Framework* de ZAP: un archivo YAML
describe el escaneo y ZAP lo ejecuta con `zap.sh -cmd -autorun plan.yaml`.

| Plan | Qué hace |
|---|---|
| `zap-linea-base.yaml` | Recorre el sitio sin sesión (*spider*) y hace el escaneo pasivo. Se corrió antes y después de corregir. |
| `zap-completo.yaml` | Inyecta en cada pedido la cookie de sesión de la Asistente sintética (trabajo `replacer`). Recorre las pantallas internas, hace el escaneo pasivo y el **activo**, y genera el informe. |

**Exclusiones del escaneo completo.**
- **«Salir»:** el escáner cerraría su propia sesión.
- **«Cuentas»:** podría desactivar o restablecer la cuenta con la que escanea.

Las protecciones de Cuentas se prueban con Newman (A01) y con las pruebas
automáticas de permisos.

## 5. Hallazgos y correcciones

Cada corrección siguió el mismo orden que los defectos de las pruebas manuales:
1. Agregar el criterio a la spec.
2. Corregir el código, con su prueba automática.
3. Volver a correr la misma prueba de seguridad.

### H1 · Faltaban los encabezados de seguridad (A02 · Media)

**Encontrado por:** Newman (6 fallos en «Encabezados de seguridad») y ZAP:
- CSP no definida.
- Falta protección contra *clickjacking*.
- Falta `X-Content-Type-Options`.
- `X-Powered-By` revela la tecnología.

**Riesgo:** otra página podía mostrar SIGFIE dentro de un marco invisible y engañar
a la Asistente para que hiciera clic (*clickjacking*). Además, sin una política de
contenido, un script inyectado se ejecutaría.

**Corrección** (spec **CE-102** y **CE-103**, plan **D23**):
- `src/dominio/seguridad.ts` define la política y los encabezados, con 8 pruebas.
- `src/proxy.ts` crea en cada respuesta una **CSP con un nonce aleatorio**. El
  navegador solo ejecuta los scripts que Next marca con ese nonce.
- `next.config.ts` agrega `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`, y quita
  `X-Powered-By`.
- El layout raíz hace que cada página se genere al pedirla, para que lleve su nonce.

Se verificó en un navegador real: las 14 etiquetas `<script>` llevan el nonce, la
búsqueda en vivo y los botones funcionan, y no hay ninguna violación de la CSP en la
consola.

### H2 · «No existe» respondía 500 en lugar de 404 (A10 · Baja)

**Encontrado por:** Newman. La Asistente de otra organización intentó inscribir en un
grupo de ADEI.

La base **sí lo impidió**: para ella ese grupo no existe. Pero la API respondió **500**
(«error del servidor») en lugar de 404. Cinco funciones usaban el código
`no_data_found`, que PostgREST no conoce. Un 500 hace creer que el servidor falló,
llena los registros de errores falsos y confunde el monitoreo.

**Corrección** (spec **CE-101**, plan **D22**):
- La migración `011_no_existe_404.sql` cambia ese código por `PT404`, y PostgREST
  responde 404.
- Solo reemplaza funciones: no toca tablas ni datos.
- Se agregaron 3 pruebas automáticas.

### H3 · Dependencias sin versión exacta (A03 · Baja)

**Encontrado por:** revisión de la cadena de suministro. 19 de 22 dependencias tenían
rangos como `^16.4.3`. El `package-lock.json` fija las versiones instaladas, pero si
se regenera, un rango puede traer una versión publicada ayer sin revisión.

**Corrección:** todas las dependencias tienen ahora la versión exacta instalada, y
`.npmrc` incluye `save-exact=true` para que las nuevas también la tengan. Las
versiones instaladas no cambiaron.

### Alertas de ZAP que se mantienen, con justificación

| Alerta | Riesgo | Decisión |
|---|---|---|
| *Absence of Anti-CSRF Tokens* | Media | **Falso positivo.** Los formularios usan *Server Actions* de Next: solo aceptan POST, Next compara el encabezado `Origin` con el sitio y aborta si no coinciden, y la cookie de sesión es `SameSite=Lax`. Newman lo comprobó en A01: la acción enviada desde otro sitio se aborta, y la misma enviada desde el propio sitio responde. |
| *CSP: style-src unsafe-inline* | Media | **Riesgo aceptado.** Las animaciones (`motion`) y los avisos (`sonner`) escriben estilos en los elementos. Un estilo no ejecuta código, y los scripts sí están limitados por el nonce. Quitarlo exigiría reemplazar esas dos bibliotecas (D19, D20). |
| *Private IP Disclosure* | Baja | **Falso positivo.** ZAP leyó «10.4.1.2» en `icon.svg`, pero son coordenadas del dibujo del óvalo de ADEI, no una dirección IP. |
| *Suspicious Comments*, *Modern Web Application*, *User Agent Fuzzer*, *Content-Type Header Missing*, *User Controllable HTML Element Attribute* | Informativas | Sin riesgo. Son palabras como «user» dentro del JavaScript minificado de React, avisos de que el sitio usa JavaScript, y la redirección de `/` (sin cuerpo). El atributo controlable es un campo oculto de las *Server Actions*, y React lo escapa. |

## 6. Resultado por categoría

| OWASP 2025 | Resultado |
|---|---|
| **A01** Control de acceso | ✔ **Cumple.** Sin sesión, todas las pantallas mandan al ingreso, y la clave pública no lee nada. Entre organizaciones no se ve ni se cambia nada. El Profesor no registra, no se da el rol de Asistente, no lee la auditoría y solo ve sus propios grupos. Dirección lee, pero no registra ni modifica. Una sesión que no aceptó el aviso no lee datos. «Salir» no redirige fuera. CSRF bloqueado. |
| **A02** Configuración | ✔ Cumple **tras H1.** El esquema interno no está expuesto, el registro público está cerrado y una página inexistente da 404 sin trazas. |
| **A03** Cadena de suministro | ✔ Cumple **tras H3.** `npm audit --omit=dev`: 0 vulnerabilidades. ZAP se verificó con su SHA-256. |
| **A04** Criptografía | ✔ **Cumple.** La clave de servicio no aparece en el HTML ni en ningún archivo JavaScript. Se rechazan el token con la firma alterada y el token sin firma. |
| **A05** Inyección | ✔ **Cumple.** Inyección SQL, `UNION` y comodines en la búsqueda dan 0 resultados sin error. Un nombre con `<script>` se rechaza, y el HTML guardado en la dirección se muestra escapado. El escaneo activo de ZAP no encontró inyecciones. |
| **A06** Diseño inseguro | ✔ **Cumple.** Todas las pruebas de A01 atacan la API directamente: la protección está en la base (RLS), no en las pantallas. |
| **A07** Autenticación | ✔ **Cumple.** Una cuenta inexistente y una contraseña incorrecta dan exactamente el mismo error. Al salir, el token de renovación deja de servir. *El bloqueo por intentos es de la spec 004.* |
| **A08** Integridad | ✔ **Cumple.** Los tokens se verifican por firma (`getClaims()`), las versiones están fijadas y la auditoría no se puede alterar. |
| **A09** Registro | ✔ **Cumple.** Sin sesión no se escriben eventos, no se inventan tipos de evento, la auditoría no se modifica ni se borra, y solo Dirección la lee. |
| **A10** Excepciones | ✔ Cumple **tras H2.** Identificadores mal formados, JSON roto y tipos equivocados dan 4xx sin trazas. En el escaneo activo de ZAP, ninguna respuesta fue 5xx. |

## 7. Limitaciones

- La regla de **XSS basado en DOM** de ZAP no corrió: necesita Firefox o Chrome con
  su controlador, y no estaban disponibles en la máquina de pruebas. El riesgo queda
  cubierto por la CSP con nonce, porque React escapa todo lo que muestra, y por la
  prueba de XSS almacenado de Newman.
- ZAP no pudo consultar actualizaciones ni enviar telemetría: la red de la máquina
  de pruebas lo bloquea. Por eso su informe muestra «fallas de red»; no afectan el
  escaneo del sitio.
- No se probaron la infraestructura de Supabase y Vercel (la administran ellos), el
  bloqueo por intentos ni la recuperación por correo (spec 004).

## 8. Evidencia

| Archivo | Qué muestra | Pie de figura sugerido |
|---|---|---|
| `evidencia/newman-antes-terminal.png` | Newman antes de corregir: 107 comprobaciones, 7 fallos y cuáles | Primera ejecución de las pruebas de seguridad con Newman: 7 comprobaciones fallidas |
| `evidencia/newman-despues-terminal.png` | Newman después de corregir: 0 fallos | Las mismas 107 comprobaciones después de las correcciones: 0 fallos |
| `evidencia/newman-despues-a01-a02.png` | Detalle de las comprobaciones de control de acceso y configuración | Detalle de las pruebas de control de acceso (OWASP A01) y configuración (A02) |
| `evidencia/zap-linea-base-antes.png` | Resumen de ZAP antes de corregir | Escaneo pasivo de OWASP ZAP antes de las correcciones |
| `evidencia/zap-linea-base-despues.png` | Resumen de ZAP después de corregir | Escaneo pasivo de OWASP ZAP después de las correcciones |
| `evidencia/zap-completo-despues.png` | Escaneo activo con sesión: 0 alertas Altas | Escaneo activo de OWASP ZAP con sesión: ninguna alerta de riesgo alto |

Los informes completos están en `informes/`. Son archivos HTML que se abren con el
navegador. El de Newman toma sus estilos de internet, así que sin conexión se ve sin
formato.

## 9. Cómo repetir las pruebas

1. Levante una copia local de Supabase, por ejemplo con `npx supabase start` (requiere
   Docker), aplique las migraciones y arranque la app con `npm run build` y `npm start`.
2. Cree los datos sintéticos con el recorrido de pantallas y luego con
   `node --env-file=.env.seguridad docs/seguridad/herramientas/preparar.mjs`.
   `.env.seguridad` lleva las variables **de la copia local**.
3. Corra el comando de Newman de la sección 3 y, antes de publicar el informe,
   `python3 docs/seguridad/herramientas/limpiar-informe.py <informe>.html`.
4. Para ZAP:
   - Imprima la cookie con `node docs/seguridad/herramientas/cookie.mjs`.
   - Póngala en `zap-completo.yaml`, en `replacementString`.
   - Corra `zap.sh -cmd -autorun zap-completo.yaml`.

Las pruebas de este informe se corrieron con una copia local equivalente, levantada
sin Docker en la máquina de pruebas de Claude. El camino con `supabase start` todavía
no se ha probado en la PC del proyecto.

## 10. Spec 002 · Captura académica (2026-11-02)

La colección ganó la carpeta **«002 · Captura académica»** (25 peticiones). Se corrió la
colección **completa** otra vez, con las migraciones 001 a 013, para comprobar también
que la 002 no rompió nada de la 001.

| | Resultado |
|---|---|
| **Newman, colección completa:** 103 peticiones y 152 comprobaciones | **0 fallos** |
| **npm audit --omit=dev** | 0 vulnerabilidades |

Qué prueba la carpeta 002, siempre por la API y sin pasar por la interfaz (CE-60):

| Ataque | Respuesta |
|---|---|
| Un profesor pide el acta de un grupo que no es suyo | `denegado`, sin filas, y la denegación queda en la auditoría (CE-4) |
| Un profesor guarda notas en un grupo ajeno, o en un acta ya entregada | 403 (CE-11, CE-47) |
| Un profesor pone «Reprogramado» sin autorización, o autoriza él mismo una reprogramación | 400 y 403 (CE-35, Q1) |
| Notas de 101, con decimales, con texto SQL o con una condición inventada | 400, con un mensaje propio y sin devolver la fila rechazada (CE-8, A05) |
| La Asistente captura con el acta abierta | 403 (clarificación A3) |
| Dirección guarda notas, condiciona, registra reglas o entrega un acta | 403 (CE-57) |
| Se borra una regla ya confirmada | 400 (CE-28) |
| Se escribe directo en las tablas `parcial` o `calificacion` | 401/403 o 0 filas (D26) |
| Un profesor lee notas o resultados de un grupo ajeno; otra organización lee notas de ADEI | 0 filas (CE-58, CE-59) |
| Otra organización pide un acta de ADEI | 404, sin trazas (CE-59) |
| Sin sesión: «Mis grupos» o la regla de aprobación | 401 o 0 filas |

**Hallazgo y corrección.** Una condición inventada («Aprobado por mí») llegaba hasta la
restricción de la tabla, y su error devolvía la fila completa rechazada, con
identificadores internos. Se corrigió en la propia migración 012, antes de aplicarla a
producción: la función rechaza primero cualquier condición que no sea Registrado, No
presentado, Justificado o Reprogramado, con un mensaje propio. Lo cubren la prueba
`t20-operaciones-acta` y la comprobación «No devuelve la fila rechazada» de Newman.

Evidencia: `informes/newman-002.html` (informe completo, sin tokens ni contraseñas) y
`evidencia/newman-002-terminal.png` (salida de la terminal: carpeta 002 y totales).
`preparar.mjs` ahora crea además, con datos sintéticos, un acta propia abierta, una
entregada, una inscripción en un grupo ajeno, y deja las cuatro cuentas con la clave
de la copia local.

## 11. Spec 003 · Consulta y reportes (2026-11-02)

La colección ganó la carpeta **«003 · Consulta y reportes»** (47 peticiones). Se corrió la
colección **completa** otra vez, con las migraciones 001 a 014, para comprobar también
que la 003 no rompió nada de la 001 ni de la 002.

| | Resultado |
|---|---|
| **Newman, colección completa:** 150 peticiones y 234 comprobaciones | **0 fallos** |
| **npm audit --omit=dev** | 0 vulnerabilidades |

Qué prueba la carpeta 003, siempre por la API y sin pasar por la interfaz (CE-95):

| Ataque | Respuesta |
|---|---|
| Un profesor filtra, exporta, pide un historial, una Hoja de matrícula, el panel de actas, el reporte, la bitácora o el respaldo | `denegado`, sin datos (CE-18) |
| Dirección pide el respaldo; la Asistente pide la bitácora | `denegado` (CE-34, CE-93) |
| Dirección o un profesor registran o anulan una factura, o cambian el estado de matrícula | 403 (CE-66, CE-74) |
| Sin sesión: filtrar o pedir el respaldo | 401 |
| Otra organización pide el historial, la Hoja de matrícula, el estado o una factura de ADEI, o ampara con su factura a un estudiante de ADEI | 404, sin trazas ni datos (CE-95, CE-97) |
| La Asistente de ADEI pide el reporte de una sucursal ajena | 404 |
| Otra organización filtra sin criterios o genera su respaldo | Solo sus datos; ninguno de ADEI, y el respaldo sin cuentas ni bitácora (CE-33) |
| Criterios manipulados: uno inventado, por organización, una sucursal ajena, texto SQL en un catálogo, una vista o un destino inventados, criterios como lista, una fecha imposible | `criterios_invalidos`, sin filas y sin 5xx |
| La bitácora con un filtro inventado o un tipo de acción con SQL | `criterios_invalidos` |
| Se escribe directo en `factura` o `factura_estudiante`, o se cambia el estado de matrícula sin fecha | 403 o 400 (D34, principio 1) |
| Facturas con monto negativo, número con SQL, moneda inventada o fecha futura | 400, con un mensaje propio (CE-53) |
| Lo que lee Dirección en la bitácora | Sin cédulas ni teléfonos completos (CE-94) |
| Las negaciones de la carpeta | Quedan en la bitácora: respaldo, filtrado y bitácora (A09) |

**Hallazgo y corrección.** Igual que en la 002: una factura con monto negativo o con una
moneda inventada llegaba hasta la restricción de la tabla, y su error devolvía la fila
completa rechazada, con identificadores internos. Se corrigió en la propia migración 014,
antes de aplicarla a producción: la función revisa primero la serie, el número, el monto,
la moneda, la forma de pago y la fecha, y responde con el mismo mensaje de la regla y su
nombre. La pantalla reconoce ese mensaje y lo pone junto a su campo. Lo cubren las pruebas
`t24-facturas` y `errores.test.ts` (escritas primero y vistas fallar) y, en Newman, la
comprobación de que ninguna respuesta devuelve «Failing row».

Evidencia: `informes/newman-003.html` (informe completo, sin tokens ni contraseñas) y
`evidencia/newman-003-terminal.png` (salida de la terminal: carpeta 003 y totales).
`preparar.mjs` ahora crea además, con datos sintéticos, una factura de ADEI para
comprobar que otra organización no la toca.

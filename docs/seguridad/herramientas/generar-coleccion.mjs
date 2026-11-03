// Genera la colección Postman de pruebas de seguridad de SIGFIE (T34).
// Se ejecuta con Newman SOLO contra la copia local con datos sintéticos.
import fs from "node:fs";

const json = (o) => ({ mode: "raw", raw: JSON.stringify(o), options: { raw: { language: "json" } } });
const H = (pairs) => Object.entries(pairs).map(([key, value]) => ({ key, value }));
const api = (tok) => H({ apikey: "{{anon}}", Authorization: `Bearer ${tok}`, "Content-Type": "application/json" });
const sinRedir = { followRedirects: false };

/** Una petición con sus pruebas (código JavaScript de Postman). */
function pet(nombre, metodo, url, { headers = [], body, pruebas, previo, comportamiento } = {}) {
  const item = { name: nombre, request: { method: metodo, header: headers, url }, event: [] };
  if (body) item.request.body = body;
  if (pruebas) item.event.push({ listen: "test", script: { exec: pruebas.trim().split("\n") } });
  if (previo) item.event.push({ listen: "prerequest", script: { exec: previo.trim().split("\n") } });
  if (comportamiento) item.protocolProfileBehavior = comportamiento;
  return item;
}
const carpeta = (name, item, description) => ({ name, description, item });

// ---------------------------------------------------------------------------
// 0. Preparación: inicia sesión con tres cuentas sintéticas y acepta el aviso.
// ---------------------------------------------------------------------------
const sesion = (quien, correo) => [
  pet(`Iniciar sesión: ${quien}`, "POST", "{{api}}/auth/v1/token?grant_type=password", {
    headers: H({ apikey: "{{anon}}", "Content-Type": "application/json" }),
    body: json({ email: `{{${correo}}}`, password: "{{clave}}" }),
    pruebas: `
pm.test("Ingresa con la cuenta sintética (${quien})", () => pm.response.to.have.status(200));
const r = pm.response.json();
pm.collectionVariables.set("tok_${quien}", r.access_token);
pm.collectionVariables.set("uid_${quien}", r.user.id);
// Cookie de sesión con el formato de @supabase/ssr, para probar las pantallas.
const valor = "base64-" + Buffer.from(JSON.stringify(r)).toString("base64").replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
pm.collectionVariables.set("cookie_${quien}", "sb-localhost-auth-token=" + valor);`,
  }),
  pet(`Aceptar aviso de privacidad: ${quien}`, "POST", "{{api}}/rest/v1/rpc/aceptar_aviso", {
    headers: api(`{{tok_${quien}}}`), body: json({ p_version: "v0.1" }),
    pruebas: `pm.test("Acepta el aviso en esta sesión (CE-16)", () => pm.expect(pm.response.code).to.be.oneOf([200, 204]));`,
  }),
];

// ---------------------------------------------------------------------------
// A01 · Control de acceso roto
// ---------------------------------------------------------------------------
const redirigeAlIngreso = (ruta) => pet(`Sin sesión, ${ruta} manda al ingreso`, "GET", `{{app}}${ruta}`, {
  comportamiento: sinRedir,
  pruebas: `
pm.test("Responde con una redirección", () => pm.expect(pm.response.code).to.be.oneOf([302, 303, 307, 308]));
pm.test("La redirección va a /ingresar", () => pm.expect(pm.response.headers.get("Location")).to.include("/ingresar"));`,
});
const vacio = (nombre, url, tok) => pet(nombre, "GET", url, {
  headers: api(tok),
  pruebas: `
pm.test("No devuelve filas", () => {
  if (pm.response.code === 200) pm.expect(pm.response.json()).to.be.an("array").that.is.empty;
  else pm.expect(pm.response.code).to.be.oneOf([401, 403]);
});`,
});
const rechazado = (nombre, metodo, url, tok, cuerpo, extra = "") => pet(nombre, metodo, url, {
  headers: api(tok), body: cuerpo ? json(cuerpo) : undefined,
  pruebas: `
pm.test("La base rechaza la operación", () => pm.expect(pm.response.code).to.be.within(400, 499));
console.log("respuesta:", pm.response.code, pm.response.text().slice(0, 160));
pm.test("No revela detalles internos (sin traza)", () => pm.expect(pm.response.text()).to.not.match(/\\bat \\w+ \\(|node_modules|stack/i));${extra}`,
});

const a01 = carpeta("A01 · Control de acceso", [
  redirigeAlIngreso("/inicio"), redirigeAlIngreso("/estudiantes"), redirigeAlIngreso("/cuentas"), redirigeAlIngreso("/grupos/{{grupo_adei}}"),
  vacio("Clave pública (anon) sin sesión no lee estudiantes", "{{api}}/rest/v1/estudiante?select=id,nombres", "{{anon}}"),
  vacio("Clave pública sin sesión no lee cuentas", "{{api}}/rest/v1/usuario?select=id,nombre_usuario", "{{anon}}"),
  vacio("Clave pública sin sesión no lee la auditoría", "{{api}}/rest/v1/auditoria?select=id", "{{anon}}"),
  vacio("Clave pública sin sesión no lee tutores", "{{api}}/rest/v1/tutor?select=id,cedula", "{{anon}}"),
  vacio("Asistente de ADEI no ve el estudiante de otra organización", "{{api}}/rest/v1/estudiante?id=eq.{{estudiante_otra}}&select=id,nombres", "{{tok_asistente}}"),
  vacio("Asistente de ADEI no ve la otra organización", "{{api}}/rest/v1/organizacion?id=eq.{{org_otra}}&select=id,nombre", "{{tok_asistente}}"),
  vacio("Asistente de otra organización no ve los estudiantes de ADEI", "{{api}}/rest/v1/estudiante?organizacion_id=eq.{{org_adei}}&select=id", "{{tok_otra}}"),
  pet("Asistente de otra organización no modifica un estudiante de ADEI", "PATCH", "{{api}}/rest/v1/estudiante?id=eq.{{estudiante_adei}}", {
    headers: [...api("{{tok_otra}}"), { key: "Prefer", value: "return=representation" }], body: json({ telefono: "80000000" }),
    pruebas: `pm.test("No modifica ninguna fila", () => { if (pm.response.code === 200) pm.expect(pm.response.json()).to.be.empty; else pm.expect(pm.response.code).to.be.within(400, 499); });`,
  }),
  rechazado("Asistente de otra organización no inscribe en un grupo de ADEI", "POST", "{{api}}/rest/v1/rpc/inscribir", "{{tok_otra}}",
    { p_estudiante: "{{estudiante_adei}}", p_grupo: "{{grupo_adei}}" }),
  rechazado("Profesor no registra estudiantes (solo la Asistente)", "POST", "{{api}}/rest/v1/rpc/registrar_estudiante", "{{tok_profesor}}",
    { p_datos: { nombres: "Intruso", apellidos: "Prueba", fecha_nacimiento: "1990-01-01", telefono: "88887777", sucursal_id: "00000000-0000-0000-0000-000000000000" } }),
  rechazado("Profesor no se da a sí mismo el rol de Asistente (tabla)", "POST", "{{api}}/rest/v1/usuario_rol", "{{tok_profesor}}",
    { organizacion_id: "{{org_adei}}", usuario_id: "{{uid_profesor}}", rol: "asistente" }),
  rechazado("Profesor no se da a sí mismo el rol de Asistente (función)", "POST", "{{api}}/rest/v1/rpc/asignar_roles", "{{tok_profesor}}",
    { p_usuario: "{{uid_profesor}}", p_roles: ["asistente"], p_profesor: null }),
  vacio("Profesor no lee el grupo de otro profesor", "{{api}}/rest/v1/grupo?id=eq.{{grupo_ajeno}}&select=id,codigo_grupo", "{{tok_profesor}}"),
  pet("Profesor solo ve sus propios grupos", "GET", "{{api}}/rest/v1/grupo?select=id,profesor_id,profesor(nombres)", {
    headers: api("{{tok_profesor}}"),
    pruebas: `
const filas = pm.response.json();
pm.test("Ve al menos su grupo", () => pm.expect(filas.length).to.be.above(0));
pm.test("Todos los grupos que ve son suyos", () => filas.forEach((f) => pm.expect(f.profesor.nombres).to.eql("Carla")));`,
  }),
  rechazado("Dirección no registra estudiantes (solo lee)", "POST", "{{api}}/rest/v1/rpc/registrar_estudiante", "{{tok_direccion}}",
    { p_datos: { nombres: "Intruso", apellidos: "Direccion", fecha_nacimiento: "1990-01-01", telefono: "88887777", sucursal_id: "{{sucursal_adei}}" } }),
  pet("Dirección no modifica un expediente", "PATCH", "{{api}}/rest/v1/estudiante?id=eq.{{estudiante_adei}}", {
    headers: [...api("{{tok_direccion}}"), { key: "Prefer", value: "return=representation" }], body: json({ telefono: "80000000" }),
    pruebas: `pm.test("No modifica ninguna fila", () => { if (pm.response.code === 200) pm.expect(pm.response.json()).to.be.empty; else pm.expect(pm.response.code).to.be.within(400, 499); });`,
  }),
  pet("Dirección sí lee los expedientes de su organización (control)", "GET", "{{api}}/rest/v1/estudiante?id=eq.{{estudiante_adei}}&select=id", {
    headers: api("{{tok_direccion}}"),
    pruebas: `pm.test("Ve el expediente: la prueba anterior falló por permiso, no por no verlo", () => pm.expect(pm.response.json()).to.have.lengthOf(1));`,
  }),
  vacio("Profesor no lee la auditoría", "{{api}}/rest/v1/auditoria?select=id", "{{tok_profesor}}"),
  pet("Asistente no puede borrar la auditoría", "DELETE", "{{api}}/rest/v1/auditoria?id=gt.0", {
    headers: [...api("{{tok_asistente}}"), { key: "Prefer", value: "return=representation" }],
    pruebas: `pm.test("No borra ninguna fila", () => { if (pm.response.code === 200) pm.expect(pm.response.json()).to.be.empty; else pm.expect(pm.response.code).to.be.within(400, 499); });`,
  }),
  pet("Sesión nueva sin aceptar el aviso no lee datos (CE-15)", "GET", "{{api}}/rest/v1/estudiante?select=id", {
    headers: api("{{tok_sin_aviso}}"),
    previo: `
pm.sendRequest({ url: pm.variables.get("api") + "/auth/v1/token?grant_type=password", method: "POST",
  header: { apikey: pm.variables.get("anon"), "Content-Type": "application/json" },
  body: { mode: "raw", raw: JSON.stringify({ email: pm.variables.get("correo_asistente"), password: pm.variables.get("clave") }) } },
  (e, r) => pm.collectionVariables.set("tok_sin_aviso", r.json().access_token));`,
    pruebas: `pm.test("No devuelve filas hasta aceptar el aviso", () => pm.expect(pm.response.json()).to.be.an("array").that.is.empty);`,
  }),
  pet("Pantalla: el Profesor no entra a Cuentas", "GET", "{{app}}/cuentas", {
    headers: H({ Cookie: "{{cookie_profesor}}" }), comportamiento: sinRedir,
    pruebas: `pm.test("Lo manda al inicio con aviso de permiso", () => { pm.expect(pm.response.code).to.be.oneOf([302, 303, 307]); pm.expect(pm.response.headers.get("Location")).to.include("sin-permiso"); });`,
  }),
  pet("Pantalla: el expediente de otra organización no existe para ADEI", "GET", "{{app}}/estudiantes/{{estudiante_otra}}", {
    headers: H({ Cookie: "{{cookie_asistente}}" }),
    pruebas: `
pm.test("Responde 404", () => pm.response.to.have.status(404));
pm.test("No muestra el nombre del estudiante ajeno", () => pm.expect(pm.response.text()).to.not.include("OTRAORG"));`,
  }),
  pet("Control: la misma acción desde el propio sitio sí responde", "POST", "{{app}}/ingresar", {
    headers: H({ "Next-Action": "{{id_accion_ingreso}}", Origin: "{{app}}", Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }),
    body: { mode: "raw", raw: '[{},"$K1"]' }, comportamiento: sinRedir,
    previo: `
pm.sendRequest(pm.variables.get("app") + "/ingresar", (e, r) => {
  const m = r.text().match(/\\$ACTION_1:0" value="(\\{[^"]+\\})/);
  pm.collectionVariables.set("id_accion_ingreso", m ? JSON.parse(m[1].replace(/&quot;/g, '"')).id : "no-encontrada");
});`,
    pruebas: `
pm.test("Responde 200 con el resultado de la acción (prueba que el método funciona)", () => { pm.response.to.have.status(200); pm.expect(pm.response.text()).to.include("mensaje"); });`,
  }),
  pet("Una acción enviada desde otro sitio se aborta (CSRF)", "POST", "{{app}}/ingresar", {
    headers: H({ "Next-Action": "{{id_accion_ingreso}}", Origin: "https://sitio-malicioso.example", Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }),
    body: { mode: "raw", raw: '[{},"$K1"]' }, comportamiento: sinRedir,
    previo: `
pm.sendRequest(pm.variables.get("app") + "/ingresar", (e, r) => {
  const m = r.text().match(/\\$ACTION_1:0" value="(\\{[^"]+\\})/);
  pm.collectionVariables.set("id_accion_ingreso", m ? JSON.parse(m[1].replace(/&quot;/g, '"')).id : "no-encontrada");
});`,
    pruebas: `
pm.test("Se encontró el identificador de la acción de ingreso", () => pm.expect(pm.variables.get("id_accion_ingreso")).to.match(/^[0-9a-f]{40,}$/));
pm.test("Next no ejecuta la acción: no responde como un ingreso normal", () => pm.expect(pm.response.code).to.not.eql(200));
pm.test("No devuelve el resultado de la acción", () => pm.expect(pm.response.text()).to.not.include("mensaje"));`,
  }),
  pet("Salir no redirige a sitios externos (redirección abierta)", "GET", "{{app}}/salir?motivo=https://sitio-malicioso.example", {
    comportamiento: sinRedir,
    pruebas: `pm.test("La redirección se queda en /ingresar", () => { const l = pm.response.headers.get("Location"); pm.expect(l).to.match(/^\\/ingresar\\?motivo=salio$/); });`,
  }),
], "Que nadie vea ni cambie lo que no le corresponde: sin sesión, por rol y entre organizaciones.");

// ---------------------------------------------------------------------------
// A02 · Configuración insegura
// ---------------------------------------------------------------------------
const a02 = carpeta("A02 · Configuración", [
  pet("El esquema interno no está expuesto por la API", "GET", "{{api}}/rest/v1/nivel?select=id&limit=0", {
    headers: [...api("{{tok_asistente}}"), { key: "Accept-Profile", value: "interno" }],
    pruebas: `pm.test("La API rechaza el esquema interno (PGRST106)", () => { pm.response.to.have.status(406); pm.expect(pm.response.json().code).to.eql("PGRST106"); });`,
  }),
  pet("El registro público de cuentas está desactivado", "POST", "{{api}}/auth/v1/signup", {
    headers: H({ apikey: "{{anon}}", "Content-Type": "application/json" }), body: json({ email: "intruso@ejemplo.invalid", password: "Intruso 2026 largo" }),
    pruebas: `pm.test("No deja crear cuentas desde fuera", () => pm.expect(pm.response.code).to.be.within(400, 499));`,
  }),
  pet("Encabezados de seguridad en la pantalla de ingreso", "GET", "{{app}}/ingresar", {
    pruebas: `
const h = (n) => (pm.response.headers.get(n) || "").toLowerCase();
pm.test("Prohíbe mostrarse dentro de otro sitio (clickjacking)", () => pm.expect(h("x-frame-options") === "deny" || h("content-security-policy").includes("frame-ancestors 'none'")).to.be.true);
pm.test("Tiene política de seguridad de contenido (CSP)", () => pm.expect(h("content-security-policy")).to.include("default-src"));
pm.test("X-Content-Type-Options: nosniff", () => pm.expect(h("x-content-type-options")).to.eql("nosniff"));
pm.test("Referrer-Policy restrictiva", () => pm.expect(h("referrer-policy")).to.be.oneOf(["strict-origin-when-cross-origin", "no-referrer", "same-origin"]));
pm.test("No anuncia la tecnología del servidor (X-Powered-By)", () => pm.expect(pm.response.headers.has("X-Powered-By")).to.be.false);
pm.test("Restringe permisos del navegador (Permissions-Policy)", () => pm.expect(h("permissions-policy")).to.include("camera=()"));`,
  }),
  pet("Una dirección inexistente responde 404 sin detalles internos", "GET", "{{app}}/no-existe-esta-pagina", {
    headers: H({ Cookie: "{{cookie_asistente}}" }),
    pruebas: `
pm.test("Responde 404", () => pm.response.to.have.status(404));
pm.test("Sin trazas ni rutas del servidor", () => pm.expect(pm.response.text()).to.not.match(/node_modules|\\/home\\/|\\bat \\w+ \\(/));`,
  }),
], "Que el servidor y la API no expongan más de lo necesario.");

// ---------------------------------------------------------------------------
// A04 · Fallas criptográficas / secretos
// ---------------------------------------------------------------------------
const a04 = carpeta("A04 · Secretos y criptografía", [
  pet("La clave de servicio no llega al navegador (HTML ni JavaScript)", "GET", "{{app}}/ingresar", {
    pruebas: `
const frag = pm.variables.get("service_key_fragmento");
pm.test("No está en el HTML", () => pm.expect(pm.response.text()).to.not.include(frag));
const scripts = [...pm.response.text().matchAll(/src="(\\/_next\\/static\\/[^"]+\\.js)"/g)].map((m) => m[1]);
pm.test("La página carga sus archivos JavaScript", () => pm.expect(scripts.length).to.be.above(0));
scripts.forEach((s) => pm.sendRequest(pm.variables.get("app") + s, (e, r) =>
  pm.test("Sin la clave de servicio: " + s.split("/").pop(), () => pm.expect(r.text()).to.not.include(frag))));`,
  }),
  pet("Un token con la firma alterada se rechaza", "GET", "{{api}}/rest/v1/estudiante?select=id", {
    headers: api("{{tok_alterado}}"),
    previo: `const t = pm.variables.get("tok_asistente").split("."); const firma = t[2]; pm.collectionVariables.set("tok_alterado", t[0] + "." + t[1] + "." + (firma[0] === "A" ? "B" : "A") + firma.slice(1));`,
    pruebas: `pm.test("Responde 401", () => pm.response.to.have.status(401));`,
  }),
  pet("Un token sin firma (alg: none) se rechaza", "GET", "{{api}}/rest/v1/estudiante?select=id", {
    headers: api("{{tok_none}}"),
    previo: `
const t = pm.variables.get("tok_asistente").split(".");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\\+/g, "-").replace(/\\//g, "_");
const carga = JSON.parse(Buffer.from(t[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()); carga.role = "service_role";
pm.collectionVariables.set("tok_none", b64({ alg: "none", typ: "JWT" }) + "." + b64(carga) + ".");`,
    pruebas: `pm.test("Responde 401", () => pm.response.to.have.status(401));`,
  }),
], "Que las claves no se filtren y que no se pueda falsificar una sesión.");

// ---------------------------------------------------------------------------
// A05 · Inyección
// ---------------------------------------------------------------------------
const busqueda = (nombre, texto) => pet(nombre, "POST", "{{api}}/rest/v1/rpc/buscar_estudiantes", {
  headers: api("{{tok_asistente}}"), body: json({ p_texto: texto }),
  pruebas: `
pm.test("Responde sin error", () => pm.response.to.have.status(200));
pm.test("El texto se trata como dato: 0 resultados", () => pm.expect(pm.response.json().total || 0).to.eql(0));`,
});
const a05 = carpeta("A05 · Inyección", [
  busqueda("Búsqueda con inyección SQL clásica", "' OR 1=1 --"),
  busqueda("Búsqueda con UNION SELECT", "x' UNION SELECT nombre_usuario FROM usuario --"),
  busqueda("Búsqueda con comodines LIKE", "%%%"),
  pet("Filtro de la API con comillas no altera la consulta", "GET", "{{api}}/rest/v1/estudiante?nombres=eq.x'%20or%20'1'='1&select=id", {
    headers: api("{{tok_asistente}}"),
    pruebas: `pm.test("Responde 200 y sin filas", () => { pm.response.to.have.status(200); pm.expect(pm.response.json()).to.be.empty; });`,
  }),
  rechazado("Un nombre con etiquetas HTML se rechaza", "POST", "{{api}}/rest/v1/rpc/registrar_estudiante", "{{tok_asistente}}",
    { p_datos: { nombres: "<script>alert(1)</script>", apellidos: "Prueba", fecha_nacimiento: "1990-01-01", telefono: "88887777", sucursal_id: "{{sucursal_adei}}" } }),
  pet("Registrar a un adulto con HTML en la dirección (para la prueba siguiente)", "POST", "{{api}}/rest/v1/rpc/registrar_estudiante", {
    headers: api("{{tok_asistente}}"),
    body: json({ p_datos: { nombres: "Xss", apellidos: "Sintetico Prueba", fecha_nacimiento: "1991-02-03", telefono: "88776655", sucursal_id: "{{sucursal_adei}}", direccion: '<script>alert("xss")</script><img src=x onerror=alert(1)>' }, p_confirmar_distinto: true }),
    pruebas: `
pm.test("Se registra (la dirección admite texto libre)", () => pm.response.to.have.status(200));
const r = pm.response.json(); pm.collectionVariables.set("estudiante_xss", r.id || (r.estudiante && r.estudiante.id) || "");`,
  }),
  pet("El HTML guardado se muestra como texto, no se ejecuta (XSS almacenado)", "GET", "{{app}}/estudiantes/{{estudiante_xss}}", {
    headers: H({ Cookie: "{{cookie_asistente}}" }),
    pruebas: `
pm.test("La pantalla abre", () => pm.response.to.have.status(200));
pm.test("No aparece la etiqueta <script> del dato", () => pm.expect(pm.response.text()).to.not.include('<script>alert("xss")'));
pm.test("No aparece el atributo onerror activo", () => pm.expect(pm.response.text()).to.not.include("<img src=x onerror"));
pm.test("El texto aparece escapado", () => pm.expect(pm.response.text()).to.include("&lt;script&gt;"));`,
  }),
], "Que lo que escribe una persona se trate siempre como dato.");

// ---------------------------------------------------------------------------
// A07 · Fallas de autenticación
// ---------------------------------------------------------------------------
const ingresoFallido = (nombre, correo, variable) => pet(nombre, "POST", "{{api}}/auth/v1/token?grant_type=password", {
  headers: H({ apikey: "{{anon}}", "Content-Type": "application/json" }), body: json({ email: correo, password: "Contraseña equivocada 1" }),
  pruebas: `
pm.test("Responde 400", () => pm.response.to.have.status(400));
const r = pm.response.json(); pm.collectionVariables.set("${variable}", JSON.stringify([r.error_code || r.error, r.msg || r.error_description]));`,
});
const a07 = carpeta("A07 · Autenticación", [
  ingresoFallido("Contraseña incorrecta de una cuenta que sí existe", "{{correo_asistente}}", "fallo_existente"),
  ingresoFallido("Cuenta que no existe", "nadie-existe@sigfie.invalid", "fallo_inexistente"),
  pet("Los dos fallos dan la misma respuesta (no se puede averiguar qué cuentas existen)", "GET", "{{app}}/ingresar", {
    pruebas: `pm.test("Mismo código y mismo mensaje", () => pm.expect(pm.variables.get("fallo_existente")).to.eql(pm.variables.get("fallo_inexistente")));`,
  }),
  pet("La sesión se invalida al salir", "POST", "{{api}}/auth/v1/logout?scope=local", {
    headers: api("{{tok_salir}}"),
    previo: `
pm.sendRequest({ url: pm.variables.get("api") + "/auth/v1/token?grant_type=password", method: "POST",
  header: { apikey: pm.variables.get("anon"), "Content-Type": "application/json" },
  body: { mode: "raw", raw: JSON.stringify({ email: pm.variables.get("correo_asistente"), password: pm.variables.get("clave") }) } },
  (e, r) => { pm.collectionVariables.set("tok_salir", r.json().access_token); pm.collectionVariables.set("ref_salir", r.json().refresh_token); });`,
    pruebas: `
pm.test("Cierra la sesión", () => pm.expect(pm.response.code).to.be.oneOf([200, 204]));
pm.sendRequest({ url: pm.variables.get("api") + "/auth/v1/token?grant_type=refresh_token", method: "POST",
  header: { apikey: pm.variables.get("anon"), "Content-Type": "application/json" },
  body: { mode: "raw", raw: JSON.stringify({ refresh_token: pm.variables.get("ref_salir") }) } },
  (e, r) => pm.test("El token de renovación ya no sirve", () => pm.expect(r.code).to.be.within(400, 499)));`,
  }),
], "Que no se pueda adivinar cuentas ni reutilizar sesiones cerradas.");

// ---------------------------------------------------------------------------
// A09 · Registro y alertas
// ---------------------------------------------------------------------------
const a09 = carpeta("A09 · Registro (auditoría)", [
  rechazado("Sin sesión no se pueden escribir eventos en la auditoría", "POST", "{{api}}/rest/v1/rpc/registrar_evento", "{{anon}}",
    { p_tipo: "Acceso", p_entidad: "prueba" }),
  rechazado("No se pueden inventar tipos de evento", "POST", "{{api}}/rest/v1/rpc/registrar_evento", "{{tok_asistente}}",
    { p_tipo: "Eliminación", p_entidad: "estudiante" }),
  rechazado("Nadie puede modificar un registro de auditoría", "PATCH", "{{api}}/rest/v1/auditoria?id=gt.0", "{{tok_asistente}}",
    { detalle: "alterado" }),
  pet("Registrar un estudiante deja rastro en la auditoría", "GET", "{{api}}/rest/v1/auditoria?registro_afectado=eq.{{estudiante_xss}}&select=tipo_accion,usuario_id", {
    headers: api("{{tok_direccion_o_sql}}"),
    previo: `pm.collectionVariables.set("tok_direccion_o_sql", pm.variables.get("tok_asistente"));`,
    pruebas: `pm.test("La Asistente no lee la auditoría: solo Dirección (CE-19)", () => pm.expect(pm.response.json()).to.be.an("array").that.is.empty);`,
  }),
], "Que la auditoría no se pueda falsificar, alterar ni leer sin permiso.");

// ---------------------------------------------------------------------------
// A10 · Manejo de condiciones excepcionales
// ---------------------------------------------------------------------------
const a10 = carpeta("A10 · Errores y excepciones", [
  pet("Un identificador mal formado en la dirección da 404, no un error", "GET", "{{app}}/grupos/esto-no-es-un-uuid", {
    headers: H({ Cookie: "{{cookie_asistente}}" }),
    pruebas: `pm.test("Responde 404", () => pm.response.to.have.status(404)); pm.test("Sin trazas", () => pm.expect(pm.response.text()).to.not.match(/node_modules|\\bat \\w+ \\(/));`,
  }),
  pet("Un expediente inexistente da 404", "GET", "{{app}}/estudiantes/00000000-0000-0000-0000-000000000000", {
    headers: H({ Cookie: "{{cookie_asistente}}" }),
    pruebas: `pm.test("Responde 404", () => pm.response.to.have.status(404));`,
  }),
  pet("JSON mal formado a la API se rechaza sin detalles internos", "POST", "{{api}}/rest/v1/rpc/buscar_estudiantes", {
    headers: api("{{tok_asistente}}"), body: { mode: "raw", raw: "{ esto no es json" },
    pruebas: `pm.test("Responde 400", () => pm.response.to.have.status(400)); pm.test("Sin trazas", () => pm.expect(pm.response.text()).to.not.match(/stack|node_modules/i));`,
  }),
  pet("Un tipo de dato equivocado se rechaza sin caer el servicio", "POST", "{{api}}/rest/v1/rpc/inscribir", {
    headers: api("{{tok_asistente}}"), body: json({ p_estudiante: "no-es-uuid", p_grupo: 12345 }),
    pruebas: `pm.test("Responde 4xx, no 5xx", () => pm.expect(pm.response.code).to.be.within(400, 499));`,
  }),
], "Que un dato inesperado termine en un mensaje claro y no en una caída o una traza.");


// ---------------------------------------------------------------------------
// 002 · Captura académica (spec 002, CE-4, CE-11, CE-35, CE-47, CE-57, CE-59, CE-60)
// ---------------------------------------------------------------------------
const rpc = (f) => `{{api}}/rest/v1/rpc/${f}`;
const parciales = (insc, lista, extra = {}) => ({ p_inscripcion: insc, p_parciales: lista, p_version: 0, ...extra });
const unParcial = (condicion, valor) => [{ numero: 1, condicion, valor }];
const c002 = carpeta("002 · Captura académica", [
  pet("Profesor: el acta de un grupo ajeno responde «denegado» (CE-4)", "POST", rpc("acta_del_grupo"), {
    headers: api("{{tok_profesor}}"), body: json({ p_grupo: "{{grupo_ajeno_002}}" }),
    pruebas: `
pm.test("Responde 200 con estado denegado", () => { pm.response.to.have.status(200); pm.expect(pm.response.json()).to.eql({ estado: "denegado" }); });
pm.test("No trae filas ni nombres", () => pm.expect(pm.response.text()).to.not.include("codigo_adei"));`,
  }),
  pet("Profesor: su propia acta sí la ve, sin cédula ni teléfono (CE-5)", "POST", rpc("acta_del_grupo"), {
    headers: api("{{tok_profesor}}"), body: json({ p_grupo: "{{grupo_propio_002}}" }),
    pruebas: `
pm.test("Responde ok", () => pm.expect(pm.response.json().estado).to.eql("ok"));
pm.test("Sin datos personales de más", () => pm.expect(pm.response.text()).to.not.match(/"(cedula|telefono|fecha_nacimiento|correo|direccion)"/));`,
  }),
  rechazado("Profesor no guarda parciales de un grupo ajeno (CE-11)", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_ajena}}", unParcial("Registrado", 100))),
  rechazado("Profesor no modifica un acta entregada (CE-47)", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_entregada}}", unParcial("Registrado", 100))),
  rechazado("Profesor no pone Reprogramado sin autorización (CE-35)", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_propia}}", unParcial("Reprogramado", 90))),
  rechazado("Una nota de 101 se rechaza (CE-8)", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_propia}}", unParcial("Registrado", 101))),
  rechazado("Una nota con decimales se rechaza (CE-8)", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_propia}}", unParcial("Registrado", 85.5))),
  rechazado("Texto con SQL en la nota se rechaza (A05)", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_propia}}", unParcial("Registrado", "85; delete from parcial")),
    `\npm.test("La tabla sigue ahí: no se ejecutó nada", () => pm.expect(pm.response.text()).to.not.match(/DELETE \\d/));`),
  rechazado("Una condición inventada se rechaza", "POST", rpc("guardar_parciales"), "{{tok_profesor}}",
    parciales("{{insc_propia}}", unParcial("Aprobado por mí", null)),
    `\npm.test("No devuelve la fila rechazada", () => pm.expect(pm.response.text()).to.not.include("Failing row"));`),
  rechazado("La Asistente no captura con el acta abierta (A3)", "POST", rpc("guardar_parciales"), "{{tok_asistente}}",
    parciales("{{insc_propia}}", unParcial("Registrado", 100))),
  rechazado("Dirección no guarda parciales (CE-57)", "POST", rpc("guardar_parciales"), "{{tok_direccion}}",
    parciales("{{insc_entregada}}", unParcial("Registrado", 100), { p_motivo: "Intento de Dirección" })),
  rechazado("Dirección no condiciona (CE-57)", "POST", rpc("condicionar"), "{{tok_direccion}}",
    { p_inscripcion: "{{insc_propia}}", p_justificacion: "Intento de Dirección" }),
  rechazado("Dirección no registra reglas (CE-57)", "POST", rpc("guardar_regla"), "{{tok_direccion}}",
    { p_datos: { programa: "Conversation", nivel_desde: 1, nivel_hasta: 99, vigente_desde: "2099-01-01", nota_minima: 50, provisional: true } }),
  rechazado("Dirección no entrega actas (CE-57)", "POST", rpc("entregar_acta"), "{{tok_direccion}}",
    { p_grupo: "{{grupo_propio_002}}", p_confirmar: true }),
  rechazado("El profesor no autoriza reprogramaciones (Q1)", "POST", rpc("autorizar_reprogramacion"), "{{tok_profesor}}",
    { p_inscripcion: "{{insc_propia}}", p_numero: 1, p_recibo: null }),
  rechazado("Una regla confirmada no se borra (CE-28)", "POST", rpc("eliminar_regla"), "{{tok_asistente}}",
    { p_id: "{{regla_confirmada}}" }),
  rechazado("Nadie escribe directo en la tabla parcial (D26)", "POST", "{{api}}/rest/v1/parcial", "{{tok_profesor}}",
    { inscripcion_id: "{{insc_propia}}", numero: 1, condicion: "Registrado", valor: 100 }),
  pet("Nadie cambia directo una calificación (D26)", "PATCH", "{{api}}/rest/v1/calificacion?inscripcion_id=eq.{{insc_entregada}}", {
    headers: [...api("{{tok_asistente}}"), { key: "Prefer", value: "return=representation" }], body: json({ condicionado: true }),
    pruebas: `pm.test("No cambia ninguna fila", () => { if (pm.response.code === 200) pm.expect(pm.response.json()).to.be.empty; else pm.expect(pm.response.code).to.be.within(400, 499); });`,
  }),
  vacio("Profesor no lee los parciales de un grupo ajeno (CE-58)", "{{api}}/rest/v1/parcial?inscripcion_id=eq.{{insc_ajena}}&select=valor", "{{tok_profesor}}"),
  vacio("Profesor no lee el resultado de un grupo ajeno (CE-58)", "{{api}}/rest/v1/resultado_academico?inscripcion_id=eq.{{insc_ajena}}&select=nota_final", "{{tok_profesor}}"),
  vacio("Otra organización no lee los parciales de ADEI (CE-59)", "{{api}}/rest/v1/parcial?inscripcion_id=eq.{{insc_entregada}}&select=valor", "{{tok_otra}}"),
  pet("Otra organización: el acta de ADEI «no existe» (404, CE-59)", "POST", rpc("acta_del_grupo"), {
    headers: api("{{tok_otra}}"), body: json({ p_grupo: "{{grupo_propio_002}}" }),
    pruebas: `pm.test("Responde 404", () => pm.response.to.have.status(404)); pm.test("Sin trazas", () => pm.expect(pm.response.text()).to.not.match(/stack|node_modules/i));`,
  }),
  rechazado("Sin sesión no hay «Mis grupos»", "POST", rpc("mis_grupos"), "{{anon}}", {}),
  vacio("Sin sesión no se lee la regla de aprobación", "{{api}}/rest/v1/regla_aprobacion?select=id", "{{anon}}"),
], "Que la captura académica respete rol, grupo, estado del acta y organización aunque la petición no pase por la interfaz (CE-60).");

// ---------------------------------------------------------------------------
// 003 · Consulta y reportes (spec 003, CE-18, CE-33, CE-34, CE-66, CE-74, CE-93 a CE-95, CE-97)
// ---------------------------------------------------------------------------
const denegado = (nombre, f, tok, cuerpo = {}) => pet(nombre, "POST", rpc(f), {
  headers: api(tok), body: json(cuerpo),
  pruebas: `
pm.test("Responde 200 con estado denegado y nada más", () => { pm.response.to.have.status(200); pm.expect(pm.response.json()).to.eql({ estado: "denegado" }); });`,
});
const noExiste = (nombre, f, tok, cuerpo) => pet(nombre, "POST", rpc(f), {
  headers: api(tok), body: json(cuerpo),
  pruebas: `
pm.test("Responde «no existe» (404)", () => pm.response.to.have.status(404));
pm.test("No trae datos de ADEI ni trazas", () => pm.expect(pm.response.text()).to.not.match(/ADEI-\\d{4}|codigo_adei|stack|node_modules/i));`,
});
const invalido = (nombre, tok, criterios, vista = "inscripciones", destino = "pantalla", pagina = 1) => pet(nombre, "POST", rpc("filtrar"), {
  headers: api(tok), body: json({ p_criterios: criterios, p_vista: vista, p_pagina: pagina, p_destino: destino }),
  pruebas: `
pm.test("No cae el servicio (sin 5xx)", () => pm.expect(pm.response.code).to.be.below(500));
pm.test("Responde criterios_invalidos, sin filas", () => {
  if (pm.response.code === 200) { const r = pm.response.json(); pm.expect(r.estado).to.eql("criterios_invalidos"); pm.expect(r).to.not.have.property("filas"); }
  else pm.expect(pm.response.code).to.be.within(400, 499);
});`,
});
const sinCambio = (nombre, metodo, url, tok, cuerpo) => pet(nombre, metodo, url, {
  headers: [...api(tok), { key: "Prefer", value: "return=representation" }], body: cuerpo ? json(cuerpo) : undefined,
  pruebas: `pm.test("No cambia ninguna fila", () => { if (pm.response.code === 200) pm.expect(pm.response.json()).to.be.empty; else pm.expect(pm.response.code).to.be.within(400, 499); });`,
});
const factura = (extra = {}) => ({ serie: "B", numero: 9100, fecha_emision: "2026-10-01", monto: 40, moneda: "USD", forma_pago: "Efectivo", estudiantes: ["{{estudiante_adei}}"], ...extra });
const c003 = carpeta("003 · Consulta y reportes", [
  // El profesor no entra a nada de esta spec (CE-18).
  denegado("Profesor: filtrar responde «denegado» (CE-18)", "filtrar", "{{tok_profesor}}", { p_criterios: {}, p_vista: "inscripciones", p_pagina: 1, p_destino: "pantalla" }),
  denegado("Profesor: exportar responde «denegado» (CE-18)", "filtrar", "{{tok_profesor}}", { p_criterios: {}, p_vista: "estudiantes", p_pagina: 1, p_destino: "exportar" }),
  denegado("Profesor: el historial responde «denegado» (CE-18)", "historial_academico", "{{tok_profesor}}", { p_estudiante: "{{estudiante_adei}}" }),
  denegado("Profesor: la Hoja de matrícula responde «denegado»", "hoja_matricula", "{{tok_profesor}}", { p_inscripcion: "{{insc_propia}}" }),
  denegado("Profesor: el panel de actas responde «denegado» (CE-18)", "panel_actas", "{{tok_profesor}}"),
  denegado("Profesor: el reporte por sucursal responde «denegado» (CE-18)", "reporte_sucursales", "{{tok_profesor}}"),
  denegado("Profesor: la bitácora responde «denegado» (CE-93)", "bitacora", "{{tok_profesor}}"),
  denegado("Profesor: el respaldo responde «denegado» (CE-34)", "respaldo", "{{tok_profesor}}"),
  // Cada rol, solo lo suyo.
  denegado("Dirección: el respaldo responde «denegado» (CE-34)", "respaldo", "{{tok_direccion}}"),
  denegado("Asistente: la bitácora responde «denegado» (CE-93)", "bitacora", "{{tok_asistente}}"),
  rechazado("Dirección no registra facturas (CE-66)", "POST", rpc("registrar_factura"), "{{tok_direccion}}", { p_datos: factura(), p_confirmar: true }),
  rechazado("Dirección no anula facturas (CE-66)", "POST", rpc("anular_factura"), "{{tok_direccion}}", { p_id: "{{factura_adei}}", p_motivo: "Intento de Dirección" }),
  rechazado("Dirección no cambia el estado de matrícula (CE-74)", "POST", rpc("cambiar_estado_matricula"), "{{tok_direccion}}",
    { p_estudiante: "{{estudiante_adei}}", p_estado: "Desertor", p_fecha: null, p_observacion: "Intento de Dirección", p_confirmar: true }),
  rechazado("El profesor no registra facturas (CE-66)", "POST", rpc("registrar_factura"), "{{tok_profesor}}", { p_datos: factura(), p_confirmar: true }),
  rechazado("Sin sesión no se filtra", "POST", rpc("filtrar"), "{{anon}}", { p_criterios: {}, p_vista: "inscripciones", p_pagina: 1, p_destino: "pantalla" }),
  rechazado("Sin sesión no hay respaldo", "POST", rpc("respaldo"), "{{anon}}", {}),
  // Otra organización: lo de ADEI «no existe» (CE-95, CE-97).
  noExiste("Otra organización: el historial de un estudiante de ADEI no existe", "historial_academico", "{{tok_otra}}", { p_estudiante: "{{estudiante_adei}}" }),
  noExiste("Otra organización: la Hoja de matrícula de ADEI no existe", "hoja_matricula", "{{tok_otra}}", { p_inscripcion: "{{insc_propia}}" }),
  noExiste("Otra organización: no cambia el estado de un estudiante de ADEI", "cambiar_estado_matricula", "{{tok_otra}}",
    { p_estudiante: "{{estudiante_adei}}", p_estado: "Desertor", p_fecha: null, p_observacion: "Intento ajeno", p_confirmar: true }),
  noExiste("Otra organización: no anula una factura de ADEI", "anular_factura", "{{tok_otra}}", { p_id: "{{factura_adei}}", p_motivo: "Intento ajeno" }),
  noExiste("Otra organización: no corrige una factura de ADEI", "corregir_factura", "{{tok_otra}}",
    { p_id: "{{factura_adei}}", p_version: 1, p_datos: factura({ numero: 9001, monto: 1 }), p_motivo: "Intento ajeno", p_confirmar: true }),
  noExiste("Otra organización: no ampara con su factura a un estudiante de ADEI", "registrar_factura", "{{tok_otra}}", { p_datos: factura(), p_confirmar: true }),
  noExiste("Asistente de ADEI: el reporte de una sucursal ajena no existe", "reporte_sucursales", "{{tok_asistente}}", { p_sucursal: "{{sucursal_otra}}" }),
  pet("Otra organización: filtrar sin criterios no trae a nadie de ADEI (CE-95)", "POST", rpc("filtrar"), {
    headers: api("{{tok_otra}}"), body: json({ p_criterios: {}, p_vista: "estudiantes", p_pagina: 1, p_destino: "exportar" }),
    pruebas: `
pm.test("Responde ok", () => pm.expect(pm.response.json().estado).to.eql("ok"));
pm.test("Ningún estudiante de ADEI", () => { pm.expect(pm.response.text()).to.not.include(pm.variables.get("estudiante_adei")); pm.expect(pm.response.text()).to.not.match(/ADEI-\\d{4}-\\d{5}/); });`,
  }),
  pet("Otra organización: su respaldo no trae nada de ADEI (CE-33, CE-95)", "POST", rpc("respaldo"), {
    headers: api("{{tok_otra}}"), body: json({}),
    pruebas: `
pm.test("Responde ok", () => pm.expect(pm.response.json().estado).to.eql("ok"));
pm.test("Ningún dato de ADEI", () => { const t = pm.response.text(); pm.expect(t).to.not.include(pm.variables.get("estudiante_adei")); pm.expect(t).to.not.match(/ADEI-\\d{4}-\\d{5}|G-\\d{4}-\\d{4}/); });
pm.test("Sin cuentas, contraseñas ni bitácora (CE-33)", () => pm.expect(pm.response.text()).to.not.match(/nombre_usuario|encrypted_password|"auditoria"|"bitacora"/i));`,
  }),
  // Criterios manipulados (A05, CE-1, CE-95).
  invalido("Un criterio inventado se rechaza", "{{tok_asistente}}", { "cedula; drop table estudiante": "1" }),
  invalido("Pedir por organización se rechaza (no es un criterio)", "{{tok_asistente}}", { organizacion_id: "{{org_otra}}" }),
  invalido("Una sucursal de otra organización se rechaza (CE-95)", "{{tok_asistente}}", { sucursal_id: "{{sucursal_otra}}" }),
  invalido("Texto con SQL en un catálogo se rechaza", "{{tok_asistente}}", { modalidad_id: "x' or 1=1 --" }),
  invalido("Una vista inventada se rechaza", "{{tok_asistente}}", {}, "auditoria"),
  invalido("Un destino inventado se rechaza", "{{tok_asistente}}", {}, "inscripciones", "todo"),
  invalido("Los criterios como lista se rechazan", "{{tok_asistente}}", ["sucursal_id"]),
  invalido("Una fecha imposible se rechaza", "{{tok_asistente}}", { desde: "2026-02-31" }),
  pet("Una página negativa no rompe nada: devuelve la primera", "POST", rpc("filtrar"), {
    headers: api("{{tok_asistente}}"), body: json({ p_criterios: {}, p_vista: "inscripciones", p_pagina: -5, p_destino: "pantalla" }),
    pruebas: `pm.test("Responde ok", () => { pm.response.to.have.status(200); pm.expect(pm.response.json().estado).to.eql("ok"); });`,
  }),
  pet("Bitácora: un filtro inventado se rechaza", "POST", rpc("bitacora"), {
    headers: api("{{tok_direccion}}"), body: json({ p_filtros: { tabla: "auth.users" }, p_pagina: 1 }),
    pruebas: `pm.test("Responde criterios_invalidos", () => pm.expect(pm.response.json().estado).to.eql("criterios_invalidos"));`,
  }),
  pet("Bitácora: un tipo de acción con SQL se rechaza", "POST", rpc("bitacora"), {
    headers: api("{{tok_direccion}}"), body: json({ p_filtros: { tipo_accion: "Consulta' or '1'='1" }, p_pagina: 1 }),
    pruebas: `pm.test("Responde criterios_invalidos", () => pm.expect(pm.response.json().estado).to.eql("criterios_invalidos"));`,
  }),
  // Facturas: solo por las operaciones (D34) y con los límites de la base.
  rechazado("Nadie escribe directo en la tabla factura (D34)", "POST", "{{api}}/rest/v1/factura", "{{tok_asistente}}",
    { serie: "B", numero: 9200, fecha_emision: "2026-10-01", monto: 1, moneda: "USD" }),
  sinCambio("Nadie cambia directo el monto de una factura (D34)", "PATCH", "{{api}}/rest/v1/factura?id=eq.{{factura_adei}}", "{{tok_asistente}}", { monto: 1 }),
  sinCambio("Nadie borra directo quién ampara una factura (D34)", "DELETE", "{{api}}/rest/v1/factura_estudiante?factura_id=eq.{{factura_adei}}", "{{tok_asistente}}"),
  sinCambio("El estado de matrícula no cambia directo sin fecha (principio 1)", "PATCH", "{{api}}/rest/v1/estudiante?id=eq.{{estudiante_adei}}", "{{tok_asistente}}", { estado_matricula: "Desertor" }),
  rechazado("Un monto negativo se rechaza (CE-53)", "POST", rpc("registrar_factura"), "{{tok_asistente}}", { p_datos: factura({ monto: -10 }), p_confirmar: true }),
  rechazado("Un número de factura con SQL se rechaza (A05)", "POST", rpc("registrar_factura"), "{{tok_asistente}}", { p_datos: factura({ numero: "1; delete from factura" }), p_confirmar: true }),
  rechazado("Una moneda inventada se rechaza (CE-53)", "POST", rpc("registrar_factura"), "{{tok_asistente}}", { p_datos: factura({ moneda: "EUR" }), p_confirmar: true }),
  rechazado("Una factura con fecha futura se rechaza (CE-53)", "POST", rpc("registrar_factura"), "{{tok_asistente}}", { p_datos: factura({ fecha_emision: "2099-01-01" }), p_confirmar: true }),
  noExiste("Asistente de ADEI: no ampara a un estudiante de otra organización", "registrar_factura", "{{tok_asistente}}",
    { p_datos: factura({ estudiantes: ["{{estudiante_otra}}"] }), p_confirmar: true }),
  // Lo que ve Dirección viene enmascarado y las negaciones quedan registradas (A09, CE-94).
  pet("Bitácora: ninguna cédula ni teléfono completos (CE-94)", "POST", rpc("bitacora"), {
    headers: api("{{tok_direccion}}"), body: json({ p_filtros: {}, p_pagina: 1 }),
    pruebas: `
pm.test("Responde ok", () => pm.expect(pm.response.json().estado).to.eql("ok"));
pm.test("Sin cédula completa", () => pm.expect(pm.response.text()).to.not.match(/\\d{3}-\\d{6}-\\d{4}[A-Z]/));
pm.test("Sin teléfono completo", () => pm.expect(pm.response.text()).to.not.match(/[^\\d*]8\\d{7}[^\\d]/));`,
  }),
  pet("Las negaciones de esta carpeta quedaron en la bitácora (A09, CE-18, CE-34)", "POST", rpc("bitacora"), {
    headers: api("{{tok_direccion}}"), body: json({ p_filtros: { tipo_accion: "Denegación" }, p_pagina: 1 }),
    pruebas: `
const r = pm.response.json();
pm.test("Responde ok", () => pm.expect(r.estado).to.eql("ok"));
const texto = JSON.stringify(r.filas || []);
pm.test("Está la negación del respaldo", () => pm.expect(texto).to.include("respaldo"));
pm.test("Está la negación del filtrado", () => pm.expect(texto).to.include("filtrado"));
pm.test("Está la negación de la bitácora", () => pm.expect(texto).to.include("bitacora"));`,
  }),
], "Que filtrado, historial, Hoja de matrícula, facturas, estado de matrícula, panel, reporte, bitácora y respaldo respeten rol y organización aunque la petición no pase por la interfaz (CE-95).");

const coleccion = {
  info: {
    name: "SIGFIE-ADEI · Pruebas de seguridad (OWASP Top 10:2025)",
    description: "T34. Se ejecuta con Newman SOLO contra la copia local con datos sintéticos. Nunca contra Supabase de producción ni contra Vercel.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  // Freno: la colección se niega a correr contra algo que no sea la copia local.
  event: [{ listen: "prerequest", script: { exec: [
    "const local = /^http:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?$/;",
    "if (!local.test(pm.variables.get('app')) || !local.test(pm.variables.get('api'))) {",
    "  pm.execution.skipRequest();",
    "  throw new Error('Solo se permite correr contra la copia local (127.0.0.1 o localhost). Nunca contra producción.');",
    "}",
  ] } }],
  item: [carpeta("0 · Preparación", [...sesion("asistente", "correo_asistente"), ...sesion("profesor", "correo_profesor"), ...sesion("otra", "correo_otra"), ...sesion("direccion", "correo_direccion"),
    pet("Leer la sucursal central de ADEI (dato para las pruebas)", "GET", "{{api}}/rest/v1/sucursal?select=id&es_central=eq.true", {
      headers: api("{{tok_asistente}}"),
      pruebas: `pm.test("La Asistente ve su sucursal central", () => pm.expect(pm.response.json()).to.have.lengthOf(1)); pm.collectionVariables.set("sucursal_adei", pm.response.json()[0].id);`,
    })],
    "Inicia sesión con cuatro cuentas sintéticas: Asistente, Profesor y Dirección de ADEI, y la Asistente de una organización ficticia."),
    a01, a02, a04, a05, a07, a09, a10, c002, c003],
};
fs.writeFileSync(process.argv[2] ?? "sigfie-seguridad.postman_collection.json", JSON.stringify(coleccion, null, 2));
console.log("pruebas:", JSON.stringify(coleccion).match(/pm\.test\(/g).length);

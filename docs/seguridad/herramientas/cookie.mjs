// Inicia sesión como la Asistente sintética, acepta el aviso e imprime la cookie de
// sesión, para el escaneo completo de ZAP (zap-completo.yaml). Solo copia local.
//   node docs/seguridad/herramientas/cookie.mjs
import fs from "node:fs";
const e = Object.fromEntries(JSON.parse(fs.readFileSync("entorno-local.json")).values.map((v) => [v.key, v.value]));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(e.api)) { console.error("Alto: solo contra la copia local."); process.exit(1); }
const r = await (await fetch(e.api + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: e.anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: e.correo_asistente, password: e.clave }) })).json();
await fetch(e.api + "/rest/v1/rpc/aceptar_aviso", { method: "POST", headers: { apikey: e.anon, Authorization: "Bearer " + r.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ p_version: "v0.1" }) });
process.stdout.write("sb-localhost-auth-token=base64-" + Buffer.from(JSON.stringify(r)).toString("base64url"));

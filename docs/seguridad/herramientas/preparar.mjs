// Prepara la copia LOCAL para las pruebas de seguridad (T34): una cuenta Profesor
// en ADEI y una segunda organización ficticia con su Asistente y un estudiante.
// Todo es sintético. Escribe entorno-local.json para Newman (no se versiona).
//
// Uso, desde la raíz del repositorio y con la copia local ya levantada y con el
// recorrido de pantallas hecho (Aura, la profesora Carla Mena y un grupo):
//   node --env-file=.env.seguridad docs/seguridad/herramientas/preparar.mjs
// .env.seguridad lleva las variables de la COPIA LOCAL, con los mismos nombres
// que .env.local. Nunca las de producción: el script se niega si no son locales.
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import fs from "node:fs";
const env = process.env;
const local = (u) => /^(postgres(ql)?|https?):\/\/([^@/]*@)?(127\.0\.0\.1|localhost)[:/]/.test(u ?? "");
if (!local(env.NEXT_PUBLIC_SUPABASE_URL) || !local(env.SUPABASE_DB_URL)) {
  console.error("Alto: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_DB_URL deben apuntar a 127.0.0.1 o localhost. Nunca a producción.");
  process.exit(1);
}
const db = new pg.Client({ connectionString: env.SUPABASE_DB_URL }); await db.connect();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CLAVE = "Prueba Local 2026";
const q = async (s, p) => (await db.query(s, p)).rows;

async function usuarioAuth() {
  const correo = `u-${crypto.randomUUID()}@sigfie.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error; return { id: data.user.id, correo };
}
const [adei] = await q("select id from organizacion where codigo = 'ADEI'");
const [carla] = await q("select id from profesor where organizacion_id = $1 and nombres = 'Carla'", [adei.id]);

// Profesor de ADEI
if (!(await q("select 1 from usuario where nombre_usuario = 'carla.mena'")).length) {
  const a = await usuarioAuth();
  await q("insert into usuario (id, organizacion_id, nombre_usuario, profesor_id) values ($1,$2,'carla.mena',$3)", [a.id, adei.id, carla.id]);
  await q("insert into usuario_rol values ($1,$2,'profesor')", [adei.id, a.id]);
}

// Dirección de ADEI (solo lectura) y un grupo de OTRO profesor de ADEI
if (!(await q("select 1 from usuario where nombre_usuario = 'diana.direccion'")).length) {
  const a = await usuarioAuth();
  await q("insert into usuario (id, organizacion_id, nombre_usuario) values ($1,$2,'diana.direccion')", [a.id, adei.id]);
  await q("insert into usuario_rol values ($1,$2,'direccion')", [adei.id, a.id]);
}
if (!(await q("select 1 from profesor where organizacion_id = $1 and nombres = 'PRUEBA Luis'", [adei.id])).length) {
  const [luis] = await q("insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1,'PRUEBA Luis','Ajeno Ficticio','88001122') returning id", [adei.id]);
  const [g] = await q("select nivel_id, horario_id, sucursal_id from grupo where organizacion_id = $1 limit 1", [adei.id]);
  await q("insert into grupo (organizacion_id, nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino) values ($1,$2,$3,$4,$5, current_date, current_date + 30)",
    [adei.id, g.nivel_id, g.horario_id, luis.id, g.sucursal_id]);
}

// Segunda organización
let [otra] = await q("select id from organizacion where codigo = 'OTRA'");
if (!otra) {
  [otra] = await q("insert into organizacion (codigo, nombre) values ('OTRA','Academia Ficticia de Prueba') returning id");
  const [suc] = await q("insert into sucursal (organizacion_id, nombre, direccion, es_central) values ($1,'Sede Ficticia','Dirección ficticia',true) returning id", [otra.id]);
  await q("insert into aviso_privacidad (organizacion_id, version, texto) values ($1,'v0.1',$2)", [otra.id, "Aviso de privacidad ficticio de la organización de prueba, solo para la copia local."]);
  await q("insert into estudiante (organizacion_id, nombres, apellidos, fecha_nacimiento, sucursal_id, cedula, telefono) values ($1,'OTRAORG Secreto','Ficticio Ajeno','1990-01-01',$2,'999-010190-0001A','88990011')", [otra.id, suc.id]);
}
if (!(await q("select 1 from usuario where nombre_usuario = 'otra.asistente'")).length) {
  const a = await usuarioAuth();
  await q("insert into usuario (id, organizacion_id, nombre_usuario) values ($1,$2,'otra.asistente')", [a.id, otra.id]);
  await q("insert into usuario_rol values ($1,$2,'asistente')", [otra.id, a.id]);
}
// Aura con clave conocida
const [aura] = await q("select id from usuario where nombre_usuario = 'aura.gomez'");
await admin.auth.admin.updateUserById(aura.id, { password: CLAVE });
await q("update usuario set debe_cambiar_contrasena = false where nombre_usuario in ('aura.gomez','carla.mena','otra.asistente','diana.direccion')");
const correo = async (u) => (await q("select a.email from auth.users a join usuario u on u.id = a.id where u.nombre_usuario = $1", [u]))[0].email;
const [estOtra] = await q("select id from estudiante where organizacion_id = $1", [otra.id]);
const [estAdei] = await q("select id from estudiante where organizacion_id = $1 order by codigo_adei limit 1", [adei.id]);
const [grupo] = await q("select g.id from grupo g join profesor p on p.id = g.profesor_id where g.organizacion_id = $1 and p.nombres = 'Carla' limit 1", [adei.id]);
const [grupoAjeno] = await q("select g.id from grupo g join profesor p on p.id = g.profesor_id where p.nombres = 'PRUEBA Luis'");
const valores = {
  app: "http://127.0.0.1:3000", api: env.NEXT_PUBLIC_SUPABASE_URL.replace("localhost", "127.0.0.1"), anon: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  correo_asistente: await correo("aura.gomez"), correo_profesor: await correo("carla.mena"), correo_otra: await correo("otra.asistente"), correo_direccion: await correo("diana.direccion"), grupo_ajeno: grupoAjeno.id,
  clave: CLAVE, org_otra: otra.id, org_adei: adei.id, estudiante_otra: estOtra.id, estudiante_adei: estAdei.id, grupo_adei: grupo.id,
  service_key_fragmento: env.SUPABASE_SERVICE_ROLE_KEY.split(".")[2].slice(0, 20),
};
fs.writeFileSync("entorno-local.json", JSON.stringify({
  name: "SIGFIE local (sintético)", values: Object.entries(valores).map(([key, value]) => ({ key, value, enabled: true })) }, null, 2));
console.log("listo:", Object.keys(valores).join(", "));
await db.end();

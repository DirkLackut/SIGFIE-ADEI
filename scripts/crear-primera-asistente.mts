/**
 * Crea la PRIMERA cuenta de Asistente de Dirección (T25). Las demás cuentas las
 * crea ella desde la pantalla Cuentas; esta no, porque todavía no hay nadie que
 * pueda crearla (el huevo y la gallina).
 *
 * Uso (en tu PC, una sola vez):
 *   npm run crear:asistente -- nombre.de.usuario
 *
 * Lee de .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y
 * SUPABASE_DB_URL. Muestra la contraseña temporal UNA vez en la terminal: al
 * ingresar con ella, el sistema pide elegir una propia (CE-9).
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { generarContrasenaTemporal } from "../src/dominio/contrasena.ts";

const nombre = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^\S{4,30}$/.test(nombre)) {
  console.error("Indique el nombre de usuario (4 a 30 caracteres, sin espacios):  npm run crear:asistente -- aura.gomez");
  process.exit(2);
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: clave, SUPABASE_DB_URL: bd } = process.env;
if (!url || !clave || !bd || bd.includes("[YOUR-PASSWORD]")) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_DB_URL en .env.local.");
  process.exit(2);
}

const admin = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
const u = new URL(bd); u.searchParams.delete("sslmode");
const local = ["127.0.0.1", "localhost"].includes(u.hostname);
const db = new pg.Client({ connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false } });
await db.connect();

try {
  const ya = await db.query("select 1 from public.usuario where nombre_usuario = $1", [nombre]);
  if (ya.rowCount) throw new Error(`Ya existe una cuenta «${nombre}».`);
  const org = (await db.query<{ id: string }>("select id from public.organizacion where codigo = 'ADEI'")).rows[0]?.id;
  if (!org) throw new Error("No existe la organización ADEI: ¿se aplicaron las migraciones?");

  const temporal = generarContrasenaTemporal();
  const { data, error } = await admin.auth.admin.createUser({
    email: `u-${crypto.randomUUID()}@sigfie.invalid`, password: temporal, email_confirm: true });
  if (error || !data.user) throw new Error(`Supabase Auth no creó el usuario: ${error?.message}`);

  try {
    await db.query("begin");
    await db.query(`insert into public.usuario (id, organizacion_id, nombre_usuario, debe_cambiar_contrasena, contrasena_temporal_emitida)
                    values ($1, $2, $3, true, now())`, [data.user.id, org, nombre]);
    await db.query("insert into public.usuario_rol (organizacion_id, usuario_id, rol) values ($1, $2, 'asistente')", [org, data.user.id]);
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    await admin.auth.admin.deleteUser(data.user.id);
    throw e;
  }

  console.log(`\nCuenta creada: ${nombre} (Asistente de Dirección)`);
  console.log(`Contraseña temporal: ${temporal}`);
  console.log("Anótela ahora: no se vuelve a mostrar. Vence en 3 días. Al ingresar se pide elegir una propia.\n");
} catch (e) {
  console.error(`\nNo se creó la cuenta: ${(e as Error).message}\n`);
  process.exitCode = 1;
} finally {
  await db.end();
}

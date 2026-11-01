/**
 * T16 · Verificación del proyecto Supabase real, SIN DEJAR RASTRO.
 *
 * sigfie-adei es el único proyecto y será el de producción, y la auditoría no se
 * puede borrar. Por eso no se corre aquí la suite completa: se comprueba lo que
 * PGlite no puede comprobar y lo que depende de cómo está configurado el proyecto.
 *
 *   1. Seguridad (solo lectura): RLS, políticas y permisos de anon y authenticated.
 *   2. Comportamiento con RLS, dentro de transacciones que se deshacen.
 *   3. Correlativos pedidos a la vez desde varias conexiones (año ficticio 2999;
 *      la tabla correlativo no se audita y sus filas se borran al final).
 *   4. Contraseñas guardadas con bcrypt (CE-12).
 *   5. Que la auditoría no cambió: la prueba de que no quedó rastro.
 *
 * Uso (en tu PC):  npm run verificar:supabase
 * Lee SUPABASE_DB_URL de .env.local. Esa cadena lleva la contraseña de la base:
 * nunca se pega en el chat ni se versiona.
 */
import pg from "pg";
import { readdirSync } from "node:fs";

const URL_BD = process.env.SUPABASE_DB_URL;
if (!URL_BD || URL_BD.includes("[YOUR-PASSWORD]")) {
  console.error("Falta SUPABASE_DB_URL en .env.local (con tu contraseña en lugar de [YOUR-PASSWORD]).");
  process.exit(2);
}

// Funciones que un usuario con sesión puede ejecutar. Es la misma lista que vigila
// tests/bd/t11-permisos.test.ts: si se cambia una, se cambia la otra.
const FUNCIONES_DE_USUARIO = [
  "abrir_grupo", "acceso_habilitado", "aceptar_aviso", "actualizar_estudiante",
  "anular_inscripcion", "asignar_roles", "buscar_estudiantes", "cambiar_profesor", "crear_cuenta", "desvincular_tutor",
  "edad", "hoy_managua", "inscribir", "mi_estado_acceso", "mi_organizacion", "mi_profesor_id",
  "normalizar", "registrar_estudiante", "registrar_evento", "tiene_rol", "vincular_tutor",
];
// Las migraciones que deben estar aplicadas son las del repositorio: así esta lista
// no se queda atrás cuando se agrega una nueva.
const MIGRACIONES = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .filter((f) => /^\d{3}_.*\.sql$/.test(f)).map((f) => f.slice(0, 3)).sort();
const ANIO_FICTICIO = 2999;

/**
 * Pregunta a la API REST de Supabase por el esquema `interno`. PostgREST responde
 * 406 con el código PGRST106 y la lista de esquemas publicados. Solo lee: es un GET
 * con la clave anon, la misma que va en el navegador.
 */
async function esquemasPublicados(): Promise<{ ok: true; lista: string[] } | { ok: false; motivo: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, motivo: "faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local" };
  try {
    // A una tabla, no a la raíz `/rest/v1/`: Supabase reserva la raíz (la
    // descripción de toda la API) a la clave secreta y responde 401 a la anon.
    const r = await fetch(new URL("/rest/v1/nivel?select=id&limit=0", url), {
      // Las claves nuevas (sb_publishable_…) no son JWT: van solo en `apikey`.
      headers: { apikey: anon, ...(anon.startsWith("eyJ") ? { Authorization: `Bearer ${anon}` } : {}), "Accept-Profile": "interno" },
      signal: AbortSignal.timeout(10_000),
    });
    const cuerpo = (await r.json().catch(() => ({}))) as { code?: string; message?: string };
    // Si la API aceptó el esquema (responde la consulta, o dice que ahí no existe la
    // tabla), es que `interno` está publicado.
    // (42501 = la API lo publica, aunque los permisos todavía impidan usarlo.)
    if (r.ok || cuerpo.code === "PGRST205" || cuerpo.code === "42501" || r.status === 404) return { ok: true, lista: ["interno"] };
    // PGRST106 = la API rechaza el esquema: no lo publica. Algunas versiones de
    // PostgREST traen la lista de los que sí publica; la de Supabase solo dice
    // "Invalid schema: interno".
    if (cuerpo.code === "PGRST106") {
      const m = cuerpo.message?.match(/following:\s*(.+)$/);
      return { ok: true, lista: m ? m[1].split(",").map((x) => x.trim()).filter(Boolean) : [] };
    }
    const tipo = anon.startsWith("eyJ") ? "clave anon (legacy)" : anon.startsWith("sb_publishable_") ? "clave publishable" : "clave de formato desconocido";
    return { ok: false, motivo: `la API respondió ${r.status}${cuerpo.code ? " " + cuerpo.code : ""} con la ${tipo}: ${cuerpo.message ?? "sin mensaje"}` };
  } catch (e) {
    return { ok: false, motivo: `sin respuesta de la API: ${(e as Error).message}` };
  }
}

function conectar(): pg.Client {
  const u = new URL(URL_BD!);
  u.searchParams.delete("sslmode");
  const local = ["127.0.0.1", "localhost"].includes(u.hostname);
  // Supabase cifra la conexión con un certificado de su propia autoridad, que Node
  // no trae; se cifra igual, sin validar la cadena del certificado.
  return new pg.Client({ connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false } });
}

let fallas = 0;
function revisar(ok: boolean, que: string, detalle = "") {
  if (!ok) fallas++;
  console.log(`${ok ? "  ✔" : "  ✘"} ${que}${detalle ? `\n      ${detalle}` : ""}`);
}
const info = (texto: string) => console.log(`  · ${texto}`);
const iguales = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

async function lista(c: pg.Client, sql: string, params: unknown[] = []): Promise<string[]> {
  return (await c.query<{ x: string }>(sql, params)).rows.map((r) => r.x);
}

/** Ejecuta fn dentro de una transacción que SIEMPRE se deshace. */
async function sinGuardar<T>(c: pg.Client, fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  try { return await fn(); } finally { await c.query("rollback"); }
}

const c = conectar();
await c.connect();
let organizacion = "";
let auditoriaAntes = -1;

try {
  console.log("\nProyecto");
  info((await c.query<{ v: string }>("select current_setting('server_version') v")).rows[0].v.replace(/ .*/, "") + " (PostgreSQL)");
  const aplicadas = await lista(c, "select version x from supabase_migrations.schema_migrations order by 1");
  revisar(iguales(aplicadas, MIGRACIONES), `migraciones ${MIGRACIONES[0]} a ${MIGRACIONES.at(-1)} aplicadas (las del repositorio)`, `aplicadas: ${aplicadas.join(", ")}`);
  organizacion = (await c.query<{ id: string }>("select id from public.organizacion where codigo = 'ADEI'")).rows[0]?.id ?? "";
  revisar(organizacion !== "", "existe la organización ADEI (semilla)");
  const aviso = (await c.query<{ v: string }>("select public.aviso_vigente($1) v", [organizacion])).rows[0]?.v;
  revisar(aviso === "v0.1", "hay un aviso de privacidad vigente", `vigente: ${aviso}`);
  auditoriaAntes = Number((await c.query<{ n: string }>("select count(*) n from public.auditoria")).rows[0].n);

  console.log("\n1. Seguridad (solo lectura)");
  const sinRls = await lista(c, `select c.relname x from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`);
  revisar(sinRls.length === 0, "todas las tablas tienen RLS", sinRls.join(", "));

  const sinPoliticas = await lista(c, `select c.relname x from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)`);
  revisar(iguales(sinPoliticas, ["correlativo"]), "solo correlativo queda sin políticas (nadie la toca por la API)", sinPoliticas.join(", "));

  const tablasAnon = await lista(c, `select c.relname x from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
      and has_table_privilege('anon', c.oid, 'select, insert, update, delete')`);
  revisar(tablasAnon.length === 0, "sin sesión no se puede leer ni escribir ninguna tabla", tablasAnon.join(", "));

  // Las funciones de trigger no se pueden llamar directamente: no cuentan.
  const ejecutables = (rol: string, esquema: string) => lista(c, `select distinct p.proname x from pg_proc p
    where p.pronamespace = $2::regnamespace
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
      and has_function_privilege($1, p.oid, 'execute')`, [rol, esquema]);

  const anonPublic = await ejecutables("anon", "public");
  revisar(anonPublic.length === 0, "sin sesión no se puede ejecutar ninguna función", anonPublic.join(", "));
  const anonInterno = await ejecutables("anon", "interno");
  revisar(anonInterno.length === 0, "sin sesión tampoco las auxiliares de interno", anonInterno.join(", "));

  const deUsuario = await ejecutables("authenticated", "public");
  const sobran = deUsuario.filter((f) => !FUNCIONES_DE_USUARIO.includes(f));
  const faltan = FUNCIONES_DE_USUARIO.filter((f) => !deUsuario.includes(f));
  revisar(sobran.length === 0 && faltan.length === 0, "un usuario ejecuta exactamente las funciones previstas",
    [sobran.length ? `sobran: ${sobran.join(", ")}` : "", faltan.length ? `faltan: ${faltan.join(", ")}` : ""].filter(Boolean).join(" · "));

  // Qué esquemas publica la API. En Supabase eso no vive en la base sino en la
  // configuración del proyecto (Settings → Data API), así que se le pregunta a la
  // propia API: se pide el esquema `interno` y tiene que negarse (PGRST106). Su
  // respuesta trae además la lista de esquemas que sí publica.
  const esquemas = await esquemasPublicados();
  if (esquemas.ok) {
    const publica = esquemas.lista.includes("interno");
    revisar(!publica, "la API no publica el esquema interno",
      publica ? "la API aceptó un pedido al esquema interno: quítalo en Settings → Data API → Exposed schemas"
              : esquemas.lista.length ? `publica: ${esquemas.lista.join(", ")}` : "la API rechaza el esquema interno (PGRST106)");
  } else {
    // Sin URL y clave anon, o sin red: se intenta con la configuración en la base.
    const config = await lista(c, "select unnest(rolconfig) x from pg_roles where rolname = 'authenticator'");
    const enBase = config.find((x) => x.startsWith("pgrst.db_schemas="));
    if (enBase) revisar(!enBase.includes("interno"), "la API no publica el esquema interno", enBase);
    else info(`no se pudo comprobar qué esquemas publica la API (${esquemas.motivo})`);
  }

  console.log("\n2. Comportamiento con RLS (transacciones que se deshacen)");
  const anonLee = await sinGuardar(c, async () => {
    await c.query("set local role anon");
    try { await c.query("select 1 from public.estudiante limit 1"); return "pudo leer"; }
    catch (e) { return (e as Error).message; }
  });
  revisar(/permission denied/.test(anonLee), "alguien sin sesión que pide estudiantes recibe 'permiso denegado'", anonLee);

  const extranoVe = await sinGuardar(c, async () => {
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated" })]);
    await c.query("set local role authenticated");
    return Number((await c.query<{ n: string }>("select count(*) n from public.nivel")).rows[0].n);
  });
  revisar(extranoVe === 0, "una sesión sin cuenta en SIGFIE no ve ni el catálogo de niveles", `filas vistas: ${extranoVe}`);

  console.log(`\n3. Correlativos pedidos a la vez (año ficticio ${ANIO_FICTICIO})`);
  await c.query("delete from public.correlativo where organizacion_id = $1 and anio = $2", [organizacion, ANIO_FICTICIO]);
  const pedir = (cl: pg.Client) =>
    cl.query<{ n: number }>("select public.siguiente_correlativo($1, 'grupo', $2) n", [organizacion, ANIO_FICTICIO]).then((r) => r.rows[0].n);

  const a = conectar(), b = conectar();
  await a.connect(); await b.connect();
  try {
    // a) Mientras una transacción tiene un número sin confirmar, la otra espera.
    await a.query("begin"); await b.query("begin");
    const primero = await pedir(a);
    let segundoListo = false;
    const segundo = pedir(b).then((n) => { segundoListo = true; return n; });
    await new Promise((r) => setTimeout(r, 1500));
    revisar(!segundoListo, "la segunda conexión espera mientras la primera no confirma");
    await a.query("commit");
    const n2 = await segundo;
    await b.query("commit");
    revisar(primero === 1 && n2 === 2, "y al confirmar recibe el número siguiente, no el mismo", `primera: ${primero}, segunda: ${n2}`);

    // b) Cuatro conexiones piden 25 números cada una, todas a la vez.
    const extra = [conectar(), conectar()];
    for (const x of extra) await x.connect();
    try {
      const todas = [a, b, ...extra];
      const numeros = (await Promise.all(todas.map(async (cl) => {
        const mios: number[] = [];
        for (let i = 0; i < 25; i++) mios.push(await pedir(cl));
        return mios;
      }))).flat();
      const distintos = new Set(numeros);
      const esperado = Array.from({ length: 100 }, (_, i) => i + 3);
      revisar(distintos.size === 100 && esperado.every((n) => distintos.has(n)),
        "100 números pedidos a la vez desde 4 conexiones: ninguno repetido, ninguno saltado",
        `distintos: ${distintos.size}, del ${Math.min(...numeros)} al ${Math.max(...numeros)}`);
    } finally {
      for (const x of extra) await x.end();
    }
  } finally {
    await a.end(); await b.end();
    await c.query("delete from public.correlativo where organizacion_id = $1 and anio = $2", [organizacion, ANIO_FICTICIO]);
  }
  const quedan = Number((await c.query<{ n: string }>(
    "select count(*) n from public.correlativo where anio = $1", [ANIO_FICTICIO])).rows[0].n);
  revisar(quedan === 0, `se borraron los correlativos de ${ANIO_FICTICIO}`);

  console.log("\n4. Contraseñas (CE-12)");
  const cuentas = (await c.query<{ total: string; legibles: string }>(`select count(*) total,
      count(*) filter (where encrypted_password is not null and encrypted_password <> '' and encrypted_password not like '$2%') legibles
    from auth.users`)).rows[0];
  revisar(Number(cuentas.legibles) === 0, "ninguna contraseña está guardada sin bcrypt",
    `cuentas: ${cuentas.total}${Number(cuentas.total) === 0 ? " (aún no hay; se repite al crear la primera)" : ""}`);

  console.log("\n5. Sin rastro");
  const auditoriaDespues = Number((await c.query<{ n: string }>("select count(*) n from public.auditoria")).rows[0].n);
  revisar(auditoriaDespues === auditoriaAntes, "la auditoría tiene las mismas filas que al empezar", `${auditoriaAntes} → ${auditoriaDespues}`);
} catch (e) {
  fallas++;
  console.error(`\n  ✘ Error inesperado: ${(e as Error).message}`);
} finally {
  await c.end();
}

console.log(fallas === 0 ? "\nTodo en orden.\n" : `\n${fallas} comprobación(es) fallaron.\n`);
process.exit(fallas === 0 ? 0 : 1);

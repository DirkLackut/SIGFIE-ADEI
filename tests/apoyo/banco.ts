/**
 * Banco de pruebas de base de datos (tarea T2, plan D12).
 *
 * Levanta un PostgreSQL en memoria con PGlite, simula lo necesario de Supabase
 * (tests/apoyo/supabase-simulado.sql) y aplica las migraciones reales de
 * supabase/migrations en orden. Cada archivo de pruebas crea su propio banco:
 * nada se comparte entre pruebas y nada toca el Supabase real.
 */
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(__dirname, "../..");
const SIMULACION = readFileSync(join(RAIZ, "tests/apoyo/supabase-simulado.sql"), "utf8");
export const MIGRACIONES = join(RAIZ, "supabase/migrations");

/** Archivos .sql de una carpeta, en orden por nombre (001_…, 002_…). */
export function listarMigraciones(carpeta = MIGRACIONES): string[] {
  return readdirSync(carpeta)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en"));
}

/** La semilla (009) carga la organización ADEI real. Las pruebas arman sus propios
 *  escenarios, así que la dejan fuera salvo que la pidan. */
const esSemilla = (archivo: string) => archivo.endsWith("_semilla.sql");

export interface Banco {
  db: PGlite;
  aplicadas: string[];
}

const EXTENSIONES = { pg_trgm, unaccent };

/**
 * Plantillas ya construidas, una por carpeta de migraciones. Levantar Postgres y
 * aplicar las migraciones tarda ~2 s; copiar una plantilla, mucho menos. Cada
 * prueba recibe una copia propia: lo que una prueba escribe no lo ve otra.
 */
const plantillas = new Map<string, Promise<{ imagen: Blob; aplicadas: string[] }>>();

async function construirPlantilla(carpeta: string, semilla: boolean) {
  const db = await PGlite.create({ extensions: EXTENSIONES });
  await db.exec(SIMULACION);
  const aplicadas: string[] = [];
  for (const archivo of listarMigraciones(carpeta).filter((f) => semilla || !esSemilla(f))) {
    try {
      await db.exec(readFileSync(join(carpeta, archivo), "utf8"));
    } catch (e) {
      throw new Error(`La migración ${archivo} falló: ${(e as Error).message}`);
    }
    aplicadas.push(archivo);
  }
  const imagen = await db.dumpDataDir("none");
  await db.close();
  return { imagen, aplicadas };
}

/** Crea un banco nuevo, con la simulación de Supabase y las migraciones aplicadas
 *  (la semilla, solo si se pide). */
export async function crearBanco(carpeta = MIGRACIONES, { semilla = false } = {}): Promise<Banco> {
  const clave = `${carpeta}|${semilla}`;
  if (!plantillas.has(clave)) {
    const p = construirPlantilla(carpeta, semilla);
    plantillas.set(clave, p);
    p.catch(() => plantillas.delete(clave)); // un error no se queda guardado
  }
  const { imagen, aplicadas } = await plantillas.get(clave)!;
  const db = await PGlite.create({ extensions: EXTENSIONES, loadDataDir: imagen });
  return { db, aplicadas: [...aplicadas] };
}

export interface UsuarioSimulado {
  id: string;
  sesion: string;
  correo: string;
}

/** Inserta un usuario y una sesión en auth, como lo haría Supabase Auth. */
export async function crearUsuarioAuth(db: PGlite, correo?: string): Promise<UsuarioSimulado> {
  const id = randomUUID();
  const sesion = randomUUID();
  const c = correo ?? `u-${id}@sigfie.invalid`;
  await db.query("insert into auth.users (id, email, encrypted_password) values ($1, $2, $3)", [
    id,
    c,
    "$2a$10$simulado",
  ]);
  await db.query("insert into auth.sessions (id, user_id) values ($1, $2)", [sesion, id]);
  return { id, sesion, correo: c };
}

/**
 * Ejecuta `fn` con los permisos de un usuario autenticado, como si la consulta
 * llegara por la API de Supabase con su token: rol `authenticated` y los claims
 * del token (sub = id del usuario, session_id = su sesión).
 *
 * Todo va dentro de una transacción con `set local`, así que al terminar no
 * queda ni el rol ni el usuario puestos para la siguiente consulta.
 * Si `fn` lanza un error, la transacción se deshace.
 */
export async function comoUsuario<T>(
  db: PGlite,
  u: UsuarioSimulado,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: u.id, role: "authenticated", session_id: u.sesion });
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

/** Igual que comoUsuario, pero sin usuario: lo que ve alguien sin sesión. */
export async function comoAnonimo<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "anon" }),
    ]);
    await tx.exec("set local role anon");
    return fn(tx);
  });
}

/** Con la clave de servicio: ignora RLS. Solo la usa el servidor de la app. */
export async function comoServicio<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "service_role" }),
    ]);
    await tx.exec("set local role service_role");
    return fn(tx);
  });
}

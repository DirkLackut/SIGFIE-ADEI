/**
 * Arma escenarios de prueba: organizaciones, catálogos mínimos y personas con
 * sus roles. Todo se crea como superusuario (sin pasar por RLS); lo que se
 * prueba después se hace "como" cada persona con comoUsuario().
 * Todos los datos son inventados (constitución, principio 3).
 */
import type { PGlite } from "@electric-sql/pglite";
import { crearUsuarioAuth, type UsuarioSimulado } from "./banco";
import { hoyEnManagua } from "@/dominio/edad";

export type Rol = "asistente" | "direccion" | "profesor" | "admin_tecnico";

const fila = async <T>(db: PGlite, sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

export const TEXTO_AVISO =
  "Los datos personales de los estudiantes son de uso exclusivo de la academia. Texto de prueba.";

export async function crearOrganizacion(db: PGlite, codigo: string, nombre = `Academia ${codigo}`) {
  const { id } = await fila<{ id: string }>(db,
    "insert into organizacion (codigo, nombre) values ($1, $2) returning id", [codigo, nombre]);
  await db.query(
    "insert into aviso_privacidad (organizacion_id, version, texto, vigente_desde) values ($1, 'v0.1', $2, now() - interval '1 day')",
    [id, TEXTO_AVISO]);
  return id;
}

let consecutivo = 0;

export async function crearProfesor(db: PGlite, org: string, nombres = "Ana", apellidos = "López") {
  return (await fila<{ id: string }>(db,
    "insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1, $2, $3, '88887777') returning id",
    [org, nombres, apellidos])).id;
}

export interface Persona extends UsuarioSimulado {
  organizacion: string;
  nombreUsuario: string;
  profesorId: string | null;
}

/** Crea una cuenta con sus roles. Por defecto ya aceptó el aviso en su sesión. */
export async function crearPersona(
  db: PGlite,
  org: string,
  roles: Rol[],
  opciones: { aceptaAviso?: boolean; debeCambiar?: boolean; profesorId?: string } = {},
): Promise<Persona> {
  const u = await crearUsuarioAuth(db);
  const nombreUsuario = `persona${++consecutivo}`;
  const profesorId = roles.includes("profesor") ? (opciones.profesorId ?? (await crearProfesor(db, org))) : null;
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into usuario (id, organizacion_id, nombre_usuario, profesor_id, debe_cambiar_contrasena, contrasena_temporal_emitida)
       values ($1, $2, $3, $4, $5, case when $5 then now() end)`,
      [u.id, org, nombreUsuario, profesorId, opciones.debeCambiar ?? false]);
    for (const r of roles)
      await tx.query("insert into usuario_rol (organizacion_id, usuario_id, rol) values ($1, $2, $3)", [org, u.id, r]);
  });
  if (opciones.aceptaAviso ?? true) await aceptarAviso(db, org, u);
  return { ...u, organizacion: org, nombreUsuario, profesorId };
}

export async function aceptarAviso(db: PGlite, org: string, u: UsuarioSimulado) {
  await db.query(
    "insert into aceptacion_privacidad (organizacion_id, usuario_id, sesion, version) values ($1, $2, $3, 'v0.1')",
    [org, u.id, u.sesion]);
}

/** Catálogo mínimo de una organización: una sucursal central, una modalidad con
 *  un horario, un nivel y un profesor. Devuelve los ids. */
export async function crearCatalogoMinimo(db: PGlite, org: string) {
  const id = async (sql: string, p: unknown[]) => (await db.query<{ id: string }>(sql + " returning id", p)).rows[0].id;
  let sucursal = "";
  await db.transaction(async (tx) => {
    sucursal = (await tx.query<{ id: string }>(
      "insert into sucursal (organizacion_id, nombre, direccion, es_central) values ($1,'Central','Managua',true) returning id", [org])).rows[0].id;
  });
  const modalidad = await id("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Diario','Lunes a jueves')", [org]);
  const horario = await id("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'08:00','09:30')", [org, modalidad]);
  const nivel = await id("insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'INT-11','Intermediate I-I','Intermediate',1,'Adultos')", [org]);
  const profesor = await crearProfesor(db, org, "Carla", "Mena");
  return { sucursal, modalidad, horario, nivel, profesor };
}

/**
 * Fecha AAAA-MM-DD de hace `anios` años (y `dias` días más), contada desde hoy en
 * Managua. Se calcula sin consultar la base: PGlite tiene una sola conexión, y una
 * consulta hecha desde dentro de una transacción abierta se quedaría esperando.
 * El parámetro `_db` se conserva para no cambiar las llamadas.
 */
export async function haceAnios(_db: PGlite, anios: number, dias = 0): Promise<string> {
  const [a, m, d] = hoyEnManagua(new Date()).split("-").map(Number);
  // Restar años con el mismo criterio que PostgreSQL: el 29 de febrero pasa al 28.
  const ultimoDia = new Date(Date.UTC(a - anios, m, 0)).getUTCDate();
  const f = new Date(Date.UTC(a - anios, m - 1, Math.min(d, ultimoDia)));
  f.setUTCDate(f.getUTCDate() - dias);
  return f.toISOString().slice(0, 10);
}

/** Fecha AAAA-MM-DD de hoy en Managua más `n` días (la misma "hoy" que usa la
 *  base con hoy_managua()). No usar la fecha UTC: de 6 p. m. a medianoche en
 *  Nicaragua, UTC ya está en el día siguiente. */
export function diasDesdeHoy(n: number): string {
  const [a, m, d] = hoyEnManagua(new Date()).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Bloque 3 — 010_sesion_app.sql: el estado de acceso que guía la sesión en la app,
 * y lo único que el servidor puede tocar de una cuenta con la clave de servicio.
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, comoUsuario, comoServicio, crearUsuarioAuth, type UsuarioSimulado } from "../apoyo/banco";
import { crearOrganizacion, crearPersona, aceptarAviso, type Persona } from "../apoyo/escenario";

type Estado = { cuenta: boolean; activo?: boolean; debe_cambiar?: boolean; aviso_aceptado?: boolean;
  roles?: string[]; version_aviso?: string; nombre_usuario?: string; organizacion?: string };
let db: PGlite, A: string, B: string;

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ADEI"); B = await crearOrganizacion(db, "OTRA");
});

const estado = (p: UsuarioSimulado) =>
  comoUsuario(db, p, async (tx) => (await tx.query<{ e: Estado }>("select mi_estado_acceso() e")).rows[0].e);

describe("mi_estado_acceso()", () => {
  test("una sesión de Auth sin cuenta en SIGFIE: cuenta = false", async () => {
    expect(await estado(await crearUsuarioAuth(db))).toEqual({ cuenta: false });
  });

  test("CE-14 · recién ingresado: activo, sin aviso aceptado en esta sesión", async () => {
    const p = await crearPersona(db, A, ["asistente"], { aceptaAviso: false });
    expect(await estado(p)).toMatchObject({
      cuenta: true, activo: true, debe_cambiar: false, aviso_aceptado: false,
      roles: ["asistente"], version_aviso: "v0.1", nombre_usuario: p.nombreUsuario, organizacion: "Academia ADEI" });
  });

  test("CE-15 · el aviso aceptado en OTRA sesión no cuenta para esta", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    expect((await estado(p)).aviso_aceptado).toBe(true);
    expect((await estado({ ...p, sesion: crypto.randomUUID() })).aviso_aceptado).toBe(false);
  });

  test("CE-9 · con contraseña temporal pendiente lo indica", async () => {
    const p = await crearPersona(db, A, ["profesor"], { debeCambiar: true });
    expect(await estado(p)).toMatchObject({ debe_cambiar: true, roles: ["profesor"] });
  });

  test("CE-2 · lista todos los roles", async () => {
    const p = await crearPersona(db, A, ["direccion", "profesor"]);
    expect((await estado(p)).roles).toEqual(["direccion", "profesor"]);
  });

  test("CE-4 · una cuenta inactiva aparece como no activa", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    await db.query("update usuario set estado = 'inactivo' where id = $1", [p.id]);
    expect((await estado(p)).activo).toBe(false);
  });

  test("solo devuelve datos de la propia cuenta, nunca de otra organización", async () => {
    const pB: Persona = await crearPersona(db, B, ["asistente"]);
    await aceptarAviso(db, B, pB);
    expect(await estado(pB)).toMatchObject({ organizacion: "Academia OTRA" });
  });
});

describe("lo que el servidor puede hacer con la clave de servicio", () => {
  test("CE-9 · quitar la marca de contraseña temporal después del cambio", async () => {
    const p = await crearPersona(db, A, ["profesor"], { debeCambiar: true });
    await comoServicio(db, (tx) => tx.query(
      "update usuario set debe_cambiar_contrasena = false, contrasena_temporal_emitida = null where id = $1", [p.id]));
    expect((await estado(p)).debe_cambiar).toBe(false);
  });

  test("seguridad · no puede cambiar el estado, los roles ni el nombre de una cuenta", async () => {
    const p = await crearPersona(db, A, ["profesor"]);
    for (const sql of [
      "update usuario set estado = 'inactivo' where id = $1",
      "update usuario set nombre_usuario = 'otro_nombre' where id = $1",
      "insert into usuario_rol (organizacion_id, usuario_id, rol) select organizacion_id, id, 'asistente' from usuario where id = $1",
    ]) await expect(comoServicio(db, (tx) => tx.query(sql, [p.id]))).rejects.toThrow(/permission denied/);
  });
});

describe("crear_cuenta y asignar_roles (T20)", () => {
  const llamar = (p: Persona, sql: string, args: unknown[]) => comoUsuario(db, p, (tx) => tx.query(sql, args));
  const roles = async (id: string) => (await db.query<{ rol: string }>("select rol from usuario_rol where usuario_id = $1 order by rol", [id])).rows.map((r) => r.rol);

  test("CE-5 · crea la cuenta con sus roles, en minúsculas y con la contraseña temporal pendiente", async () => {
    const asis = await crearPersona(db, A, ["asistente"]);
    const u = await crearUsuarioAuth(db);
    await llamar(asis, "select crear_cuenta($1, $2, $3, null, $4)", [u.id, "  Doña.Aura ", "", "{direccion}"]);
    const fila = (await db.query<{ nombre_usuario: string; debe_cambiar_contrasena: boolean; correo: string | null }>(
      "select nombre_usuario, debe_cambiar_contrasena, correo from usuario where id = $1", [u.id])).rows[0];
    expect(fila).toEqual({ nombre_usuario: "doña.aura", debe_cambiar_contrasena: true, correo: null });
    expect(await roles(u.id)).toEqual(["direccion"]);
  });

  test("CE-6 · una cuenta de Profesor sin profesor del catálogo no se crea, y no queda nada a medias", async () => {
    const asis = await crearPersona(db, A, ["asistente"]);
    const u = await crearUsuarioAuth(db);
    await expect(llamar(asis, "select crear_cuenta($1, $2, null, null, $3)", [u.id, "profesor.x", "{profesor}"])).rejects.toThrow(/vinculada a un profesor/);
    expect((await db.query("select 1 from usuario where id = $1", [u.id])).rows).toHaveLength(0);
  });

  test("CE-5 · sin roles no se crea", async () => {
    const asis = await crearPersona(db, A, ["asistente"]);
    const u = await crearUsuarioAuth(db);
    await expect(llamar(asis, "select crear_cuenta($1, $2, null, null, $3)", [u.id, "sinrol", "{}"])).rejects.toThrow(/al menos un rol/);
  });

  test("CE-61 · Dirección no puede crear cuentas", async () => {
    const dir = await crearPersona(db, A, ["direccion"]);
    const u = await crearUsuarioAuth(db);
    await expect(llamar(dir, "select crear_cuenta($1, $2, null, null, $3)", [u.id, "intruso", "{asistente}"])).rejects.toThrow(/Solo la Asistente/);
  });

  test("asignar_roles cambia los roles en una sola operación", async () => {
    const asis = await crearPersona(db, A, ["asistente"]);
    const p = await crearPersona(db, A, ["direccion"]);
    await llamar(asis, "select asignar_roles($1, $2, null)", [p.id, "{direccion,asistente}"]);
    expect(await roles(p.id)).toEqual(["asistente", "direccion"]);
  });

  test("CE-13 · no se puede dejar a la organización sin Asistente activa", async () => {
    const otra = await crearOrganizacion(db, "SOLA");
    const unica = await crearPersona(db, otra, ["asistente"]);
    await expect(llamar(unica, "select asignar_roles($1, $2, null)", [unica.id, "{direccion}"])).rejects.toThrow(/sin ninguna cuenta activa de Asistente/);
  });
});

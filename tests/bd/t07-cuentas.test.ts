/** T7 — 003_cuentas.sql */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, crearUsuarioAuth } from "../apoyo/banco";
import { crearOrganizacion, crearPersona, crearProfesor } from "../apoyo/escenario";

let db: PGlite, A: string;
beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ACAA");
});

const nuevaCuenta = async (nombre: string, org = A) => {
  const u = await crearUsuarioAuth(db);
  await db.query("insert into usuario (id, organizacion_id, nombre_usuario) values ($1,$2,$3)", [u.id, org, nombre]);
  return u;
};

describe("nombre de usuario (CE-5, CE-69)", () => {
  test("CE-69 · se guarda en minúsculas: 'Aura' no se acepta tal cual", async () => {
    const u = await crearUsuarioAuth(db);
    await expect(db.query("insert into usuario (id, organizacion_id, nombre_usuario) values ($1,$2,'Aura')", [u.id, A]))
      .rejects.toThrow(/usuario_nombre_minusculas/);
  });

  test("CE-5, CE-69 · es único: 'aura' no puede existir dos veces", async () => {
    await nuevaCuenta("aura");
    await expect(nuevaCuenta("aura")).rejects.toThrow(/duplicate key/);
  });

  test.each(["abc", "a".repeat(31), "con espacio"])("CE-5 · rechaza %j (4 a 30 caracteres, sin espacios)", async (n) => {
    await expect(nuevaCuenta(n)).rejects.toThrow(/usuario_nombre_formato/);
  });

  test("CE-5 · acepta de 4 a 30 caracteres", async () => {
    await nuevaCuenta("abcd");
    await nuevaCuenta("b".repeat(30));
  });
});

describe("cuenta de profesor (CE-6)", () => {
  test("CE-6 · una cuenta con rol Profesor sin profesor vinculado se rechaza", async () => {
    const u = await crearUsuarioAuth(db);
    await expect(db.transaction(async (tx) => {
      await tx.query("insert into usuario (id, organizacion_id, nombre_usuario) values ($1,$2,'profsin')", [u.id, A]);
      await tx.query("insert into usuario_rol (organizacion_id, usuario_id, rol) values ($1,$2,'profesor')", [A, u.id]);
    })).rejects.toThrow(/vinculada a un profesor/);
  });

  test("CE-6 · un profesor no puede tener dos cuentas", async () => {
    const p = await crearProfesor(db, A, "Beto", "Ruiz");
    await crearPersona(db, A, ["profesor"], { profesorId: p });
    await expect(crearPersona(db, A, ["profesor"], { profesorId: p })).rejects.toThrow(/duplicate key/);
  });

  test("CE-97 · no se puede vincular a un profesor de otra organización", async () => {
    const B = await crearOrganizacion(db, "ACAB");
    const pB = await crearProfesor(db, B);
    await expect(crearPersona(db, A, ["profesor"], { profesorId: pB })).rejects.toThrow(/foreign key/);
  });
});

describe("la última Asistente (CE-13)", () => {
  test("CE-13 · no se puede desactivar a la única Asistente activa", async () => {
    const O = await crearOrganizacion(db, "SOLA");
    const asis = await crearPersona(db, O, ["asistente"]);
    await expect(db.query("update usuario set estado = 'inactivo' where id = $1", [asis.id]))
      .rejects.toThrow(/sin ninguna cuenta activa de Asistente/);
  });

  test("CE-13 · ni quitarle el rol", async () => {
    const O = await crearOrganizacion(db, "SOLB");
    const asis = await crearPersona(db, O, ["asistente", "direccion"]);
    await expect(db.query("delete from usuario_rol where usuario_id = $1 and rol = 'asistente'", [asis.id]))
      .rejects.toThrow(/sin ninguna cuenta activa de Asistente/);
  });

  test("CE-13 · con otra Asistente activa, sí se puede", async () => {
    const O = await crearOrganizacion(db, "DOSA");
    const a1 = await crearPersona(db, O, ["asistente"]);
    await crearPersona(db, O, ["asistente"]);
    await db.query("update usuario set estado = 'inactivo' where id = $1", [a1.id]);
  });

  test("CE-13 · quitar otros roles no se ve afectado", async () => {
    const O = await crearOrganizacion(db, "OTRA");
    const p = await crearPersona(db, O, ["direccion", "asistente"]);
    await db.query("delete from usuario_rol where usuario_id = $1 and rol = 'direccion'", [p.id]);
  });
});

describe("contraseña temporal (CE-9, CE-70)", () => {
  test("CE-9 · no puede marcarse 'debe cambiar' sin la hora en que se emitió", async () => {
    const u = await nuevaCuenta("temporal1");
    await expect(db.query("update usuario set debe_cambiar_contrasena = true where id = $1", [u.id]))
      .rejects.toThrow(/usuario_temporal_coherente/);
  });
});

describe("aviso de privacidad (CE-16)", () => {
  test("CE-16 · la aceptación guarda usuario, sesión, versión y hora", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    const r = await db.query<{ n: number }>(
      "select count(*)::int n from aceptacion_privacidad where usuario_id = $1 and sesion = $2 and version = 'v0.1' and fecha_hora is not null",
      [p.id, p.sesion]);
    expect(r.rows[0].n).toBe(1);
  });

  test("CE-16 · no se puede aceptar una versión que no existe", async () => {
    const p = await crearPersona(db, A, ["direccion"], { aceptaAviso: false });
    await expect(db.query(
      "insert into aceptacion_privacidad (organizacion_id, usuario_id, sesion, version) values ($1,$2,$3,'v9.9')",
      [A, p.id, p.sesion])).rejects.toThrow(/foreign key/);
  });

  test("CE-14 · el aviso vigente es el de vigencia más reciente ya iniciada", async () => {
    const O = await crearOrganizacion(db, "AVIS");
    await db.query("insert into aviso_privacidad (organizacion_id, version, texto, vigente_desde) values ($1,'v1.0',$2, now() - interval '1 hour')", [O, "x".repeat(60)]);
    await db.query("insert into aviso_privacidad (organizacion_id, version, texto, vigente_desde) values ($1,'v2.0',$2, now() + interval '1 day')", [O, "y".repeat(60)]);
    const r = await db.query<{ v: string }>("select public.aviso_vigente($1) v", [O]);
    expect(r.rows[0].v).toBe("v1.0");
  });
});

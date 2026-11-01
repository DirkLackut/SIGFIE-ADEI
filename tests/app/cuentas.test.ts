/** T20 — cuentas, con Supabase simulado. */
import { describe, test, expect, beforeEach } from "vitest";
import { crearCuentaCompleta, restablecerContrasena, cambiarEstadoCuenta, revisarNuevaCuenta, type DependenciasCuentas } from "@/servidor/cuentas";

let registro: string[];
let fallaCuenta: { mensaje: string; campo?: "nombre_usuario" } | null;
let fallaEstado = false;

const deps = (): DependenciasCuentas => ({
  generarTemporal: () => "Temporal1234",
  correoInterno: () => "u-x@sigfie.invalid",
  crearUsuarioAuth: async (c) => { registro.push(`auth:${c}`); return c === "usado@x.com" ? { error: "correo_usado" } : { id: "id1" }; },
  borrarUsuarioAuth: async (id) => { registro.push(`borrar:${id}`); },
  crearCuenta: async (id, c) => { registro.push(`cuenta:${c.nombre_usuario}:${c.roles.join("+")}:${c.profesor_id}`); return fallaCuenta ? { ok: false, ...fallaCuenta } : { ok: true }; },
  marcarTemporal: async (id) => { registro.push(`marca:${id}`); return { ok: true }; },
  cambiarClaveAuth: async (id, c) => { registro.push(`clave:${id}:${c}`); return true; },
  cambiarEstado: async (id, e) => { registro.push(`estado:${id}:${e}`); return fallaEstado ? { ok: false, mensaje: "La organización no puede quedarse sin ninguna cuenta activa de Asistente de Dirección." } : { ok: true }; },
  suspenderAuth: async (id, s) => { registro.push(`suspender:${id}:${s}`); return true; },
});
beforeEach(() => { registro = []; fallaCuenta = null; fallaEstado = false; });
const nueva = (c = {}) => ({ nombre_usuario: "Ana.Ruiz", correo: "", roles: ["direccion" as const], profesor_id: "", ...c });

describe("cuentas", () => {
  test("CE-5 · CE-6 · revisión: nombre de 4 a 30 sin espacios, un rol, y profesor si es Profesor", () => {
    expect(Object.keys(revisarNuevaCuenta({ nombre_usuario: "ab c", correo: "x", roles: [], profesor_id: "" })).sort())
      .toEqual(["correo", "nombre_usuario", "roles"]);
    expect(revisarNuevaCuenta(nueva({ roles: ["profesor"] })).profesor_id).toBeTruthy();
  });

  test("CE-5 · CE-8 · CE-69 · crea la cuenta y devuelve la temporal UNA vez; sin correo usa uno interno", async () => {
    expect(await crearCuentaCompleta(deps(), nueva())).toEqual({ ok: true, nombre_usuario: "ana.ruiz", temporal: "Temporal1234" });
    expect(registro).toEqual(["auth:u-x@sigfie.invalid", "cuenta:ana.ruiz:direccion:null"]);
  });

  test("si la cuenta no se puede guardar, se borra el usuario de Auth recién creado", async () => {
    fallaCuenta = { campo: "nombre_usuario", mensaje: "Ese nombre de usuario ya está en uso." };
    expect(await crearCuentaCompleta(deps(), nueva())).toEqual({ ok: false, errores: { nombre_usuario: "Ese nombre de usuario ya está en uso." } });
    expect(registro.at(-1)).toBe("borrar:id1");
  });

  test("un correo ya usado se indica en su campo y no se crea nada más", async () => {
    expect(await crearCuentaCompleta(deps(), nueva({ correo: "usado@x.com" }))).toMatchObject({ ok: false, errores: { correo: expect.any(String) } });
    expect(registro).toEqual(["auth:usado@x.com"]);
  });

  test("CE-8 · restablecer: primero la marca de temporal, después la contraseña", async () => {
    expect(await restablecerContrasena(deps(), "id9")).toEqual({ ok: true, temporal: "Temporal1234" });
    expect(registro).toEqual(["marca:id9", "clave:id9:Temporal1234"]);
  });

  test("CE-7 · desactivar: primero la base (corta el acceso), después Auth", async () => {
    expect(await cambiarEstadoCuenta(deps(), "id9", false)).toEqual({ ok: true });
    expect(registro).toEqual(["estado:id9:inactivo", "suspender:id9:true"]);
  });

  test("CE-13 · si la base lo rechaza (última Asistente), no se suspende en Auth", async () => {
    fallaEstado = true;
    expect(await cambiarEstadoCuenta(deps(), "id9", false)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/Asistente/) });
    expect(registro).toEqual(["estado:id9:inactivo"]);
  });
});

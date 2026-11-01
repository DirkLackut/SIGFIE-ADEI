/** T17 — ingreso, con Supabase simulado por funciones falsas. */
import { describe, test, expect, beforeEach } from "vitest";
import {
  ingresar, MENSAJE_GENERICO, MENSAJE_SERVICIO, MENSAJE_FALTAN,
  type DependenciasIngreso, type CuentaParaIngreso,
} from "@/servidor/ingreso";

const AHORA = new Date("2026-11-02T15:00:00Z");
let registro: string[];
let cuentas: Record<string, CuentaParaIngreso>;
let contrasenas: Record<string, string>;
let authCaido: boolean, auditoriaCaida: boolean;

function deps(): DependenciasIngreso {
  return {
    ahora: AHORA,
    buscarCuenta: async (n) => cuentas[n] ?? null,
    iniciarSesion: async (correo, c) => {
      if (authCaido) return "error";
      return contrasenas[correo] === c ? "ok" : "credenciales";
    },
    cerrarSesion: async () => { registro.push("cerrar"); },
    registrarDenegado: async (n, m) => { registro.push(`denegado:${n}:${m}`); },
    registrarAcceso: async () => { if (auditoriaCaida) throw new Error("x"); registro.push("acceso"); },
  };
}
const cuenta = (c: Partial<CuentaParaIngreso> = {}): CuentaParaIngreso => ({
  id: "u1", activa: true, debeCambiar: false, temporalEmitida: null, correoAuth: "u-1@sigfie.invalid", ...c });

beforeEach(() => {
  registro = []; authCaido = false; auditoriaCaida = false;
  cuentas = { aura: cuenta() };
  contrasenas = { "u-1@sigfie.invalid": "Correcta123" };
});

describe("ingresar", () => {
  test("CE-1 · CE-14 · credenciales correctas de una cuenta activa: entra y va al aviso", async () => {
    expect(await ingresar(deps(), { usuario: "aura", contrasena: "Correcta123" })).toEqual({ ok: true, destino: "/aviso" });
    expect(registro).toEqual(["acceso"]);
  });

  test("CE-69 · el nombre de usuario no distingue mayúsculas ni espacios al borde", async () => {
    expect((await ingresar(deps(), { usuario: "  AURA ", contrasena: "Correcta123" })).ok).toBe(true);
  });

  test("CE-3 · contraseña incorrecta y usuario inexistente dan el MISMO mensaje", async () => {
    const a = await ingresar(deps(), { usuario: "aura", contrasena: "mala" });
    const b = await ingresar(deps(), { usuario: "nadie", contrasena: "mala" });
    expect(a).toEqual({ ok: false, mensaje: MENSAJE_GENERICO });
    expect(b).toEqual(a);
  });

  test("CE-18 · cada negación queda registrada, con el motivo y nunca la contraseña", async () => {
    await ingresar(deps(), { usuario: "aura", contrasena: "mala" });
    await ingresar(deps(), { usuario: "nadie", contrasena: "secreta" });
    expect(registro).toEqual(["denegado:aura:contraseña incorrecta", "denegado:nadie:usuario inexistente"]);
    expect(registro.join()).not.toMatch(/mala|secreta/);
  });

  test("CE-4 · una cuenta inactiva no entra aunque la contraseña sea correcta, y no se consulta Auth", async () => {
    cuentas.aura = cuenta({ activa: false });
    authCaido = true; // si se llamara a Auth, daría otro mensaje
    expect(await ingresar(deps(), { usuario: "aura", contrasena: "Correcta123" })).toEqual({ ok: false, mensaje: MENSAJE_GENERICO });
    expect(registro).toEqual(["denegado:aura:cuenta inactiva"]);
  });

  test("CE-9 · con contraseña temporal vigente entra, pero va a cambiarla", async () => {
    cuentas.aura = cuenta({ debeCambiar: true, temporalEmitida: new Date("2026-11-01T15:00:00Z") });
    expect(await ingresar(deps(), { usuario: "aura", contrasena: "Correcta123" })).toEqual({ ok: true, destino: "/cambiar-contrasena" });
  });

  test("CE-70 · una contraseña temporal de más de 72 h ya no sirve", async () => {
    cuentas.aura = cuenta({ debeCambiar: true, temporalEmitida: new Date("2026-10-30T14:59:59Z") });
    expect(await ingresar(deps(), { usuario: "aura", contrasena: "Correcta123" })).toEqual({ ok: false, mensaje: MENSAJE_GENERICO });
    expect(registro).toEqual(["denegado:aura:contraseña temporal vencida"]);
  });

  test("campos vacíos: se pide completarlos, sin registrar nada", async () => {
    expect(await ingresar(deps(), { usuario: " ", contrasena: "x" })).toEqual({ ok: false, mensaje: MENSAJE_FALTAN });
    expect(registro).toEqual([]);
  });

  test("si Auth no responde, se dice eso y no se culpa a la persona", async () => {
    authCaido = true;
    expect(await ingresar(deps(), { usuario: "aura", contrasena: "Correcta123" })).toEqual({ ok: false, mensaje: MENSAJE_SERVICIO });
  });

  test("CE-20 · si el ingreso no se puede registrar, se cierra la sesión y no se concede", async () => {
    auditoriaCaida = true;
    expect(await ingresar(deps(), { usuario: "aura", contrasena: "Correcta123" })).toEqual({ ok: false, mensaje: MENSAJE_SERVICIO });
    expect(registro).toEqual(["cerrar"]);
  });
});

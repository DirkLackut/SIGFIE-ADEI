import { describe, test, expect } from "vitest";
import {
  generarContrasenaTemporal, ALFABETO_TEMPORAL, LARGO_TEMPORAL,
  vencimientoTemporal, temporalVencida, HORAS_VIGENCIA_TEMPORAL, validarContrasenaNueva,
} from "@/dominio/contrasena";

describe("contraseña temporal (CE-8)", () => {
  test("CE-8, CE-5 · tiene 12 caracteres, más que el mínimo de 8", () => {
    expect(LARGO_TEMPORAL).toBe(12);
    expect(generarContrasenaTemporal()).toHaveLength(12);
  });

  test("CE-8 · no usa caracteres que se confunden al dictarla o copiarla: 0 O o, 1 l I", () => {
    for (const c of "0Oo1lI") expect(ALFABETO_TEMPORAL).not.toContain(c);
  });

  test("CE-8 · solo usa caracteres del alfabeto", () => {
    for (let i = 0; i < 200; i++) {
      for (const c of generarContrasenaTemporal()) expect(ALFABETO_TEMPORAL).toContain(c);
    }
  });

  test("CE-8 · no se repite: 5,000 contraseñas, todas distintas", () => {
    const vistas = new Set(Array.from({ length: 5000 }, () => generarContrasenaTemporal()));
    expect(vistas.size).toBe(5000);
  });

  test("CE-8 · usa la fuente de azar que recibe (así se puede probar sin azar)", () => {
    const ceros = (b: Uint8Array) => b.fill(0);
    expect(generarContrasenaTemporal(ceros)).toBe(ALFABETO_TEMPORAL[0].repeat(12));
  });

  test("CE-8 · no tiene sesgo de módulo: cada carácter sale con la misma frecuencia", () => {
    // Con 56 símbolos y bytes de 0 a 255, tomar byte % 56 favorecería a los
    // primeros 32 símbolos. Se cuentan 100,000 caracteres.
    const n = 100_000 / LARGO_TEMPORAL;
    const cuenta = new Map<string, number>();
    for (let i = 0; i < n; i++) for (const c of generarContrasenaTemporal()) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    const esperado = (n * LARGO_TEMPORAL) / ALFABETO_TEMPORAL.length;
    const primeros = [...ALFABETO_TEMPORAL.slice(0, 10)].map((c) => cuenta.get(c) ?? 0);
    const ultimos = [...ALFABETO_TEMPORAL.slice(-10)].map((c) => cuenta.get(c) ?? 0);
    const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Con sesgo, los primeros saldrían ~1.25 veces más que los últimos.
    expect(prom(primeros) / prom(ultimos)).toBeLessThan(1.08);
    expect(Math.abs(prom(primeros) - esperado) / esperado).toBeLessThan(0.08);
  });
});

describe("vencimiento de la contraseña temporal (CE-70)", () => {
  const emitida = new Date("2026-10-30T14:00:00Z");

  test("CE-70 · vence a las 72 horas", () => {
    expect(HORAS_VIGENCIA_TEMPORAL).toBe(72);
    expect(vencimientoTemporal(emitida).toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  test("CE-70 · un milisegundo antes de las 72 horas todavía sirve", () => {
    expect(temporalVencida(emitida, new Date("2026-11-02T13:59:59.999Z"))).toBe(false);
  });

  test("CE-70 · a las 72 horas exactas ya no sirve", () => {
    expect(temporalVencida(emitida, new Date("2026-11-02T14:00:00.000Z"))).toBe(true);
  });

  test("CE-70 · recién emitida, sirve", () => {
    expect(temporalVencida(emitida, emitida)).toBe(false);
  });
});

describe("validarContrasenaNueva (CE-5, CE-9)", () => {
  test("CE-5 · menos de 8 caracteres no sirve, ni 8 espacios", () => {
    expect(validarContrasenaNueva("Abc1234", "Abc1234").nueva).toMatch(/8/);
    expect(validarContrasenaNueva("        ", "        ").nueva).toMatch(/8/);
  });
  test("la confirmación debe coincidir", () => {
    expect(validarContrasenaNueva("Bosque2026", "bosque2026")).toEqual({ confirmacion: "No coincide con la contraseña nueva." });
  });
  test("CE-12 · más de 72 bytes se rechaza (límite de bcrypt), contando tildes como dos", () => {
    expect(validarContrasenaNueva("á".repeat(37), "á".repeat(37)).nueva).toMatch(/72/);
    expect(validarContrasenaNueva("a".repeat(72), "a".repeat(72))).toEqual({});
  });
  test("una contraseña válida no tiene errores", () => {
    expect(validarContrasenaNueva("Tamarindo 2026", "Tamarindo 2026")).toEqual({});
  });
});

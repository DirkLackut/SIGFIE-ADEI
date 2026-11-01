import { describe, test, expect } from "vitest";
import { codigoEstudiante, codigoGrupo } from "@/dominio/codigos";

describe("códigos correlativos", () => {
  test("CE-29, CE-99 · estudiante: prefijo de la organización, año y 5 dígitos", () => {
    expect(codigoEstudiante("ADEI", 2026, 1)).toBe("ADEI-2026-00001");
    expect(codigoEstudiante("ADEI", 2026, 12345)).toBe("ADEI-2026-12345");
  });

  test("CE-48, CE-99 · grupo: G, año y 4 dígitos, sin prefijo de organización", () => {
    expect(codigoGrupo(2026, 1)).toBe("G-2026-0001");
    expect(codigoGrupo(2026, 9999)).toBe("G-2026-9999");
  });

  test("CE-29, CE-48 · un correlativo que no cabe en el formato es un error, no un código ambiguo", () => {
    expect(() => codigoEstudiante("ADEI", 2026, 100000)).toThrow(/no cabe/);
    expect(() => codigoGrupo(2026, 10000)).toThrow(/no cabe/);
    expect(() => codigoGrupo(2026, 0)).toThrow(/no cabe/);
  });

  test("CE-99 · el prefijo de la organización es de letras mayúsculas", () => {
    expect(() => codigoEstudiante("adei", 2026, 1)).toThrow(/prefijo/);
    expect(() => codigoEstudiante("AD-EI", 2026, 1)).toThrow(/prefijo/);
  });
});

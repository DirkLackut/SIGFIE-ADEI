import { describe, test, expect } from "vitest";
import { normalizar, validarNombre } from "@/dominio/texto";

describe("normalizar — comparar sin mayúsculas, tildes ni espacios sobrantes", () => {
  test.each([
    ["Gutiérrez", "gutierrez"],
    ["  GUTIÉRREZ  ", "gutierrez"],
    ["Muñoz", "munoz"],
    ["Agüero", "aguero"],
    ["Intermediate   I-I", "intermediate i-i"],
    ["María\tJosé", "maria jose"],
  ])("CE-22, CE-42 · %j → %j", (entrada, esperado) => {
    expect(normalizar(entrada)).toBe(esperado);
  });

  // Valores esperados tomados de lower(unaccent(...)) en PostgreSQL. Si la base y
  // la app normalizaran distinto, la búsqueda daría resultados distintos según
  // dónde se compare.
  test.each([
    ["Øster", "oster"], ["Straße", "strasse"], ["Æsir", "aesir"],
    ["Łukasz", "lukasz"], ["Đorđe", "dorde"], ["Nguyễn", "nguyen"], ["Çelik", "celik"],
  ])("CE-42 · igual que unaccent de PostgreSQL: %j → %j", (entrada, esperado) => {
    expect(normalizar(entrada)).toBe(esperado);
  });

  test("CE-22 · dos escrituras del mismo nivel dan el mismo resultado", () => {
    expect(normalizar("Intermediate I")).toBe(normalizar("  intermediate i "));
  });
});

describe("validarNombre — 2 a 60 letras, espacios, tildes y apóstrofos (CE-37)", () => {
  test.each(["Ana", "José María", "Gutiérrez Muñoz", "D'Arbelles", "Ñ".repeat(2)])(
    "CE-37 · acepta %j",
    (n) => expect(validarNombre(n)).toEqual({ ok: true, valor: n.trim().replace(/\s+/g, " ") }),
  );

  test.each([
    ["", "Debe tener entre 2 y 60 caracteres."],
    ["A", "Debe tener entre 2 y 60 caracteres."],
    ["A".repeat(61), "Debe tener entre 2 y 60 caracteres."],
    ["Ana2", "Solo puede contener letras, espacios, tildes y apóstrofos."],
    ["Ana_Luz", "Solo puede contener letras, espacios, tildes y apóstrofos."],
  ])("CE-37 · rechaza %j e indica la regla", (n, regla) => {
    expect(validarNombre(n)).toEqual({ ok: false, regla });
  });

  test("CE-37 · los espacios sobrantes no cuentan como caracteres", () => {
    expect(validarNombre("   A   ")).toEqual({ ok: false, regla: "Debe tener entre 2 y 60 caracteres." });
  });
});

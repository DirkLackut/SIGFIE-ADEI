import { describe, test, expect } from "vitest";
import { validarCedula, cedulaParaBuscar } from "@/dominio/cedula";

describe("validarCedula — formato ###-######-####L (diccionario de datos)", () => {
  test("CE-37 · acepta una cédula bien formada", () => {
    expect(validarCedula("001-150390-0012K")).toEqual({ ok: true, valor: "001-150390-0012K" });
  });

  test("CE-76 · acepta la letra en minúscula y la guarda en mayúscula", () => {
    expect(validarCedula("001-150390-0012k")).toEqual({ ok: true, valor: "001-150390-0012K" });
  });

  test("CE-37 · tolera espacios al inicio y al final", () => {
    expect(validarCedula("  001-150390-0012K ")).toEqual({ ok: true, valor: "001-150390-0012K" });
  });

  test.each([
    "0011503900012K",      // sin guiones
    "001-150390-0012",     // sin letra
    "01-150390-0012K",     // grupo inicial corto
    "001-15039-0012K",     // fecha corta
    "001-150390-00123K",   // consecutivo largo
    "001-150390-0012KK",   // dos letras
    "001-150390-00121",    // número en lugar de letra
    "",
  ])("CE-37 · rechaza %j e indica la regla", (c) => {
    expect(validarCedula(c)).toEqual({
      ok: false,
      regla: "Debe tener el formato 000-000000-0000A: tres grupos de dígitos separados por guiones y una letra final.",
    });
  });
});

describe("cedulaParaBuscar — buscar con o sin guiones (CE-42)", () => {
  test.each([
    ["001-150390-0012K", "0011503900012k"],
    ["0011503900012K", "0011503900012k"],
    ["001-150390", "001150390"],
  ])("CE-42 · %j → %j", (entrada, esperado) => {
    expect(cedulaParaBuscar(entrada)).toBe(esperado);
  });
});

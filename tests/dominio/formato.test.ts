import { describe, test, expect } from "vitest";
import { fecha, hora, esUuid, cantidad, telefono, esCodigoAdei } from "@/dominio/formato";

describe("formatos", () => {
  test("fecha dd/mm/aaaa", () => { expect(fecha("2026-11-02")).toBe("02/11/2026"); expect(fecha(null)).toBe("—"); });
  test("hora como en la academia", () => {
    expect(hora("07:30:00")).toBe("7:30 a. m.");
    expect(hora("13:30")).toBe("1:30 p. m.");
    expect(hora("12:00")).toBe("12:00 p. m.");
  });
  test("solo un UUID válido pasa (un id mal escrito da 404, no un error del servidor)", () => {
    expect(esUuid("abc123")).toBe(false);
    expect(esUuid("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")).toBe(true);
  });
  test("CE-44 · el cero se dice explícitamente", () => {
    expect(cantidad(0, "resultado", "resultados")).toBe("0 resultados");
    expect(cantidad(1, "resultado", "resultados")).toBe("1 resultado");
  });
});

describe("telefono y código ADEI (presentación)", () => {
  test("separa los 8 dígitos en dos grupos de 4", () => {
    expect(telefono("88123456")).toBe("8812 3456");
    expect(telefono(null)).toBeNull();
    expect(telefono("2270-1234 ext. 5")).toBe("2270-1234 ext. 5");
  });
  test("solo acepta el formato exacto del código ADEI en la URL", () => {
    expect(esCodigoAdei("ADEI-2026-00012")).toBe(true);
    expect(esCodigoAdei("adei-2026-00012")).toBe(false);
    expect(esCodigoAdei("ADEI-2026-00012' or 1=1")).toBe(false);
    expect(esCodigoAdei(undefined)).toBe(false);
  });
});

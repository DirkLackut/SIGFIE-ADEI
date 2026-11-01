import { describe, test, expect } from "vitest";
import { hoyEnManagua, calcularEdad, esMenorDeEdad, validarFechaNacimiento, edadMientrasSeEscribe } from "@/dominio/edad";

describe("hoyEnManagua — la fecha del día es la de Nicaragua (CE-77)", () => {
  test("CE-77 · a las 21:30 en Managua sigue siendo el mismo día, aunque en UTC ya sea mañana", () => {
    // 2026-10-30 03:30 UTC = 2026-10-29 21:30 en Managua (UTC−6)
    expect(hoyEnManagua(new Date("2026-10-30T03:30:00Z"))).toBe("2026-10-29");
  });

  test("CE-77 · a las 06:00 UTC ya es el día siguiente en Managua", () => {
    expect(hoyEnManagua(new Date("2026-10-30T06:00:00Z"))).toBe("2026-10-30");
  });

  test("CE-77 · Nicaragua no tiene horario de verano: abril también es UTC−6", () => {
    expect(hoyEnManagua(new Date("2026-04-15T05:59:00Z"))).toBe("2026-04-14");
  });
});

describe("calcularEdad — años cumplidos a una fecha dada", () => {
  test.each([
    ["2010-10-29", "2026-10-29", 16], // cumple hoy
    ["2010-10-30", "2026-10-29", 15], // cumple mañana
    ["2010-10-28", "2026-10-29", 16],
    ["2008-02-29", "2026-02-28", 17], // nacido un 29 de febrero, año no bisiesto
    ["2008-02-29", "2026-03-01", 18],
    ["2008-02-29", "2028-02-29", 20], // año bisiesto
  ])("nacido el %s, el %s tiene %i años", (nac, hoy, edad) => {
    expect(calcularEdad(nac, hoy)).toBe(edad);
  });
});

describe("esMenorDeEdad (CE-33, CE-34, CE-35)", () => {
  test("CE-33 · con 17 años es menor", () => expect(esMenorDeEdad("2009-10-30", "2026-10-29")).toBe(true));
  test("CE-33 · el día que cumple 18 ya es mayor (casos límite de la spec)", () =>
    expect(esMenorDeEdad("2008-10-29", "2026-10-29")).toBe(false));
});

describe("validarFechaNacimiento (CE-36)", () => {
  const hoy = "2026-10-29";
  test.each([
    ["2022-10-29", "4 años exactos"],
    ["1927-10-29", "99 años exactos"],
    ["1926-10-30", "99 años, cumple 100 mañana"],
    ["2000-01-01", "un adulto común"],
  ])("CE-36 · acepta %s (%s)", (f) => {
    expect(validarFechaNacimiento(f, hoy)).toEqual({ ok: true, valor: f });
  });

  test.each([
    ["2026-10-30", "La fecha de nacimiento no puede ser posterior a hoy."],
    ["2022-10-30", "La edad debe estar entre 4 y 99 años."],   // 3 años
    ["1926-10-29", "La edad debe estar entre 4 y 99 años."],   // 100 años
    ["2026-02-30", "La fecha no existe."],
    ["29/10/2000", "La fecha no existe."],
  ])("CE-36 · rechaza %s", (f, regla) => {
    expect(validarFechaNacimiento(f, hoy)).toEqual({ ok: false, regla });
  });
});

describe("edad mientras se escribe la fecha (error de la prueba manual 7)", () => {
  const hoy = "2026-11-01";
  test("los años de 1 a 99 no se confunden con 1901–1999", () => {
    expect(validarFechaNacimiento("0002-05-20", hoy)).toMatchObject({ ok: false });
    expect(validarFechaNacimiento("0002-05-20", hoy)).toMatchObject({ regla: "La edad debe estar entre 4 y 99 años." });
  });
  test("lo que pasa por el campo mientras se teclea el año nunca rompe la pantalla", () => {
    for (const f of ["0002-05-20", "0020-05-20", "0201-05-20", "2014-05-20", "", "2014-02-30", "9999-01-01"]) {
      expect(() => edadMientrasSeEscribe(f, hoy)).not.toThrow();
    }
    expect(edadMientrasSeEscribe("0002-05-20", hoy)).toBeNull();
    expect(edadMientrasSeEscribe("0201-05-20", hoy)).toBeNull();
    expect(edadMientrasSeEscribe("2014-05-20", hoy)).toBe(12);
    expect(edadMientrasSeEscribe("2030-01-01", hoy)).toBeNull();
  });
});

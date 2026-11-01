import { describe, expect, it } from "vitest";
import { limitesFechasGrupo, validarFechasGrupo } from "@/dominio/fechas-grupo";
import { esFechaReal, sumarAnios } from "@/dominio/edad";

const HOY = "2026-11-01";

describe("esFechaReal y sumarAnios", () => {
  it("rechaza años de más de cuatro cifras, como los que deja teclear el navegador", () => {
    expect(esFechaReal("602026-11-07")).toBe(false);
    expect(esFechaReal("275760-11-07")).toBe(false);
    expect(esFechaReal("2026-11-07")).toBe(true);
    expect(esFechaReal("2026-02-30")).toBe(false);
  });
  it("suma y resta años; el 29 de febrero pasa al 28 en año no bisiesto", () => {
    expect(sumarAnios("2026-11-01", 1)).toBe("2027-11-01");
    expect(sumarAnios("2026-11-01", -1)).toBe("2025-11-01");
    expect(sumarAnios("2028-02-29", 1)).toBe("2029-02-28");
    expect(sumarAnios("2028-02-29", 4)).toBe("2032-02-29");
  });
});

describe("validarFechasGrupo (CE-50, CE-50a, CE-91, CE-92)", () => {
  it("acepta el grupo sabatino de la prueba 12", () => {
    expect(validarFechasGrupo("2026-11-07", "2026-12-05", HOY)).toEqual({});
  });
  it("CE-91: acepta un inicio anterior a hoy", () => {
    expect(validarFechasGrupo("2026-10-03", "2026-11-28", HOY)).toEqual({});
  });
  it("CE-50a: rechaza años de seis cifras en cualquiera de las dos fechas", () => {
    expect(validarFechasGrupo("602026-11-07", "2026-12-05", HOY).fecha_inicio).toMatch(/cuatro cifras/);
    expect(validarFechasGrupo("2026-11-07", "112026-12-05", HOY).fecha_termino).toMatch(/cuatro cifras/);
  });
  it("CE-50a: rechaza fechas a más de un año de hoy, en el pasado o en el futuro", () => {
    expect(validarFechasGrupo("2025-10-31", "2026-12-05", HOY).fecha_inicio).toMatch(/hace más de un año/);
    expect(validarFechasGrupo("2027-11-02", "2027-12-05", HOY).fecha_inicio).toMatch(/dentro de más de un año/);
    expect(validarFechasGrupo("2025-11-01", "2026-11-01", HOY)).toEqual({});
  });
  it("CE-50a: el término no puede quedar a más de un año del inicio", () => {
    expect(validarFechasGrupo("2026-11-07", "2027-11-08", HOY).fecha_termino).toMatch(/después del inicio/);
    expect(validarFechasGrupo("2026-11-07", "2027-11-07", HOY)).toEqual({});
  });
  it("CE-50: el término debe ser posterior al inicio", () => {
    expect(validarFechasGrupo("2026-12-05", "2026-12-05", HOY).fecha_termino).toMatch(/posterior/);
  });
  it("CE-92: rechaza un término que ya pasó", () => {
    expect(validarFechasGrupo("2026-09-05", "2026-10-31", HOY).fecha_termino).toMatch(/ya pasó/);
  });
  it("da al navegador límites con años de cuatro cifras", () => {
    expect(limitesFechasGrupo(HOY)).toEqual({
      inicio: { min: "2025-11-01", max: "2027-11-01" }, termino: { min: "2026-11-01", max: "2028-11-01" },
    });
  });
});

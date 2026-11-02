import { describe, test, expect } from "vitest";
import { revisarRegla } from "@/dominio/regla";

const base = { programa: "Curso principal", nivel_desde: "6", nivel_hasta: "11", vigente_desde: "2023-01-01",
  nota_minima: "80", condicionado_desde: "77", provisional: "" };

describe("formulario de la regla de aprobación (002·CE-24 a CE-26)", () => {
  test("CE-24 · una regla completa: la nota que exige el Condicionado es la mínima", () => {
    expect(revisarRegla(base)).toEqual({ errores: {}, datos: { programa: "Curso principal", nivel_desde: 6, nivel_hasta: 11,
      vigente_desde: "2023-01-01", nota_minima: 80, condicionado_desde: 77, nota_condicion: 80, provisional: false } });
  });

  test("sin franja: el Condicionado no aplica", () => {
    expect(revisarRegla({ ...base, condicionado_desde: "" }).datos).toMatchObject({ condicionado_desde: null, nota_condicion: null });
  });

  test("provisional marcado", () => {
    expect(revisarRegla({ ...base, provisional: "on" }).datos.provisional).toBe(true);
  });

  test("CE-24 · rechaza rangos al revés, notas fuera de 0–100 y una franja que no queda bajo la mínima", () => {
    const r = revisarRegla({ ...base, nivel_desde: "9", nivel_hasta: "3", nota_minima: "120", condicionado_desde: "85.5" });
    expect(Object.keys(r.errores).sort()).toEqual(["condicionado_desde", "nivel_hasta", "nota_minima"]);
    expect(revisarRegla({ ...base, condicionado_desde: "80" }).errores.condicionado_desde).toMatch(/menor que la nota mínima/);
  });

  test("programa del catálogo y fecha válida", () => {
    const r = revisarRegla({ ...base, programa: "Otro", vigente_desde: "2023-02-30" });
    expect(Object.keys(r.errores).sort()).toEqual(["programa", "vigente_desde"]);
  });
});

import { describe, test, expect } from "vitest";
import { paginarActa, celdaParcial, celdaFinal, FILAS_POR_HOJA, type FilaImpresa } from "@/dominio/acta-impresa";

const fila = (n: number, cambios: Partial<FilaImpresa> = {}): FilaImpresa => ({
  nombres: `Nombre${n}`, apellidos: `Apellido${n}`, estado_inscripcion: "En curso", estado: "Aprobado", nota_final: 85,
  condicionado: false, provisional: false, parciales: [{ numero: 1, condicion: "Registrado", valor: 85 }, { numero: 2, condicion: "Registrado", valor: 85 },
    { numero: 3, condicion: "Registrado", valor: 85 }], ...cambios });

describe("hoja de registro de notas (CE-51 a CE-53, docs/formatos)", () => {
  test("CE-51 · 20 filas por hoja, completadas en blanco como el formato impreso", () => {
    const hojas = paginarActa([fila(1), fila(2)]);
    expect(FILAS_POR_HOJA).toBe(20);
    expect(hojas).toHaveLength(1);
    expect(hojas[0]).toHaveLength(20);
    expect(hojas[0].map((f) => f.numero)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(hojas[0][2].fila).toBeNull();
  });

  test("CE-51 · un grupo de 23 sigue en otra hoja, con la numeración continua", () => {
    const hojas = paginarActa(Array.from({ length: 23 }, (_, i) => fila(i)));
    expect(hojas).toHaveLength(2);
    expect(hojas[1][0].numero).toBe(21);
    expect(hojas[1][2].fila).not.toBeNull();
    expect(hojas[1][3].fila).toBeNull();
  });

  test("un grupo sin inscritos imprime una hoja en blanco", () => {
    expect(paginarActa([])).toHaveLength(1);
  });

  test("CE-53 · la condición que no es Registrado se escribe en lugar de dejar la celda vacía", () => {
    expect(celdaParcial({ numero: 1, condicion: "Registrado", valor: 85 })).toBe("85");
    expect(celdaParcial({ numero: 1, condicion: "No presentado", valor: null })).toBe("NP");
    expect(celdaParcial({ numero: 1, condicion: "Justificado", valor: null })).toBe("J");
    expect(celdaParcial({ numero: 1, condicion: "Reprogramado", valor: 84 })).toBe("84 R");
    expect(celdaParcial(undefined)).toBe("");
  });

  test("CE-53 · Retirada y Trasladada se escriben en la fila; CE-17 · la final es la redondeada", () => {
    expect(celdaFinal(fila(1, { estado_inscripcion: "Retirada", estado: null, nota_final: null }))).toEqual({ texto: "Retirado", reprobada: false });
    expect(celdaFinal(fila(1, { estado_inscripcion: "Trasladada", estado: null, nota_final: null }))).toEqual({ texto: "Trasladado", reprobada: false });
    expect(celdaFinal(fila(1))).toEqual({ texto: "85", reprobada: false });
  });

  test("principio 9 · solo la nota final reprobada va en rojo; el Condicionado se marca con C", () => {
    expect(celdaFinal(fila(1, { estado: "Reprobado", nota_final: 70 }))).toEqual({ texto: "70", reprobada: true });
    expect(celdaFinal(fila(1, { estado: "Condicionado", nota_final: 78, condicionado: true }))).toEqual({ texto: "78 C", reprobada: false });
    expect(celdaFinal(fila(1, { estado: "Pendiente", nota_final: 85, provisional: true }))).toEqual({ texto: "", reprobada: false });
    // CE-23: sin regla el estado queda Pendiente, pero la nota final es conocida y se imprime.
    expect(celdaFinal(fila(1, { estado: "Pendiente", nota_final: 90 }))).toEqual({ texto: "90", reprobada: false });
  });
});

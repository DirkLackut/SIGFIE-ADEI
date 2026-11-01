import { describe, test, expect } from "vitest";
import { seSuperponen, type Cursada } from "@/dominio/superposicion";

const base: Cursada = {
  modalidadId: "diario", fechaInicio: "2026-11-02", fechaTermino: "2026-11-27",
  horaInicio: "08:00", horaFin: "10:00",
};
const con = (cambios: Partial<Cursada>): Cursada => ({ ...base, ...cambios });

describe("¿se cruzan dos inscripciones? (CE-84)", () => {
  test("CE-84 · mismo horario y mismas fechas: se cruzan", () => {
    expect(seSuperponen(base, base)).toBe(true);
  });

  test("CE-84 · horas que se pisan en parte: se cruzan", () => {
    expect(seSuperponen(base, con({ horaInicio: "09:00", horaFin: "11:00" }))).toBe(true);
  });

  test("CE-84 · una clase termina a las 10:00 y la otra empieza a las 10:00: no se cruzan", () => {
    expect(seSuperponen(base, con({ horaInicio: "10:00", horaFin: "12:00" }))).toBe(false);
  });

  test("CE-84 · un nivel termina el 27 y el otro empieza el 27: se cruzan (comparten ese día)", () => {
    expect(seSuperponen(base, con({ fechaInicio: "2026-11-27", fechaTermino: "2026-12-24" }))).toBe(true);
  });

  test("CE-84 · un nivel termina el 27 y el otro empieza el 28: no se cruzan", () => {
    expect(seSuperponen(base, con({ fechaInicio: "2026-11-28", fechaTermino: "2026-12-24" }))).toBe(false);
  });

  test("CE-84 · otra modalidad se da otros días: no se cruzan aunque coincidan hora y fechas", () => {
    expect(seSuperponen(base, con({ modalidadId: "sabatino" }))).toBe(false);
  });

  test("CE-84 · el orden de las dos inscripciones no importa", () => {
    const otra = con({ horaInicio: "09:30", horaFin: "11:30" });
    expect(seSuperponen(base, otra)).toBe(seSuperponen(otra, base));
  });
});

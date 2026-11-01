import { describe, test, expect } from "vitest";
import { revisarEstudiante, type EntradaEstudiante } from "@/dominio/formulario-estudiante";

const HOY = "2026-11-02";
const base = (c: Partial<EntradaEstudiante> = {}): EntradaEstudiante => ({
  cedula: "", nombres: "Ana", apellidos: "Ruiz", fecha_nacimiento: "1996-05-10", telefono: "8888 7777", correo: "",
  direccion: "", contacto_emergencia: "", sucursal_id: "s1", tutor_cedula: "", tutor_nombre: "", tutor_telefono: "", ...c });

describe("revisarEstudiante", () => {
  test("un adulto completo no tiene errores y el teléfono se limpia", () => {
    const r = revisarEstudiante(base(), HOY);
    expect(r.errores).toEqual({});
    expect(r.datos.telefono).toBe("88887777");
  });
  test("CE-35 · un adulto sin teléfono", () => {
    expect(revisarEstudiante(base({ telefono: "" }), HOY).errores.telefono).toMatch(/mayores de 18/);
  });
  test("CE-80 · al editar, un adulto sin teléfono no bloquea (se advierte en pantalla)", () => {
    expect(revisarEstudiante(base({ telefono: "" }), HOY, { edicion: true }).errores).toEqual({});
  });
  test("CE-33 · CE-34 · un menor sin tutor ni contacto de emergencia", () => {
    const r = revisarEstudiante(base({ fecha_nacimiento: "2014-03-01", telefono: "" }), HOY);
    expect(r.menor).toBe(true);
    expect(Object.keys(r.errores).sort()).toEqual(["contacto_emergencia", "tutor_cedula", "tutor_nombre", "tutor_telefono"]);
  });
  test("CE-33 · un menor con tutor queda listo para enviar", () => {
    const r = revisarEstudiante(base({ fecha_nacimiento: "2014-03-01", telefono: "", contacto_emergencia: "Madre 88880000",
      tutor_cedula: "001-150190-0012k", tutor_nombre: "Elena Ruiz", tutor_telefono: "8888-1111" }), HOY);
    expect(r.errores).toEqual({});
    expect(r.datos.tutores).toEqual([{ cedula: "001-150190-0012K", nombre_completo: "Elena Ruiz", telefono: "88881111" }]);
  });
  test("caso límite · el día que cumple 18 ya es mayor de edad", () => {
    expect(revisarEstudiante(base({ fecha_nacimiento: "2008-11-02" }), HOY).menor).toBe(false);
  });
  test("CE-36 · CE-37 · formatos inválidos, cada uno en su campo", () => {
    const r = revisarEstudiante(base({ cedula: "0011501900012K", nombres: "Ana2", correo: "ana@", fecha_nacimiento: "2030-01-01" }), HOY);
    expect(Object.keys(r.errores).sort()).toEqual(["cedula", "correo", "fecha_nacimiento", "nombres"]);
  });
  test("CE-39 · el formulario no tiene estado civil ni salud", () => {
    expect(Object.keys(base())).not.toEqual(expect.arrayContaining(["estado_civil", "salud"]));
  });
});

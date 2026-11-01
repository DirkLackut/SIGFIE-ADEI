import { describe, test, expect } from "vitest";
import { traducirError } from "@/datos/errores";

describe("traducirError (CE-37)", () => {
  test("una regla con nombre indica el campo y la regla", () => {
    expect(traducirError({ code: "23514", message: 'new row for relation "estudiante" violates check constraint "estudiante_cedula_formato"' }))
      .toEqual({ campo: "cedula", mensaje: "Debe tener el formato 000-000000-0000A." });
  });
  test("una regla sin nombre propio se reconoce por su columna", () => {
    expect(traducirError({ code: "23514", message: 'violates check constraint "profesor_telefono_check"' }).campo).toBe("telefono");
  });
  test("los índices únicos de catálogo dicen qué ya existe (CE-22)", () => {
    expect(traducirError({ code: "23505", message: 'duplicate key value violates unique constraint "nivel_codigo_unico"' }))
      .toEqual({ campo: "codigo", mensaje: "Ya existe un nivel con ese código." });
  });
  test("los mensajes en español de la base se muestran tal cual", () => {
    expect(traducirError({ code: "P0001", message: "Un estudiante menor de 18 años debe tener al menos un tutor." }).mensaje)
      .toBe("Un estudiante menor de 18 años debe tener al menos un tutor.");
  });
  test("CE-23 · lo que está en uso no se elimina: se ofrece desactivar", () => {
    expect(traducirError({ code: "23503", message: 'update or delete on table "nivel" violates foreign key constraint' }).mensaje).toMatch(/desactivar/);
  });
  test("un error técnico desconocido no se muestra crudo", () => {
    expect(traducirError({ code: "22P02", message: 'invalid input syntax for type uuid: "abc"' }).mensaje).toMatch(/No se pudo guardar/);
  });
});

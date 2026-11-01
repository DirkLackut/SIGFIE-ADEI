import { describe, test, expect } from "vitest";
import { revisarCatalogo, duplicado, homonimos } from "@/dominio/catalogos";

describe("catálogos (T21)", () => {
  test("CE-22 · 'Intermediate I' y '  intermediate i ' son el mismo nivel", () => {
    const existentes = [{ id: "1", nombre: "Intermediate I", codigo: "INT-1" }];
    expect(duplicado("nivel", { nombre: "  intermediate i ", codigo: "X" }, existentes)?.registro.nombre).toBe("Intermediate I");
  });
  test("CE-74 · un nivel con el mismo código se considera existente aunque el nombre sea otro", () => {
    expect(duplicado("nivel", { nombre: "Otro", codigo: "int-1" }, [{ id: "1", nombre: "Intermediate I", codigo: "INT-1" }])?.campo).toBe("codigo");
  });
  test("CE-74 · horario repetido = misma modalidad, inicio y fin", () => {
    const ex = [{ id: "h", modalidad_id: "m", hora_inicio: "08:00:00", hora_fin: "09:30:00" }];
    expect(duplicado("horario", { modalidad_id: "m", hora_inicio: "08:00", hora_fin: "09:30" }, ex)).not.toBeNull();
    expect(duplicado("horario", { modalidad_id: "otra", hora_inicio: "08:00", hora_fin: "09:30" }, ex)).toBeNull();
  });
  test("al editar, el propio registro no cuenta como duplicado", () => {
    expect(duplicado("modalidad", { nombre: "Sabatino" }, [{ id: "1", nombre: "Sabatino" }], "1")).toBeNull();
  });
  test("CE-75 · los profesores homónimos se detectan, pero no son duplicados", () => {
    const ex = [{ id: "1", nombres: "José", apellidos: "López" }];
    expect(homonimos({ nombres: "jose", apellidos: "LOPEZ" }, ex)).toHaveLength(1);
    expect(duplicado("profesor", { nombres: "José", apellidos: "López" }, ex as never)).toBeNull();
  });
  test("CE-27 · la hora de fin debe ser posterior a la de inicio", () => {
    expect(revisarCatalogo("horario", { modalidad_id: "m", hora_inicio: "09:00", hora_fin: "09:00" }).errores.hora_fin).toMatch(/posterior/);
  });
  test("nivel: programa del catálogo y orden del 1 al 99", () => {
    const r = revisarCatalogo("nivel", { codigo: "X", nombre: "Nivel X", programa: "Otro", orden: "0", publico: "Adultos" });
    expect(Object.keys(r.errores).sort()).toEqual(["orden", "programa"]);
  });
  test("profesor: teléfono obligatorio de 8 dígitos; sucursal: teléfono opcional", () => {
    expect(revisarCatalogo("profesor", { nombres: "Ana", apellidos: "Ruiz", telefono: "" }).errores.telefono).toBeTruthy();
    expect(revisarCatalogo("sucursal", { nombre: "Centro", direccion: "Managua", telefono: "" }).datos.telefono).toBeNull();
  });
});

import { describe, test, expect } from "vitest";
import {
  desdeDireccion, haciaDireccion, cambiarCriterio, revisarCoherencia, horariosDe, nivelesDe, describirCriterios,
  hayCriterioDeInscripcion, type CatalogoFiltro,
} from "@/dominio/filtro";

const cat: CatalogoFiltro = {
  sucursales: [{ id: "s1", nombre: "Altamira" }, { id: "s2", nombre: "Las Colinas" }],
  modalidades: [{ id: "m1", nombre: "Diario" }, { id: "m2", nombre: "Sabatino" }],
  horarios: [
    { id: "h1", modalidad_id: "m1", hora_inicio: "08:00:00", hora_fin: "09:30:00" },
    { id: "h2", modalidad_id: "m2", hora_inicio: "07:30:00", hora_fin: "11:00:00" },
  ],
  niveles: [{ id: "n1", nombre: "Intermediate I-I", programa: "Curso principal" }, { id: "n2", nombre: "Kids 1", programa: "Curso de niños" }],
  profesores: [{ id: "p1", nombres: "Luis", apellidos: "Pérez" }],
};

describe("criterios en la dirección de la página (CE-22, CE-23)", () => {
  test("CE-23 · se leen de la dirección: lo vacío y lo desconocido no cuentan", () => {
    const e = desdeDireccion({ modalidad_id: "m2", estado_academico: "Reprobado", nivel_id: "", otra: "x", vista: "estudiantes", pagina: "3" });
    expect(e).toEqual({ criterios: { modalidad_id: "m2", estado_academico: "Reprobado" }, vista: "estudiantes", pagina: 3 });
  });

  test("vista y página mal escritas vuelven a lo inicial", () => {
    expect(desdeDireccion({ vista: "cualquiera", pagina: "-2" })).toEqual({ criterios: {}, vista: "inscripciones", pagina: 1 });
    expect(desdeDireccion({ pagina: "abc" }).pagina).toBe(1);
    expect(desdeDireccion(new URLSearchParams("pagina=2&sucursal_id=s1")).pagina).toBe(2);
  });

  test("si un criterio llega repetido, vale el primero", () => {
    expect(desdeDireccion({ modalidad_id: ["m1", "m2"] }).criterios).toEqual({ modalidad_id: "m1" });
  });

  test("CE-23 · se escriben en orden fijo; la vista y la página iniciales no se escriben", () => {
    expect(haciaDireccion({ criterios: { sucursal_id: "s1", estado_academico: "Reprobado" }, vista: "inscripciones", pagina: 1 }))
      .toBe("estado_academico=Reprobado&sucursal_id=s1");
    expect(haciaDireccion({ criterios: {}, vista: "estudiantes", pagina: 2 })).toBe("vista=estudiantes&pagina=2");
    expect(haciaDireccion({ criterios: {}, vista: "inscripciones", pagina: 1 })).toBe("");
  });

  test("ida y vuelta: lo que se escribe se vuelve a leer igual", () => {
    const e = { criterios: { desde: "2026-10-01", hasta: "2026-10-31", programa: "Curso principal" }, vista: "estudiantes" as const, pagina: 4 };
    expect(desdeDireccion(new URLSearchParams(haciaDireccion(e)))).toEqual(e);
  });

  test("CE-22 · cambiar un criterio conserva los demás y vuelve a la página 1", () => {
    const e = { criterios: { modalidad_id: "m2", horario_id: "h2" }, vista: "inscripciones" as const, pagina: 5 };
    expect(cambiarCriterio(e, "estado_academico", "Aprobado")).toEqual({ criterios: { modalidad_id: "m2", horario_id: "h2", estado_academico: "Aprobado" }, vista: "inscripciones", pagina: 1 });
    expect(cambiarCriterio(e, "horario_id", "").criterios).toEqual({ modalidad_id: "m2" });
  });

  test("CE-6, CE-8 · cambiar la modalidad o el programa quita el horario o el nivel que ya no corresponden", () => {
    const e = { criterios: { modalidad_id: "m2", horario_id: "h2", programa: "Curso principal", nivel_id: "n1" }, vista: "inscripciones" as const, pagina: 1 };
    expect(cambiarCriterio(e, "modalidad_id", "m1", cat).criterios).not.toHaveProperty("horario_id");
    expect(cambiarCriterio(e, "programa", "Curso de niños", cat).criterios).not.toHaveProperty("nivel_id");
    expect(cambiarCriterio(e, "modalidad_id", "m2", cat).criterios.horario_id).toBe("h2");
  });
});

describe("coherencia para avisar en pantalla (CE-6 a CE-8)", () => {
  test("CE-6 · el horario debe ser de la modalidad", () => {
    expect(revisarCoherencia({ modalidad_id: "m1", horario_id: "h2" }, cat)).toEqual({ horario_id: "Ese horario no pertenece a la modalidad elegida." });
  });

  test("CE-8 · el nivel debe ser del programa", () => {
    expect(revisarCoherencia({ programa: "Curso principal", nivel_id: "n2" }, cat)).toEqual({ nivel_id: "Ese nivel no pertenece al programa elegido." });
  });

  test("CE-7 · fechas que existen, año de cuatro cifras y rango en orden", () => {
    expect(revisarCoherencia({ desde: "2026-02-30" }, cat).desde).toMatch(/no existe/);
    expect(revisarCoherencia({ hasta: "26-01-01" }, cat).hasta).toMatch(/cuatro cifras/);
    expect(revisarCoherencia({ desde: "2026-10-31", hasta: "2026-10-01" }, cat)).toEqual({ hasta: "La fecha final no puede ser anterior a la inicial." });
    expect(revisarCoherencia({ desde: "2026-10-01", hasta: "2026-10-01" }, cat)).toEqual({});
  });

  test("las listas dependientes: horarios de la modalidad y niveles del programa", () => {
    expect(horariosDe("m2", cat.horarios).map((h) => h.id)).toEqual(["h2"]);
    expect(horariosDe(undefined, cat.horarios)).toHaveLength(2);
    expect(nivelesDe("Curso de niños", cat.niveles).map((n) => n.id)).toEqual(["n2"]);
  });

  test("CE-3 · solo sucursal y estado de matrícula son criterios del estudiante", () => {
    expect(hayCriterioDeInscripcion({ sucursal_id: "s1", estado_matricula: "Activo" })).toBe(false);
    expect(hayCriterioDeInscripcion({ sucursal_id: "s1", profesor_id: "p1" })).toBe(true);
  });
});

describe("CE-26 · los criterios en palabras", () => {
  test("con nombres del catálogo, en el orden del formulario", () => {
    expect(describirCriterios({ estado_academico: "Reprobado", modalidad_id: "m2", horario_id: "h2", sucursal_id: "s2",
      profesor_id: "p1", desde: "2026-10-01", hasta: "2026-10-31" }, cat)).toEqual([
      "Sucursal: Las Colinas", "Modalidad: Sabatino", "Horario: 7:30 a. m. – 11:00 a. m.", "Profesor: Luis Pérez",
      "Estado académico: Reprobado", "En curso entre 01/10/2026 y 31/10/2026",
    ]);
  });

  test("rangos abiertos y sin criterios", () => {
    expect(describirCriterios({ desde: "2026-10-01" }, cat)).toEqual(["En curso desde 01/10/2026"]);
    expect(describirCriterios({ hasta: "2026-10-31" }, cat)).toEqual(["En curso hasta 31/10/2026"]);
    expect(describirCriterios({}, cat)).toEqual(["Sin criterios: todos los registros"]);
  });

  test("un id que ya no está en el catálogo no se inventa", () => {
    expect(describirCriterios({ sucursal_id: "zz" }, cat)).toEqual(["Sucursal: (no encontrada)"]);
  });
});

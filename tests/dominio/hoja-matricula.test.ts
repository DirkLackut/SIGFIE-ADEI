import { describe, test, expect } from "vitest";
import { componerHoja, SIN_REGISTRO, type DatosHoja } from "@/dominio/hoja-matricula";

const datos: DatosHoja = {
  alumno: { nombres: "Carla Inés", apellidos: "Prueba Solís", fecha_nacimiento: "2014-03-10", edad: 12, direccion: null,
    cedula: null, telefono: null, correo: null, contacto_emergencia: "Abuela, 88881111", codigo_adei: "ADEI-2026-00010",
    fecha_ingreso: "2026-11-02" },
  tutor: { nombre_completo: "Mario Prueba Solís", cedula: "001-010180-0001A", telefono: "88882222" },
  tutores_adicionales: 1,
  academia: { nivel: "Intermediate I-I", curso: "Curso principal", modalidad: "Sabatino", hora_inicio: "07:30:00",
    hora_fin: "11:00:00", fecha_inicio: "2026-09-26", fecha_termino: "2026-10-24", profesor: "Luis Pérez",
    sucursal: "Altamira", codigo_grupo: "G-2026-0004", inscrito_por: "aura.gomez", recibo: "B-47133",
    paga: { monto: 1245.5, moneda: "NIO" } },
};
const valor = (h: ReturnType<typeof componerHoja>, seccion: keyof ReturnType<typeof componerHoja>["secciones"], etiqueta: string) =>
  h.secciones[seccion].find((c) => c.etiqueta === etiqueta);

describe("Hoja de matrícula prellenada (CE-45 a CE-49)", () => {
  const h = componerHoja(datos);

  test("CE-45 · las tres secciones del formato, con sus etiquetas y en su orden", () => {
    expect(h.secciones.alumno.map((c) => c.etiqueta)).toEqual(["Nombres completos", "Apellidos", "Fecha de nacimiento", "Edad",
      "Dirección", "Lugar donde vive", "Cédula del alumno N.º", "N.º Celular del alumno", "Nivel de escolaridad", "Correo electrónico"]);
    expect(h.secciones.tutor.map((c) => c.etiqueta)).toEqual(["Nombre del tutor", "N.º Celular del tutor", "Cédula del tutor", "En caso de emergencia llamar a"]);
    expect(h.secciones.academia.map((c) => c.etiqueta)).toEqual(["Fecha de ingreso", "N.º Recibo", "Nivel", "Horario", "Inicio nivel",
      "Término nivel", "Profesor", "Curso", "Inscrito por", "Paga"]);
  });

  test("CE-45 · los datos que registra, ya en su formato", () => {
    expect(valor(h, "alumno", "Fecha de nacimiento")).toEqual({ etiqueta: "Fecha de nacimiento", valor: "10/03/2014", tipo: "dato" });
    expect(valor(h, "alumno", "Edad")!.valor).toBe("12 años");
    expect(valor(h, "tutor", "N.º Celular del tutor")!.valor).toBe("8888 2222");
    expect(valor(h, "academia", "Horario")!.valor).toBe("Sabatino, 7:30 a. m. – 11:00 a. m.");
    expect(valor(h, "academia", "Paga")!.valor).toBe("C$1,245.50");
    expect(valor(h, "academia", "N.º Recibo")!.valor).toBe("B-47133");
  });

  test("CE-46 · un dato que el sistema guarda pero falta dice «sin registro»", () => {
    expect(valor(h, "alumno", "Dirección")).toEqual({ etiqueta: "Dirección", valor: SIN_REGISTRO, tipo: "sin_registro" });
    expect(valor(h, "alumno", "Cédula del alumno N.º")!.tipo).toBe("sin_registro");
    expect(SIN_REGISTRO).toBe("sin registro");
  });

  test("CE-47 · lo que el sistema no registra queda en blanco para llenarse a mano", () => {
    for (const e of ["Lugar donde vive", "Nivel de escolaridad"]) expect(valor(h, "alumno", e)).toEqual({ etiqueta: e, valor: "", tipo: "en_blanco" });
    expect(h.requisitos).toEqual(["Fotocopia de cédula", "Tutor", "Part. nacimiento", "Foto"]);
    expect(h.recuadroFoto).toBe(true);
  });

  test("CE-48 · nada de estado civil ni enfermedad", () => {
    const texto = JSON.stringify(h).toLowerCase();
    for (const p of ["civil", "solter", "casad", "enfermedad", "padece", "explique"]) expect(texto).not.toContain(p);
  });

  test("CE-49 · con más tutores se dice cuántos más hay", () => {
    expect(h.notaTutores).toBe("El estudiante tiene 1 tutor más registrado en el sistema.");
    expect(componerHoja({ ...datos, tutores_adicionales: 2 }).notaTutores).toBe("El estudiante tiene 2 tutores más registrados en el sistema.");
    expect(componerHoja({ ...datos, tutores_adicionales: 0 }).notaTutores).toBeNull();
  });

  test("sin tutor (mayor de edad) y sin factura: «sin registro», nunca inventado", () => {
    const m = componerHoja({ ...datos, tutor: null, tutores_adicionales: 0, academia: { ...datos.academia, recibo: null, paga: null, inscrito_por: null } });
    for (const e of ["Nombre del tutor", "N.º Celular del tutor", "Cédula del tutor"]) expect(valor(m, "tutor", e)!.tipo).toBe("sin_registro");
    for (const e of ["N.º Recibo", "Paga", "Inscrito por"]) expect(valor(m, "academia", e)!.valor).toBe(SIN_REGISTRO);
  });
});

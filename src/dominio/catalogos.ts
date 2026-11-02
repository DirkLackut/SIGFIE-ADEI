/**
 * Catálogos (T21): qué campos tiene cada uno, cómo se revisan antes de enviarlos
 * y cuándo un valor nuevo "ya existe" (CE-22, CE-74, CE-75). La base vuelve a
 * revisar todo con sus índices únicos; esto sirve para decir CUÁL valor existe.
 */
import { normalizar, limpiarEspacios, validarNombre } from "./texto";

export type Entidad = "sucursal" | "modalidad" | "horario" | "nivel" | "profesor";
/** Los que se ofrecen para un nivel nuevo (spec 002: Curso principal de 16 niveles
 *  y Curso de niños aparte). */
export const PROGRAMAS = ["Curso principal", "Conversation", "Conversation Avanzada", "Especial", "Curso de niños"] as const;
/** Los de antes de la 013: ya no se ofrecen, pero un nivel antiguo que los tiene se
 *  puede seguir editando (la base también los acepta). */
const PROGRAMAS_ANTERIORES = ["Principiante", "Beginners", "Intermediate", "Advanced"];
export const PUBLICOS = ["Todos", "Adultos", "Niños"] as const;

export const CAMPOS: Record<Entidad, string[]> = {
  sucursal: ["nombre", "direccion", "telefono"],
  modalidad: ["nombre", "dias_de_clase"],
  horario: ["modalidad_id", "hora_inicio", "hora_fin"],
  nivel: ["codigo", "nombre", "programa", "orden", "publico"],
  profesor: ["nombres", "apellidos", "telefono"],
};
/** La sucursal no tiene estado: siempre está activa (clarificación C2). */
export const TIENE_ACTIVO: Record<Entidad, boolean> = { sucursal: false, modalidad: true, horario: true, nivel: true, profesor: true };

type Valores = Record<string, string>;
export type Revision = { datos: Record<string, string | number | null>; errores: Record<string, string> };

const largo = (v: string, min: number, max: number) => v.length >= min && v.length <= max;

export function revisarCatalogo(entidad: Entidad, v: Valores): Revision {
  const e: Record<string, string> = {};
  const d: Record<string, string | number | null> = {};
  const texto = (campo: string, min: number, max: number, msg: string) => {
    const t = limpiarEspacios(v[campo] ?? "");
    if (!largo(t, min, max)) e[campo] = msg; else d[campo] = t;
  };
  const tel = (campo: string, requerido: boolean) => {
    const t = (v[campo] ?? "").replace(/[\s-]/g, "");
    if (!t) { if (requerido) e[campo] = "Es obligatorio (8 dígitos)."; else d[campo] = null; }
    else if (!/^\d{8}$/.test(t)) e[campo] = "Debe tener 8 dígitos."; else d[campo] = t;
  };

  switch (entidad) {
    case "sucursal":
      texto("nombre", 2, 60, "De 2 a 60 caracteres."); texto("direccion", 2, 200, "De 2 a 200 caracteres."); tel("telefono", false); break;
    case "modalidad":
      texto("nombre", 2, 40, "De 2 a 40 caracteres."); texto("dias_de_clase", 2, 40, "Escriba los días, por ejemplo «Lunes a jueves»."); break;
    case "horario":
      if (!v.modalidad_id) e.modalidad_id = "Elija la modalidad."; else d.modalidad_id = v.modalidad_id;
      if (!/^\d{2}:\d{2}$/.test(v.hora_inicio ?? "")) e.hora_inicio = "Indique la hora de inicio."; else d.hora_inicio = v.hora_inicio;
      if (!/^\d{2}:\d{2}$/.test(v.hora_fin ?? "")) e.hora_fin = "Indique la hora de fin.";
      else if (v.hora_fin <= (v.hora_inicio ?? "")) e.hora_fin = "Debe ser posterior a la hora de inicio.";                 // CE-27
      else d.hora_fin = v.hora_fin;
      break;
    case "nivel": {
      texto("codigo", 1, 10, "De 1 a 10 caracteres, por ejemplo INT-11."); texto("nombre", 2, 60, "De 2 a 60 caracteres.");
      if (!PROGRAMAS.includes(v.programa as never) && !PROGRAMAS_ANTERIORES.includes(v.programa)) e.programa = "Elija el programa.";
      else d.programa = v.programa;
      if (!PUBLICOS.includes(v.publico as never)) e.publico = "Elija el público."; else d.publico = v.publico;
      const n = Number(v.orden);
      if (!Number.isInteger(n) || n < 1 || n > 99) e.orden = "Un número del 1 al 99: su lugar dentro del programa."; else d.orden = n;
      break;
    }
    case "profesor": {
      for (const c of ["nombres", "apellidos"]) { const r = validarNombre(v[c] ?? ""); if (r.ok) d[c] = r.valor; else e[c] = r.regla; }
      tel("telefono", true); break;
    }
  }
  return { datos: d, errores: e };
}

/**
 * CE-22, CE-74: ¿ya existe? Compara sin mayúsculas, tildes ni espacios. Devuelve
 * el registro existente para poder decir cuál es. El horario se compara por
 * modalidad e intervalo. El profesor NO se considera duplicado (homónimos
 * posibles, CE-75): para eso está homonimos().
 */
export function duplicado<T extends Record<string, unknown> & { id: string }>(
  entidad: Entidad, nuevo: Record<string, unknown>, existentes: T[], excluirId?: string,
): { registro: T; campo: string } | null {
  const n = (x: unknown) => normalizar(String(x ?? ""));
  for (const r of existentes) {
    if (r.id === excluirId) continue;
    if (entidad === "horario") {
      if (r.modalidad_id === nuevo.modalidad_id && String(r.hora_inicio).slice(0, 5) === nuevo.hora_inicio
          && String(r.hora_fin).slice(0, 5) === nuevo.hora_fin) return { registro: r, campo: "hora_inicio" };
      continue;
    }
    if (entidad === "profesor") continue;
    if (n(r.nombre) === n(nuevo.nombre)) return { registro: r, campo: "nombre" };
    if (entidad === "nivel" && n(r.codigo) === n(nuevo.codigo)) return { registro: r, campo: "codigo" };
  }
  return null;
}

/** CE-75: profesores con los mismos nombres y apellidos. */
export function homonimos<T extends { id: string; nombres: string; apellidos: string }>(nuevo: { nombres: string; apellidos: string }, existentes: T[], excluirId?: string): T[] {
  const clave = (p: { nombres: string; apellidos: string }) => normalizar(`${p.nombres} ${p.apellidos}`);
  return existentes.filter((p) => p.id !== excluirId && clave(p) === clave(nuevo));
}

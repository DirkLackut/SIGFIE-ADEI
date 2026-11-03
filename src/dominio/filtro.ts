/**
 * Criterios del filtrado (spec 003, CE-1 a CE-23). Viajan en la dirección de la
 * página (D31): el mismo texto alimenta la pantalla, la exportación y la
 * impresión. La base vuelve a revisar todo (principio 1); esto solo sirve para
 * avisar antes y para escribir los criterios en palabras (CE-26).
 */
import { esFechaReal } from "./edad";
import { fecha, hora } from "./formato";

export const CLAVES = [
  "sucursal_id", "programa", "nivel_id", "modalidad_id", "horario_id", "profesor_id",
  "estado_matricula", "estado_inscripcion", "estado_academico", "desde", "hasta",
] as const;
export type Clave = (typeof CLAVES)[number];
export type Criterios = Partial<Record<Clave, string>>;
export type Vista = "inscripciones" | "estudiantes";
export interface EstadoFiltro { criterios: Criterios; vista: Vista; pagina: number }

export const ESTADOS_MATRICULA = ["Activo", "Desertor", "Egresado"] as const;
export const ESTADOS_INSCRIPCION = ["En curso", "Completada", "Retirada", "Trasladada"] as const;
export const ESTADOS_ACADEMICOS = ["Pendiente", "Aprobado", "Reprobado", "Condicionado"] as const;

export interface CatalogoFiltro {
  sucursales: { id: string; nombre: string }[];
  modalidades: { id: string; nombre: string }[];
  horarios: { id: string; modalidad_id: string; hora_inicio: string; hora_fin: string }[];
  niveles: { id: string; nombre: string; programa: string }[];
  profesores: { id: string; nombres: string; apellidos: string }[];
}

type Parametros = URLSearchParams | Record<string, string | string[] | undefined>;

function leer(p: Parametros, clave: string): string | undefined {
  if (p instanceof URLSearchParams) return p.get(clave) ?? undefined;
  const v = p[clave];
  return Array.isArray(v) ? v[0] : v;
}

/** CE-23: lo que dice la dirección. Lo vacío y lo desconocido no cuentan. */
export function desdeDireccion(p: Parametros): EstadoFiltro {
  const criterios: Criterios = {};
  for (const k of CLAVES) {
    const v = leer(p, k)?.trim();
    if (v) criterios[k] = v;
  }
  const vista: Vista = leer(p, "vista") === "estudiantes" ? "estudiantes" : "inscripciones";
  const n = Number(leer(p, "pagina"));
  const pagina = Number.isInteger(n) && n >= 1 ? n : 1;
  return { criterios, vista, pagina };
}

/** El texto de la dirección, en orden fijo (así dos consultas iguales tienen la
 *  misma dirección). La vista y la página iniciales no se escriben. */
export function haciaDireccion({ criterios, vista, pagina }: EstadoFiltro): string {
  const p = new URLSearchParams();
  for (const k of [...CLAVES].sort()) {
    const v = criterios[k];
    if (v) p.set(k, v);
  }
  if (vista !== "inscripciones") p.set("vista", vista);
  if (pagina > 1) p.set("pagina", String(pagina));
  return p.toString();
}

/**
 * CE-22: un criterio nuevo conserva los demás y vuelve a la página 1. Con el
 * catálogo, quita el horario que deja de ser de la modalidad (CE-6) y el nivel que
 * deja de ser del programa (CE-8).
 */
export function cambiarCriterio(e: EstadoFiltro, clave: Clave, valor: string, cat?: CatalogoFiltro): EstadoFiltro {
  const criterios: Criterios = { ...e.criterios };
  if (valor) criterios[clave] = valor; else delete criterios[clave];
  if (cat && clave === "modalidad_id" && criterios.horario_id && criterios.modalidad_id) {
    const h = cat.horarios.find((x) => x.id === criterios.horario_id);
    if (h && h.modalidad_id !== criterios.modalidad_id) delete criterios.horario_id;
  }
  if (cat && clave === "programa" && criterios.nivel_id && criterios.programa) {
    const n = cat.niveles.find((x) => x.id === criterios.nivel_id);
    if (n && n.programa !== criterios.programa) delete criterios.nivel_id;
  }
  return { criterios, vista: e.vista, pagina: 1 };
}

export const horariosDe = <H extends { modalidad_id: string }>(modalidad: string | undefined, horarios: H[]) =>
  modalidad ? horarios.filter((h) => h.modalidad_id === modalidad) : horarios;
export const nivelesDe = <N extends { programa: string }>(programa: string | undefined, niveles: N[]) =>
  programa ? niveles.filter((n) => n.programa === programa) : niveles;

function revisarFecha(v: string | undefined): string | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "La fecha debe tener día, mes y un año de cuatro cifras.";
  if (!esFechaReal(v)) return "Esa fecha no existe.";
  return null;
}

/** CE-6 a CE-8, con los mismos mensajes que la base. Devuelve {campo: mensaje}. */
export function revisarCoherencia(c: Criterios, cat: CatalogoFiltro): Partial<Record<Clave, string>> {
  const errores: Partial<Record<Clave, string>> = {};
  if (c.horario_id && c.modalidad_id) {
    const h = cat.horarios.find((x) => x.id === c.horario_id);
    if (h && h.modalidad_id !== c.modalidad_id) errores.horario_id = "Ese horario no pertenece a la modalidad elegida.";
  }
  if (c.nivel_id && c.programa) {
    const n = cat.niveles.find((x) => x.id === c.nivel_id);
    if (n && n.programa !== c.programa) errores.nivel_id = "Ese nivel no pertenece al programa elegido.";
  }
  for (const k of ["desde", "hasta"] as const) {
    const m = revisarFecha(c[k]);
    if (m) errores[k] = m;
  }
  if (!errores.desde && !errores.hasta && c.desde && c.hasta && c.hasta < c.desde) {
    errores.hasta = "La fecha final no puede ser anterior a la inicial.";
  }
  return errores;
}

/** CE-3: sucursal y estado de matrícula son del estudiante; lo demás, de la inscripción. */
export const hayCriterioDeInscripcion = (c: Criterios) =>
  Object.entries(c).some(([k, v]) => v && k !== "sucursal_id" && k !== "estado_matricula");

const NO_ENCONTRADO = "(no encontrada)";

/** CE-26: los criterios en palabras, en el orden del formulario. */
export function describirCriterios(c: Criterios, cat: CatalogoFiltro): string[] {
  const nombre = <T extends { id: string }>(lista: T[], id: string, f: (x: T) => string) => {
    const x = lista.find((y) => y.id === id);
    return x ? f(x) : NO_ENCONTRADO;
  };
  const r: string[] = [];
  if (c.sucursal_id) r.push(`Sucursal: ${nombre(cat.sucursales, c.sucursal_id, (s) => s.nombre)}`);
  if (c.programa) r.push(`Programa: ${c.programa}`);
  if (c.nivel_id) r.push(`Nivel: ${nombre(cat.niveles, c.nivel_id, (n) => n.nombre)}`);
  if (c.modalidad_id) r.push(`Modalidad: ${nombre(cat.modalidades, c.modalidad_id, (m) => m.nombre)}`);
  if (c.horario_id) r.push(`Horario: ${nombre(cat.horarios, c.horario_id, (h) => `${hora(h.hora_inicio)} – ${hora(h.hora_fin)}`)}`);
  if (c.profesor_id) r.push(`Profesor: ${nombre(cat.profesores, c.profesor_id, (p) => `${p.nombres} ${p.apellidos}`)}`);
  if (c.estado_matricula) r.push(`Estado de matrícula: ${c.estado_matricula}`);
  if (c.estado_inscripcion) r.push(`Estado de inscripción: ${c.estado_inscripcion}`);
  if (c.estado_academico) r.push(`Estado académico: ${c.estado_academico}`);
  if (c.desde && c.hasta) r.push(`En curso entre ${fecha(c.desde)} y ${fecha(c.hasta)}`);
  else if (c.desde) r.push(`En curso desde ${fecha(c.desde)}`);
  else if (c.hasta) r.push(`En curso hasta ${fecha(c.hasta)}`);
  return r.length ? r : ["Sin criterios: todos los registros"];
}

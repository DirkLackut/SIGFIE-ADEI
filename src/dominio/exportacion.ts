/**
 * Qué lleva cada archivo de Excel de la spec 003 (plan §5b): el listado del
 * filtrado (CE-24 a CE-30), el historial (CE-43) y el respaldo (CE-31 a CE-33).
 * Arma las hojas; `xlsx.ts` las escribe.
 *
 * Antes de armar, se comprueba que vengan todas las filas (CE-25, CE-32): si no,
 * se lanza ErrorCompletitud y no hay archivo. Nunca un listado incompleto.
 */
import type { Celda, Columna, Hoja, Valor } from "./xlsx";
import { celdaParcial, type ParcialImpreso } from "./acta-impresa";
import { fecha, hora } from "./formato";
import { formatoMonto } from "./factura";

export class ErrorCompletitud extends Error {
  constructor(public esperados: number, public obtenidos: number) {
    super(`El resultado no está completo: se esperaban ${esperados} registros y llegaron ${obtenidos}.`);
  }
}
export class SinRegistros extends Error {
  constructor() { super("El resultado tiene 0 registros: no hay nada que exportar."); }
}

export const ENCABEZADO_ADEI = "ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI";

/** «02/11/2026 18:40», en hora de Managua. */
export function fechaHoraArchivo(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** SIGFIE_inscripciones_2026-11-02_1840.xlsx */
export function nombreArchivo(que: string, iso: string): string {
  const [d, h] = fechaHoraArchivo(iso).split(" ");
  const [dia, mes, anio] = d.split("/");
  return `SIGFIE_${que}_${anio}-${mes}-${dia}_${h.replace(":", "")}.xlsx`;
}

export interface Generado { fechaHora: string; usuario: string }
const lineaGenerado = (g: Generado) => `Generado: ${fechaHoraArchivo(g.fechaHora)} por ${g.usuario}`;
const registros = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "registro" : "registros"}`;
const horario = (i: string, f: string) => `${hora(i)} – ${hora(f)}`;
const nombreCompleto = (apellidos: string, nombres: string) => `${apellidos}, ${nombres}`;
const rojo = (v: Valor, si: boolean): Celda | Valor => (si ? { v, rojo: true } : v);

function comprobar(filas: number, total: number) {
  if (filas !== total) throw new ErrorCompletitud(total, filas);
  if (total === 0) throw new SinRegistros();
}

// ---------------------------------------------------------------------------
// Listado del filtrado
// ---------------------------------------------------------------------------
export interface FilaInscripcion {
  id: string; estudiante_id: string; codigo_adei: string; apellidos: string; nombres: string; estado_matricula: string;
  sucursal: string; grupo_id: string; codigo_grupo: string; programa: string; nivel: string; modalidad: string;
  hora_inicio: string; hora_fin: string; profesor: string; fecha_inicio: string; fecha_termino: string;
  estado_acta: string; estado_inscripcion: string; nota_final: number | null; estado_academico: string | null; provisional: boolean;
}
export interface FilaEstudiante {
  id: string; codigo_adei: string; apellidos: string; nombres: string; cedula: string | null; sucursal: string;
  estado_matricula: string; inscripciones: number; ultimo_nivel: string | null;
}

const COLUMNAS_INSCRIPCIONES: Columna[] = [
  { titulo: "N.º", tipo: "entero", ancho: 6 }, { titulo: "Código ADEI", tipo: "codigo" }, { titulo: "Apellidos y nombres", tipo: "texto" },
  { titulo: "Sucursal", tipo: "texto" }, { titulo: "Grupo", tipo: "codigo" }, { titulo: "Programa", tipo: "texto" },
  { titulo: "Nivel", tipo: "texto" }, { titulo: "Modalidad", tipo: "texto" }, { titulo: "Horario", tipo: "texto" },
  { titulo: "Profesor", tipo: "texto" }, { titulo: "Inicio", tipo: "fecha" }, { titulo: "Término", tipo: "fecha" },
  { titulo: "Estado inscripción", tipo: "texto" }, { titulo: "Final", tipo: "numero", ancho: 7 }, { titulo: "Estado académico", tipo: "texto" },
];
const COLUMNAS_ESTUDIANTES: Columna[] = [
  { titulo: "N.º", tipo: "entero", ancho: 6 }, { titulo: "Código ADEI", tipo: "codigo" }, { titulo: "Apellidos y nombres", tipo: "texto" },
  { titulo: "Cédula", tipo: "codigo" }, { titulo: "Sucursal", tipo: "texto" }, { titulo: "Estado de matrícula", tipo: "texto" },
  { titulo: "Último nivel cursado", tipo: "texto" }, { titulo: "Inscripciones que cumplen", tipo: "entero" },
];

/** El estado como se lee: una nota todavía incompleta se dice provisional (CE-39). */
export const estadoEnPalabras = (estado: string | null, provisional: boolean) =>
  estado === null ? "" : provisional ? `${estado} (provisional)` : estado;

export function hojaListado(o:
  | { vista: "inscripciones"; filas: FilaInscripcion[]; total: number; criterios: string[]; generado: Generado }
  | { vista: "estudiantes"; filas: FilaEstudiante[]; total: number; criterios: string[]; generado: Generado }): Hoja {
  comprobar(o.filas.length, o.total);
  const titulo = o.vista === "inscripciones" ? "Listado de inscripciones" : "Listado de estudiantes";
  const encabezado: Hoja["encabezado"] = [
    { texto: ENCABEZADO_ADEI, estilo: "titulo" },
    { texto: `${titulo} — SIGFIE`, estilo: "subtitulo" },
    { texto: lineaGenerado(o.generado), estilo: "dato" },
    { texto: `Criterios: ${o.criterios.length ? o.criterios.join(" · ") : "Sin criterios: todos los registros"}`, estilo: "dato" },
    { texto: `Total: ${registros(o.total)}. El listado está completo.`, estilo: "total" },
  ];
  const pie = `Fin del listado: ${o.total.toLocaleString("en-US")} de ${registros(o.total)}.`;
  if (o.vista === "inscripciones") {
    return { nombre: "Inscripciones", encabezado, columnas: COLUMNAS_INSCRIPCIONES, pie, impresion: { horizontal: true },
      filas: o.filas.map((f, n) => {
        const reprobada = f.estado_academico === "Reprobado";
        return [n + 1, f.codigo_adei, nombreCompleto(f.apellidos, f.nombres), f.sucursal, f.codigo_grupo, f.programa, f.nivel,
          f.modalidad, horario(f.hora_inicio, f.hora_fin), f.profesor, f.fecha_inicio, f.fecha_termino, f.estado_inscripcion,
          rojo(f.nota_final, reprobada), rojo(estadoEnPalabras(f.estado_academico, f.provisional), reprobada)];
      }) };
  }
  return { nombre: "Estudiantes", encabezado, columnas: COLUMNAS_ESTUDIANTES, pie, impresion: { horizontal: true },
    filas: o.filas.map((f, n) => [n + 1, f.codigo_adei, nombreCompleto(f.apellidos, f.nombres), f.cedula, f.sucursal,
      f.estado_matricula, f.ultimo_nivel, f.inscripciones]) };
}

// ---------------------------------------------------------------------------
// Historial (CE-43)
// ---------------------------------------------------------------------------
export interface HistorialArchivo {
  estudiante: { codigo_adei: string; nombres: string; apellidos: string; cedula: string | null; sucursal: string;
    estado_matricula: string; fecha_cambio_estado: string | null };
  inscripciones: {
    codigo_grupo: string; programa: string; nivel: string; modalidad: string; hora_inicio: string; hora_fin: string;
    profesor: string; sucursal: string; fecha_inicio: string; fecha_termino: string; estado_inscripcion: string; estado_acta: string;
    parciales: ParcialImpreso[]; nota_final: number | null; provisional: boolean; estado_academico: string | null;
    condicionado: boolean; justificacion_condicionado: string | null;
    factura: { serie: string; numero: number; monto: number; moneda: string } | null;
  }[];
}

const COLUMNAS_HISTORIAL: Columna[] = [
  { titulo: "N.º", tipo: "entero", ancho: 6 }, { titulo: "Grupo", tipo: "codigo" }, { titulo: "Programa", tipo: "texto" },
  { titulo: "Nivel", tipo: "texto" }, { titulo: "Modalidad", tipo: "texto" }, { titulo: "Horario", tipo: "texto" },
  { titulo: "Profesor", tipo: "texto" }, { titulo: "Sucursal", tipo: "texto" }, { titulo: "Inicio", tipo: "fecha" },
  { titulo: "Término", tipo: "fecha" }, { titulo: "I", tipo: "numero", ancho: 7 }, { titulo: "II", tipo: "numero", ancho: 7 },
  { titulo: "III", tipo: "numero", ancho: 7 }, { titulo: "Final", tipo: "numero", ancho: 7 }, { titulo: "Estado académico", tipo: "texto" },
  { titulo: "Estado inscripción", tipo: "texto" }, { titulo: "Factura", tipo: "texto" },
];

/** I, II, III: el número si es Registrado; NP, J o «85 R» si no (como el acta, 002·CE-53). */
const parcial = (p: ParcialImpreso | undefined): Valor =>
  !p ? null : p.condicion === "Registrado" ? p.valor : celdaParcial(p);

export function hojaHistorial(h: HistorialArchivo, generado: Generado): Hoja {
  const e = h.estudiante;
  const estado = e.fecha_cambio_estado ? `${e.estado_matricula} desde ${fecha(e.fecha_cambio_estado)}` : e.estado_matricula;
  const n = h.inscripciones.length;
  return {
    nombre: "Historial", impresion: { horizontal: true }, columnas: COLUMNAS_HISTORIAL,
    encabezado: [
      { texto: ENCABEZADO_ADEI, estilo: "titulo" },
      { texto: `Historial académico — ${nombreCompleto(e.apellidos, e.nombres)}`, estilo: "subtitulo" },
      { texto: `Código ${e.codigo_adei} · Cédula: ${e.cedula ?? "sin registro"} · ${e.sucursal} · ${estado}`, estilo: "dato" },
      { texto: lineaGenerado(generado), estilo: "dato" },
      { texto: n === 0 ? "Sin niveles cursados." : `Total: ${n} ${n === 1 ? "nivel cursado" : "niveles cursados"}.`, estilo: "total" },
    ],
    filas: h.inscripciones.map((i, k) => {
      const reprobada = i.estado_academico === "Reprobado";
      const final = i.estado_academico === "Condicionado" && i.nota_final !== null ? `${i.nota_final} C` : i.nota_final;
      return [k + 1, i.codigo_grupo, i.programa, i.nivel, i.modalidad, horario(i.hora_inicio, i.hora_fin), i.profesor, i.sucursal,
        i.fecha_inicio, i.fecha_termino, ...[1, 2, 3].map((x) => parcial(i.parciales.find((p) => p.numero === x))),
        rojo(final, reprobada), rojo(estadoEnPalabras(i.estado_academico, i.provisional), reprobada), i.estado_inscripcion,
        i.factura ? `${i.factura.serie}-${i.factura.numero} · ${formatoMonto(Number(i.factura.monto), i.factura.moneda)}` : null];
    }),
  };
}

// ---------------------------------------------------------------------------
// Respaldo (CE-31 a CE-33)
// ---------------------------------------------------------------------------
const HOJAS_RESPALDO: Record<string, [string, string]> = {
  estudiantes: ["Estudiantes", "Expediente de cada estudiante"],
  tutores: ["Tutores", "Tutores registrados"],
  estudiante_tutor: ["Estudiante-Tutor", "Qué tutor tiene cada estudiante"],
  grupos: ["Grupos", "Grupos con su nivel, horario, profesor, sucursal y acta"],
  inscripciones: ["Inscripciones", "Un renglón por nivel cursado"],
  parciales: ["Parciales", "I, II y III con su condición"],
  resultados: ["Resultados", "Nota final y estado académico de cada inscripción"],
  facturas: ["Facturas", "Número, serie, fecha, monto, moneda y forma de pago"],
  factura_estudiante: ["Factura-Estudiante", "Estudiantes que ampara cada factura"],
  sucursales: ["Sucursales", "Catálogo de sucursales"],
  niveles: ["Niveles", "Catálogo de niveles por programa"],
  modalidades: ["Modalidades", "Catálogo de modalidades"],
  horarios: ["Horarios", "Catálogo de horarios por modalidad"],
  profesores: ["Profesores", "Catálogo de profesores"],
  reglas: ["Reglas", "Reglas de aprobación con su vigencia"],
};

const TITULOS: Record<string, string> = {
  id: "Id", codigo_adei: "Código ADEI", cedula: "Cédula", nombres: "Nombres", apellidos: "Apellidos",
  fecha_nacimiento: "Fecha de nacimiento", telefono: "Teléfono", correo: "Correo", direccion: "Dirección",
  contacto_emergencia: "Contacto de emergencia", sucursal_id: "Sucursal", estado_matricula: "Estado de matrícula",
  fecha_cambio_estado: "Fecha del cambio de estado", origen_registro: "Origen del registro", version: "Versión",
  creado_en: "Creado en", nombre_completo: "Nombre completo", estudiante_id: "Estudiante", tutor_id: "Tutor",
  codigo_grupo: "Código de grupo", nivel_id: "Nivel", horario_id: "Horario", profesor_id: "Profesor",
  fecha_inicio: "Fecha de inicio", fecha_termino: "Fecha de término", estado_acta: "Estado del acta",
  fecha_entrega_acta: "Entrega del acta", grupo_id: "Grupo", fecha_inscripcion: "Fecha de inscripción",
  estado_inscripcion: "Estado de la inscripción", observaciones: "Observaciones", inscripcion_id: "Inscripción",
  numero: "Número", condicion: "Condición", valor: "Valor", reprogramacion_autorizada: "Reprogramación autorizada",
  recibo_reprogramacion: "Recibo de reprogramación", nota_exacta: "Nota exacta", nota_final: "Nota final",
  provisional: "Provisional", estado_academico: "Estado académico", condicionado: "Condicionado",
  justificacion_condicionado: "Justificación del Condicionado", aviso_inasistencia: "Aviso de inasistencia",
  baja_inasistencia: "Baja por inasistencia", regla_id: "Regla", sin_regla: "Sin regla", serie: "Serie",
  fecha_emision: "Fecha de emisión", monto: "Monto", moneda: "Moneda", forma_pago: "Forma de pago", factura_id: "Factura",
  nombre: "Nombre", es_central: "Es la central", codigo: "Código", programa: "Programa", orden: "Orden", publico: "Público",
  activo: "Activo", dias_de_clase: "Días de clase", modalidad_id: "Modalidad", hora_inicio: "Hora de inicio",
  hora_fin: "Hora de fin", nivel_desde: "Desde el nivel", nivel_hasta: "Hasta el nivel", vigente_desde: "Vigente desde",
  nota_minima: "Nota mínima", condicionado_desde: "Condicionado desde", nota_condicion: "Nota que exige el Condicionado",
};
const titulo = (k: string) => TITULOS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "));

function tipoDe(k: string, muestra: unknown[]): Columna["tipo"] {
  if (k === "id" || k.endsWith("_id") || k.startsWith("codigo") || k === "cedula" || k === "telefono" || k === "serie") return "codigo";
  const v = muestra.find((x) => x !== null && x !== undefined);
  if (typeof v === "number") return Number.isInteger(v) && k !== "monto" && k !== "nota_exacta" ? "entero" : "numero";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return "fechaHora";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return "fecha";
  if (k === "monto" || k === "nota_exacta") return "numero";
  return "texto";
}

export interface RespaldoArchivo {
  generado: { fecha_hora: string; usuario: string };
  hojas: { nombre: string; total: number; filas: Record<string, unknown>[] }[];
}

export function hojasRespaldo(r: RespaldoArchivo): Hoja[] {
  for (const h of r.hojas) if (h.filas.length !== h.total) throw new ErrorCompletitud(h.total, h.filas.length);
  const indice: Hoja = {
    nombre: "Índice",
    encabezado: [
      { texto: ENCABEZADO_ADEI, estilo: "titulo" },
      { texto: "Respaldo completo — SIGFIE", estilo: "subtitulo" },
      { texto: lineaGenerado({ fechaHora: r.generado.fecha_hora, usuario: r.generado.usuario }), estilo: "dato" },
      { texto: "No incluye cuentas de usuario ni bitácora.", estilo: "total" },
    ],
    columnas: [{ titulo: "Hoja", tipo: "texto", ancho: 22 }, { titulo: "Filas", tipo: "entero", ancho: 10 }, { titulo: "Qué contiene", tipo: "texto", ancho: 60 }],
    filas: r.hojas.map((h) => [HOJAS_RESPALDO[h.nombre]?.[0] ?? titulo(h.nombre), h.total, HOJAS_RESPALDO[h.nombre]?.[1] ?? ""]),
  };
  const datos = r.hojas.map((h): Hoja => {
    const claves = [...new Set(h.filas.flatMap((f) => Object.keys(f)))];
    return {
      nombre: HOJAS_RESPALDO[h.nombre]?.[0] ?? titulo(h.nombre),
      // Sin filas no se conocen las columnas: una sola que lo dice (hallazgo de T20).
      columnas: claves.length ? claves.map((k) => ({ titulo: titulo(k), tipo: tipoDe(k, h.filas.slice(0, 50).map((f) => f[k])) }))
        : [{ titulo: "Sin registros", tipo: "texto" }],
      filas: h.filas.map((f) => claves.map((k) => {
        const v = f[k];
        return v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : (v as Valor);
      })),
    };
  });
  return [indice, ...datos];
}

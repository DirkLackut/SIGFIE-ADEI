/**
 * Escritor de Excel (.xlsx) para las exportaciones de la spec 003 (D33, plan §5b).
 *
 * Un .xlsx es un zip con unos pocos XML. Aquí se escriben a mano, con los estilos
 * de la marca, y `fflate` los comprime: Vercel Hobby no deja responder más de
 * 4.5 MB (plan §6). Sin plantillas ni dependencias de hojas de cálculo.
 *
 * Los textos van como «cadena en línea» (inlineStr): así un código o una cédula
 * nunca se convierten en número (CE-30). Las fechas van como número de serie con
 * formato dd/mm/aaaa, para que Excel las ordene y filtre como fechas.
 */
import { strToU8, zipSync } from "fflate";

export type TipoColumna = "texto" | "codigo" | "entero" | "numero" | "fecha" | "fechaHora";
export interface Columna { titulo: string; tipo: TipoColumna; ancho?: number }
export type Valor = string | number | boolean | null | undefined;
/** Celda con marca: `rojo` solo para notas reprobadas (principio 9). */
export interface Celda { v: Valor; rojo?: boolean; negrita?: boolean }
export type EstiloEncabezado = "titulo" | "subtitulo" | "dato" | "total";
export interface Hoja {
  nombre: string;
  /** Renglones antes de la tabla, cada uno en la columna A. */
  encabezado?: { texto: string; estilo: EstiloEncabezado }[];
  columnas: Columna[];
  filas: (Valor | Celda)[][];
  /** Renglón final, después de uno en blanco. */
  pie?: string;
  impresion?: { horizontal?: boolean };
}

// ---------------------------------------------------------------------------
// Estilos. Los índices de cellXfs que usa cada celda.
// ---------------------------------------------------------------------------
const MARINO = "FF03214C", ROJO = "FFDD0E0E", GRIS = "FF5A6472", TINTA = "FF212529", LINEA = "FFC9D1DD";
const XF = {
  normal: 0, titulo: 1, subtitulo: 2, dato: 3, total: 4, encabezado: 5,
  texto: 6, codigo: 7, cifra: 8, fecha: 9, fechaHora: 10, rojoCifra: 11, rojoTexto: 12, pie: 13, negrita: 14,
} as const;

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
<fonts count="11">
<font><sz val="11"/><color rgb="${TINTA}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="${MARINO}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="12"/><color rgb="${MARINO}"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="${GRIS}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="${MARINO}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="${TINTA}"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="${TINTA}"/><name val="Consolas"/><family val="3"/></font>
<font><b/><sz val="10"/><color rgb="${ROJO}"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="${GRIS}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="${TINTA}"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${MARINO}"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="${LINEA}"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="49" fontId="7" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="164" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="165" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="9" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="10" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Caracteres de control que el XML no admite (todos menos tabulador y saltos de línea).
const PROHIBIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const escapar = (t: string) =>
  t.replace(PROHIBIDOS, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A, B, …, Z, AA, AB… */
export function letraColumna(n: number): string {
  let s = "";
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s;
  return s;
}

/** Días desde el 30/12/1899 (la cuenta de Excel, con su 29/02/1900 inexistente incluido). */
export function serialExcel(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

/** Fecha y hora en Managua como número de serie con fracción del día. */
function serialFechaHora(iso: string): number | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(t).map((x) => [x.type, x.value]));
  const dia = serialExcel(`${p.year}-${p.month}-${p.day}`);
  return dia + (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second)) / 86_400;
}

/** Nombre de hoja válido: sin \ / ? * [ ] :, máximo 31 caracteres, nunca vacío. */
export function nombreHoja(n: string): string {
  const limpio = n.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim();
  return limpio || "Hoja";
}

const referenciaHoja = (n: string) => `'${n.replace(/'/g, "''")}'`;
const esCelda = (x: Valor | Celda): x is Celda => typeof x === "object" && x !== null;

function celdaTexto(ref: string, estilo: number, texto: string): string {
  const t = escapar(texto);
  const espacio = t !== t.trim() ? ' xml:space="preserve"' : "";
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t${espacio}>${t}</t></is></c>`;
}

function celda(ref: string, tipo: TipoColumna, x: Valor | Celda): string {
  const { v, rojo, negrita } = esCelda(x) ? x : { v: x, rojo: false, negrita: false };
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return celdaTexto(ref, rojo ? XF.rojoTexto : XF.texto, v ? "Sí" : "No");
  if ((tipo === "entero" || tipo === "numero") && typeof v === "number" && Number.isFinite(v)) {
    return `<c r="${ref}" s="${rojo ? XF.rojoCifra : negrita ? XF.negrita : XF.cifra}"><v>${v}</v></c>`;
  }
  if (tipo === "fecha" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return `<c r="${ref}" s="${XF.fecha}"><v>${serialExcel(v)}</v></c>`;
  }
  if (tipo === "fechaHora" && typeof v === "string") {
    const s = serialFechaHora(v);
    if (s !== null) return `<c r="${ref}" s="${XF.fechaHora}"><v>${s}</v></c>`;
  }
  const estilo = rojo ? XF.rojoTexto : tipo === "codigo" ? XF.codigo : XF.texto;
  return celdaTexto(ref, estilo, String(v));
}

const ESTILO_ENCABEZADO: Record<EstiloEncabezado, number> = { titulo: XF.titulo, subtitulo: XF.subtitulo, dato: XF.dato, total: XF.total };

function ancho(c: Columna, filas: (Valor | Celda)[][], i: number): number {
  if (c.ancho) return c.ancho;
  if (c.tipo === "fecha") return 12;
  if (c.tipo === "fechaHora") return 17;
  let max = c.titulo.length;
  for (const f of filas.slice(0, 300)) {
    const x = f[i];
    const v = esCelda(x) ? x.v : x;
    if (v !== null && v !== undefined) max = Math.max(max, String(v).length);
  }
  return Math.min(Math.max(max + 2, 6), 50);
}

// ---------------------------------------------------------------------------
// Hoja y libro
// ---------------------------------------------------------------------------

interface Escrita { xml: string; filaEncabezado: number; ultimaFila: number; columnas: number }

function escribirHoja(hoja: Hoja): Escrita {
  // Una hoja sin columnas dejaría referencias como «A1:1», que Excel toma por un
  // archivo dañado (hallazgo de T20). Siempre hay al menos una columna.
  const h: Hoja = hoja.columnas.length ? hoja : { ...hoja, columnas: [{ titulo: "Sin registros", tipo: "texto" }] };
  const enc = h.encabezado ?? [];
  const filaEncabezado = enc.length ? enc.length + 2 : 1;
  const ultimaFila = filaEncabezado + h.filas.length;
  const ultimaCol = letraColumna(h.columnas.length);
  const filas: string[] = [];

  enc.forEach((e, i) => filas.push(`<row r="${i + 1}">${celdaTexto(`A${i + 1}`, ESTILO_ENCABEZADO[e.estilo], e.texto)}</row>`));
  filas.push(`<row r="${filaEncabezado}" ht="30" customHeight="1">${h.columnas
    .map((c, i) => celdaTexto(`${letraColumna(i + 1)}${filaEncabezado}`, XF.encabezado, c.titulo)).join("")}</row>`);
  h.filas.forEach((f, n) => {
    const r = filaEncabezado + 1 + n;
    filas.push(`<row r="${r}">${h.columnas.map((c, i) => celda(`${letraColumna(i + 1)}${r}`, c.tipo, f[i])).join("")}</row>`);
  });
  if (h.pie) {
    const r = ultimaFila + 2;
    filas.push(`<row r="${r}">${celdaTexto(`A${r}`, XF.pie, h.pie)}</row>`);
  }

  const cols = h.columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho(c, h.filas, i)}" customWidth="1"/>`).join("");
  const horizontal = h.impresion?.horizontal ? "landscape" : "portrait";
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${ultimaCol}${Math.max(ultimaFila + (h.pie ? 2 : 0), 1)}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${filaEncabezado}" topLeftCell="A${filaEncabezado + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${filas.join("")}</sheetData>
<autoFilter ref="A${filaEncabezado}:${ultimaCol}${ultimaFila}"/>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="1" orientation="${horizontal}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;CPágina &amp;P de &amp;N</oddFooter></headerFooter>
</worksheet>`;
  return { xml, filaEncabezado, ultimaFila, columnas: h.columnas.length };
}

/** El libro completo, comprimido. */
export function generarXlsx(hojas: Hoja[]): Uint8Array {
  const usados = new Set<string>();
  const nombres = hojas.map((h) => {
    const base = nombreHoja(h.nombre);
    let n = base;
    for (let k = 2; usados.has(n.toLowerCase()); k++) n = `${base.slice(0, 31 - ` (${k})`.length)} (${k})`;
    usados.add(n.toLowerCase());
    return n;
  });
  const escritas = hojas.map(escribirHoja);

  const definidos = escritas.flatMap((e, i) => {
    const ref = referenciaHoja(nombres[i]);
    const col = letraColumna(e.columnas);
    return [
      `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapar(`${ref}!$A$${e.filaEncabezado}:$${col}$${e.ultimaFila}`)}</definedName>`,
      `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${escapar(`${ref}!$${e.filaEncabezado}:$${e.filaEncabezado}`)}</definedName>`,
    ];
  });
  const libro = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${nombres.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
<definedNames>${definidos.join("")}</definedNames>
</workbook>`;
  const relacionesLibro = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nombres
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${nombres.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${nombres.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`;
  const relaciones = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const archivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(tipos),
    "_rels/.rels": strToU8(relaciones),
    "xl/workbook.xml": strToU8(libro),
    "xl/_rels/workbook.xml.rels": strToU8(relacionesLibro),
    "xl/styles.xml": strToU8(ESTILOS),
  };
  escritas.forEach((e, i) => { archivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(e.xml); });
  return zipSync(archivos, { level: 6 });
}

/** El tipo MIME con que se descarga. */
export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

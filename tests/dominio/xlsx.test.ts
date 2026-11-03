import { describe, test, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { generarXlsx, serialExcel, nombreHoja, type Hoja } from "@/dominio/xlsx";

const abrir = (bytes: Uint8Array) => {
  const z = unzipSync(bytes);
  return Object.fromEntries(Object.entries(z).map(([k, v]) => [k, strFromU8(v)]));
};
const base: Hoja = {
  nombre: "Resultado",
  encabezado: [
    { texto: "ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI", estilo: "titulo" },
    { texto: "Listado de inscripciones", estilo: "subtitulo" },
    { texto: "Criterios: Modalidad: Sabatino", estilo: "dato" },
    { texto: "Total: 2 registros. El listado está completo.", estilo: "total" },
  ],
  columnas: [
    { titulo: "N.º", tipo: "entero" }, { titulo: "Código ADEI", tipo: "codigo" }, { titulo: "Cédula", tipo: "codigo" },
    { titulo: "Apellidos y nombres", tipo: "texto" }, { titulo: "Inicio", tipo: "fecha" }, { titulo: "Final", tipo: "numero" },
  ],
  filas: [
    [1, "ADEI-2026-00001", "001-010190-0001A", "Castillo & Rivas <PRUEBA>", "2026-09-26", { v: 76, rojo: true }],
    [2, "ADEI-2026-00002", null, "Gómez\u0007 Ortiz", "2026-10-03", 88],
  ],
  pie: "Fin del listado: 2 de 2 registros.",
  impresion: { horizontal: true },
};

describe("el archivo es un .xlsx válido (CE-24)", () => {
  test("tiene las partes que Excel exige", () => {
    const f = abrir(generarXlsx([base]));
    for (const k of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
      expect(f, k).toHaveProperty([k]);
    }
    expect(f["xl/workbook.xml"]).toContain('<sheet name="Resultado" sheetId="1" r:id="rId1"/>');
    expect(f["[Content_Types].xml"]).toContain("/xl/worksheets/sheet1.xml");
  });

  test("empieza con la firma de un zip y va comprimido", () => {
    const b = generarXlsx([base]);
    expect([b[0], b[1]]).toEqual([0x50, 0x4b]);   // «PK»
  });

  test("varias hojas con nombres únicos y válidos", () => {
    const f = abrir(generarXlsx([base, { ...base, nombre: "Resultado" }, { ...base, nombre: "Hoja/con:raros*[]?" }]));
    expect(f["xl/workbook.xml"]).toMatch(/name="Resultado"[\s\S]*name="Resultado \(2\)"[\s\S]*name="Hoja con raros"/);
    expect(f).toHaveProperty(["xl/worksheets/sheet3.xml"]);
  });

  test("nombre de hoja: máximo 31 caracteres y sin caracteres prohibidos", () => {
    expect(nombreHoja("Una hoja con un nombre demasiado largo para Excel")).toHaveLength(31);
    expect(nombreHoja("a/b\\c?d*e[f]g:h")).toBe("a b c d e f g h");
    expect(nombreHoja("   ")).toBe("Hoja");
  });
});

describe("tipos de celda (CE-30)", () => {
  const hoja = () => abrir(generarXlsx([base]))["xl/worksheets/sheet1.xml"];

  test("los códigos y cédulas van como texto, para que Excel no los altere", () => {
    expect(hoja()).toMatch(/<c r="B7" s="\d+" t="inlineStr"><is><t>ADEI-2026-00001<\/t><\/is><\/c>/);
    expect(hoja()).toMatch(/<c r="C7" s="\d+" t="inlineStr"><is><t>001-010190-0001A<\/t><\/is><\/c>/);
  });

  test("las fechas van como fechas (número de serie con formato dd/mm/aaaa)", () => {
    expect(hoja()).toContain(`<c r="E7" s="`);
    expect(hoja()).toMatch(new RegExp(`<c r="E7" s="(\\d+)"><v>${serialExcel("2026-09-26")}</v></c>`));
    const estilos = abrir(generarXlsx([base]))["xl/styles.xml"];
    expect(estilos).toContain('formatCode="dd/mm/yyyy"');
  });

  test("las notas van como números", () => {
    expect(hoja()).toMatch(/<c r="F8" s="\d+"><v>88<\/v><\/c>/);
  });

  test("el rojo solo donde se marca (nota reprobada)", () => {
    const h = hoja();
    const rojo = /<c r="F7" s="(\d+)"/.exec(h)![1];
    const normal = /<c r="F8" s="(\d+)"/.exec(h)![1];
    expect(rojo).not.toBe(normal);
    const estilos = abrir(generarXlsx([base]))["xl/styles.xml"];
    expect(estilos.match(/FFDD0E0E/g)).toHaveLength(1);   // un solo color rojo en todo el libro: el de la marca
  });

  test("una celda vacía no se escribe", () => {
    expect(hoja()).not.toContain('r="C8"');
  });

  test("el texto se escapa y se limpian los caracteres que rompen el XML", () => {
    expect(hoja()).toContain("Castillo &amp; Rivas &lt;PRUEBA&gt;");
    expect(hoja()).toContain("Gómez Ortiz");
    expect(hoja()).not.toContain("\u0007");
  });

  test("serial de Excel: días desde el 30/12/1899", () => {
    expect(serialExcel("1900-03-01")).toBe(61);
    expect(serialExcel("2026-11-02")).toBe(46328);
  });
});

describe("presentación (plan §5b)", () => {
  const f = () => abrir(generarXlsx([base]));

  test("encabezado de ADEI, encabezado de columnas en la fila siguiente a una en blanco y pie al final", () => {
    const h = f()["xl/worksheets/sheet1.xml"];
    expect(h).toContain("ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI");
    expect(h).toMatch(/<row r="6"[^>]*>.*Código ADEI/);
    expect(h).toMatch(/<row r="10"[^>]*>.*Fin del listado: 2 de 2 registros\./);
  });

  test("encabezado fijo al bajar, autofiltro en la tabla y anchos de columna", () => {
    const h = f()["xl/worksheets/sheet1.xml"];
    expect(h).toContain('<pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/>');
    expect(h).toContain('<autoFilter ref="A6:F8"/>');
    expect(h).toMatch(/<cols>(<col [^>]+customWidth="1"\/>){6}<\/cols>/);
    expect(f()["xl/workbook.xml"]).toContain(`<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Resultado'!$A$6:$F$8</definedName>`);
  });

  test("impresión: carta, horizontal, ajustada al ancho, encabezado repetido y «Página N de M»", () => {
    const h = f()["xl/worksheets/sheet1.xml"];
    expect(h).toContain('<pageSetUpPr fitToPage="1"/>');
    expect(h).toContain('paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="0"');
    expect(h).toContain("<oddFooter>&amp;CPágina &amp;P de &amp;N</oddFooter>");
    expect(f()["xl/workbook.xml"]).toContain(`<definedName name="_xlnm.Print_Titles" localSheetId="0">'Resultado'!$6:$6</definedName>`);
  });

  test("letra Calibri y encabezado de columnas marino con letra blanca", () => {
    const e = f()["xl/styles.xml"];
    expect(e).toContain('<name val="Calibri"/>');
    expect(e).toContain('<fgColor rgb="FF03214C"/>');
    expect(e).toMatch(/<color rgb="FFFFFFFF"\/>/);
  });

  test("una hoja sin encabezado empieza la tabla en la fila 1 (hojas del respaldo)", () => {
    const h = abrir(generarXlsx([{ nombre: "Datos", columnas: [{ titulo: "A", tipo: "texto" }], filas: [["x"]] }]))["xl/worksheets/sheet1.xml"];
    expect(h).toMatch(/<row r="1"[^>]*><c r="A1"/);
    expect(h).toContain('<pane ySplit="1" topLeftCell="A2"');
  });
});

describe("tamaño (plan §6: Vercel Hobby responde hasta 4.5 MB)", () => {
  test("20,000 renglones de 15 columnas caben comprimidos", () => {
    const columnas = Array.from({ length: 15 }, (_, i) => ({ titulo: `Columna ${i + 1}`, tipo: i === 0 ? "entero" as const : i === 10 ? "fecha" as const : "texto" as const }));
    const filas = Array.from({ length: 20_000 }, (_, n) => columnas.map((c, i) =>
      c.tipo === "entero" ? n + 1 : c.tipo === "fecha" ? "2026-10-01" : `Valor ${i} del renglón ${n % 700}`));
    const b = generarXlsx([{ nombre: "Grande", columnas, filas }]);
    expect(b.length).toBeLessThan(4.5e6);
  });
});

describe("hoja sin columnas (hallazgo de T20: respaldo con Tutores vacío)", () => {
  test("nunca escribe referencias inválidas como «A1:1» ni <cols> vacío", () => {
    const h = abrir(generarXlsx([{ nombre: "Vacía", columnas: [], filas: [] }]))["xl/worksheets/sheet1.xml"];
    expect(h).not.toMatch(/ref="A1:\d/);
    expect(h).not.toContain("<cols></cols>");
    expect(h).toMatch(/<dimension ref="A1(:[A-Z]+\d+)?"\/>/);
    for (const m of h.matchAll(/ref="([^"]+)"/g)) expect(m[1]).toMatch(/^[A-Z]{1,3}\d+(:[A-Z]{1,3}\d+)?$/);
  });
});


/**
 * Verifica que las combinaciones de color declaradas en globals.css se puedan
 * leer. Lee el CSS real, no una copia: si alguien cambia un token, el test lo
 * detecta. Umbrales de WCAG 2.1: 4.5:1 para texto normal, 3:1 para texto grande
 * y para bordes o íconos que transmiten información.
 */
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf8");

function token(nombre: string): string {
  const m = css.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`falta el token --color-${nombre} en globals.css`);
  return m[1];
}

/** Luminancia relativa según WCAG 2.1 */
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const casos: [string, string, string, number][] = [
  // [descripción, color de texto, fondo, mínimo] — plan §14
  ["tinta sobre papel", "tinta", "papel", 4.5],
  ["tinta sobre fondo de la app", "tinta", "papel-alt", 4.5],
  ["texto secundario sobre papel", "tinta-suave", "papel", 4.5],
  ["texto secundario sobre fondo de la app", "tinta-suave", "papel-alt", 4.5],
  ["blanco sobre marino (encabezado, botón principal)", "papel", "marino", 4.5],
  ["marino sobre marino suave (títulos, pestaña activa)", "marino", "marino-suave", 4.5],
  ["enlace azul sobre papel", "azul", "papel", 4.5],
  ["enlace azul sobre fondo de la app", "azul", "papel-alt", 4.5],
  ["enlace azul sobre marino suave", "azul", "marino-suave", 4.5],
  ["éxito (cian) sobre papel", "cian", "papel", 4.5],
  ["éxito (cian) sobre cian suave", "cian", "cian-suave", 4.5],
  ["advertencia (dorado oscuro) sobre papel", "dorado-texto", "papel", 4.5],
  ["advertencia (dorado oscuro) sobre dorado suave", "dorado-texto", "dorado-suave", 4.5],
  ["nota reprobada sobre papel", "reprobado", "papel", 4.5],
  ["nota reprobada sobre fondo de la app", "reprobado", "papel-alt", 4.5],
  ["celeste sobre marino (detalles)", "celeste", "marino", 4.5],
  ["marino sobre verde (ícono de éxito)", "marino", "verde", 4.5],
];

test.each(casos)("%s se puede leer", (_d, texto, fondo, minimo) => {
  expect(contraste(token(texto), token(fondo))).toBeGreaterThanOrEqual(minimo);
});

// Bordes e íconos que transmiten información sobre blanco (WCAG, 3:1).
test.each([["azul"], ["cian"], ["dorado"], ["marino"]])("%s sirve de borde o ícono sobre papel", (c) => {
  expect(contraste(token(c), token("papel"))).toBeGreaterThanOrEqual(3);
});

// El verde y el celeste del manual son claros: NO alcanzan para texto sobre blanco.
// Si alguien los usa como texto, este test recuerda por qué no.
test.each([["verde"], ["celeste"]])("%s no se usa como texto sobre papel", (c) => {
  expect(contraste(token(c), token("papel"))).toBeLessThan(4.5);
});

// Los colores son los del manual de ADEI, no aproximaciones.
test("la paleta es la del Manual de Identidad Corporativa", () => {
  expect([token("marino"), token("azul"), token("celeste"), token("verde"), token("cian"), token("dorado"), token("reprobado")].map((x) => x.toLowerCase()))
    .toEqual(["#03214c", "#3b5a9e", "#3f95ff", "#05c167", "#00545a", "#a57e14", "#dd0e0e"]);
});

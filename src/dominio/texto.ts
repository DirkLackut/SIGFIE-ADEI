import { type Resultado, valido, invalido } from "./resultado";

/**
 * Forma de comparar textos sin que importen mayúsculas, tildes ni espacios de
 * más. "  GUTIÉRREZ " y "gutierrez" quedan iguales.
 *
 * Debe dar exactamente lo mismo que la función normalizar() de la base de datos
 * (lower + unaccent + espacios), porque la unicidad de los catálogos (CE-22) y la
 * búsqueda (CE-42) se deciden allá. T5 prueba que las dos coinciden.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "") // quita tildes y diéresis: é → e, ñ → n, ü → u
    .toLowerCase()
    .replace(/[øßæœłđðþı]/g, (c) => LETRAS_PROPIAS[c])
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Letras que no son "letra + tilde" y por eso no las limpia normalize("NFD"),
 * pero que unaccent de PostgreSQL sí traduce. Sin esta tabla, "Łukasz" no se
 * encontraría buscando "lukasz" (medido contra PGlite el 29-oct).
 */
const LETRAS_PROPIAS: Record<string, string> = {
  ø: "o", ß: "ss", æ: "ae", œ: "oe", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i",
};

/** Deja un texto con espacios simples y sin espacios al borde, sin tocar lo demás. */
export function limpiarEspacios(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

const LETRAS = /^[\p{L}' ]+$/u;

/** Nombres y apellidos del diccionario de datos: 2 a 60 caracteres, solo letras,
 *  espacios, tildes y apóstrofos ("D'Arbelles", casos límite de la spec). */
export function validarNombre(texto: string): Resultado {
  const v = limpiarEspacios(texto);
  if (v.length < 2 || v.length > 60) return invalido("Debe tener entre 2 y 60 caracteres.");
  if (!LETRAS.test(v)) return invalido("Solo puede contener letras, espacios, tildes y apóstrofos.");
  return valido(v);
}

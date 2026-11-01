import { type Resultado, valido, invalido } from "./resultado";

/** Formato del diccionario de datos: ###-######-####L */
const FORMATO = /^\d{3}-\d{6}-\d{4}[A-Z]$/;

/**
 * Valida una cédula nicaragüense y la deja en su forma guardada: sin espacios al
 * borde y con la letra final en mayúscula (CE-76).
 *
 * No acepta la cédula sin guiones: la spec pide el formato del diccionario (CE-37).
 */
export function validarCedula(texto: string): Resultado {
  const v = texto.trim().toUpperCase();
  if (!FORMATO.test(v)) {
    return invalido(
      "Debe tener el formato 000-000000-0000A: tres grupos de dígitos separados por guiones y una letra final.",
    );
  }
  return valido(v);
}

/** Forma de buscar una cédula escrita con o sin guiones (CE-42). Debe coincidir
 *  con lo que la columna de búsqueda de la base guarda para la cédula. */
export function cedulaParaBuscar(texto: string): string {
  return texto.replace(/[-\s]/g, "").toLowerCase();
}

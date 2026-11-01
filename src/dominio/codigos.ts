/**
 * Formato de los códigos que genera el sistema. El número correlativo lo da la
 * base de datos (tabla correlativo, T5); aquí solo se le da forma.
 */

function rellenar(n: number, digitos: number, que: string): string {
  if (!Number.isInteger(n) || n < 1 || n >= 10 ** digitos) {
    throw new Error(`El correlativo ${n} no cabe en el formato del código de ${que} (${digitos} dígitos).`);
  }
  return String(n).padStart(digitos, "0");
}

/** CE-29, CE-99: PREFIJO-AAAA-NNNNN. Para ADEI: ADEI-2026-00001. */
export function codigoEstudiante(prefijoOrganizacion: string, anio: number, n: number): string {
  if (!/^[A-Z]{2,10}$/.test(prefijoOrganizacion)) {
    throw new Error(`El prefijo de organización "${prefijoOrganizacion}" debe ser de 2 a 10 letras mayúsculas.`);
  }
  return `${prefijoOrganizacion}-${anio}-${rellenar(n, 5, "estudiante")}`;
}

/** CE-48, CE-99: G-AAAA-NNNN, sin prefijo de organización. */
export function codigoGrupo(anio: number, n: number): string {
  return `G-${anio}-${rellenar(n, 4, "grupo")}`;
}

/**
 * Cédulas y teléfonos con solo sus últimos 4 caracteres visibles (spec 003, CE-94,
 * D37). La bitácora se enmascara en la base (interno.enmascarar); esta es la misma
 * regla, con los mismos casos de prueba, para lo que la pantalla escriba por su cuenta.
 */
export function enmascarar(texto: string): string {
  return texto
    .replace(/\d{3}-\d{6}-\d(\d{3}[A-Za-z])/g, "***-******-*$1")
    .replace(/(?<![0-9A-Za-z-])\d{4}(\d{4})(?![0-9A-Za-z-])/g, "****$1");
}

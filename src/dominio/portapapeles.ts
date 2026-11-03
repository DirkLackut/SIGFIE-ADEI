/**
 * Copiar un texto (la contraseña temporal, 001·CE-8). El portapapeles moderno puede
 * estar negado (navegador integrado de una aplicación, página sin permiso); entonces se
 * intenta con la selección, y si tampoco se puede, la pantalla pide copiarlo a mano
 * (hallazgo 3 de T23). Nunca falla en silencio.
 */
export type Portapapeles = {
  escribir?: (texto: string) => Promise<void>;
  conSeleccion: () => boolean;   // selecciona el texto en pantalla y ejecuta «copiar»
};

export async function copiarTexto(texto: string, p: Portapapeles): Promise<"copiado" | "manual"> {
  if (p.escribir) {
    try { await p.escribir(texto); return "copiado"; } catch { /* se intenta con la selección */ }
  }
  try { return p.conSeleccion() ? "copiado" : "manual"; } catch { return "manual"; }
}

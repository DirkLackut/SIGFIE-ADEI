/**
 * Encabezados de seguridad de las respuestas (CE-102, CE-103; plan D23).
 * Hallazgo de las pruebas de seguridad (T34, OWASP A02): faltaban.
 *
 * La política de contenido (CSP) lleva un nonce distinto en cada respuesta: solo
 * se ejecutan los scripts que Next marca con ese nonce. Si alguien lograra meter
 * un <script> en una página, el navegador no lo ejecutaría.
 */

/** Los que no cambian entre respuestas. Se aplican a todo, incluidos los archivos. */
export const ENCABEZADOS_FIJOS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/**
 * Política de contenido de una página.
 * - Scripts: solo los que llevan el nonce (y los que esos carguen: 'strict-dynamic').
 * - Estilos: 'unsafe-inline' porque las animaciones (motion) y los avisos
 *   (sonner) escriben estilos en el elemento. Un estilo no ejecuta código.
 * - Conexiones: el propio sitio y la URL de Supabase.
 * - Nadie puede mostrar el sistema dentro de otra página (frame-ancestors).
 * En desarrollo, Next necesita 'unsafe-eval' para recargar el código en caliente.
 */
export function politicaDeContenido(nonce: string, urlSupabase: string, desarrollo = false): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) throw new Error("Nonce inválido.");
  const supabase = new URL(urlSupabase).origin;
  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(desarrollo ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directivas).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

/** Un nonce nuevo: 16 bytes aleatorios en base64. */
export function nuevoNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

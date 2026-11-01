import { describe, expect, test } from "vitest";
import { ENCABEZADOS_FIJOS, nuevoNonce, politicaDeContenido } from "@/dominio/seguridad";

const directiva = (csp: string, nombre: string) => csp.split("; ").find((d) => d.startsWith(nombre + " "));

describe("CE-102 · política de contenido (CSP)", () => {
  const csp = politicaDeContenido("abcdefghijklmnop1234==", "https://proyecto-ejemplo.supabase.co/");

  test("solo ejecuta scripts con el nonce de la respuesta", () => {
    expect(directiva(csp, "script-src")).toBe("script-src 'self' 'nonce-abcdefghijklmnop1234==' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
  });
  test("prohíbe mostrar el sistema dentro de otra página (clickjacking)", () => {
    expect(directiva(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });
  test("solo se conecta al propio sitio y a Supabase", () => {
    expect(directiva(csp, "connect-src")).toBe("connect-src 'self' https://proyecto-ejemplo.supabase.co");
  });
  test("sin plugins, sin cambiar la base de los enlaces y formularios solo al propio sitio", () => {
    expect(directiva(csp, "object-src")).toBe("object-src 'none'");
    expect(directiva(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directiva(csp, "form-action")).toBe("form-action 'self'");
  });
  test("en desarrollo permite eval para la recarga en caliente", () => {
    expect(directiva(politicaDeContenido("abcdefghijklmnop1234==", "http://localhost:54321", true), "script-src")).toContain("'unsafe-eval'");
  });
  test("no acepta un nonce que pueda romper el encabezado", () => {
    expect(() => politicaDeContenido("abc'; script-src *", "http://localhost:54321")).toThrow();
  });
});

describe("nonce", () => {
  test("es distinto en cada respuesta y tiene 16 bytes", () => {
    const a = nuevoNonce(), b = nuevoNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});

describe("CE-103 · encabezados fijos", () => {
  const h = Object.fromEntries(ENCABEZADOS_FIJOS.map((e) => [e.key, e.value]));
  test("los cinco encabezados de la recomendación de OWASP", () => {
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });
});

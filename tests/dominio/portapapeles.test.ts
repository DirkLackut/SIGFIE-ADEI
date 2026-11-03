/**
 * Hallazgo 3 de T23 (001·CE-8): «Copiar» no hacía nada cuando el navegador negaba el
 * portapapeles (por ejemplo, el navegador integrado de una aplicación). Ahora intenta
 * con la selección y, si tampoco puede, lo dice para que se copie a mano.
 */
import { describe, test, expect } from "vitest";
import { copiarTexto } from "@/dominio/portapapeles";

describe("copiarTexto", () => {
  test("con portapapeles disponible, copia", async () => {
    let copiado = "";
    expect(await copiarTexto("ab12", { escribir: async (t) => { copiado = t; }, conSeleccion: () => false })).toBe("copiado");
    expect(copiado).toBe("ab12");
  });

  test("si el portapapeles lo niega, intenta copiar la selección", async () => {
    expect(await copiarTexto("ab12", { escribir: async () => { throw new Error("NotAllowedError"); }, conSeleccion: () => true })).toBe("copiado");
  });

  test("sin portapapeles y sin selección, avisa que se copie a mano", async () => {
    expect(await copiarTexto("ab12", { escribir: undefined, conSeleccion: () => false })).toBe("manual");
    expect(await copiarTexto("ab12", { escribir: async () => { throw new Error("x"); }, conSeleccion: () => { throw new Error("y"); } })).toBe("manual");
  });
});

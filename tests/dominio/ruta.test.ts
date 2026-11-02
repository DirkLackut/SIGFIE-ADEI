import { describe, test, expect } from "vitest";
import { posicionEnRuta } from "@/dominio/ruta";

describe("ruta de un nivel (D28, CE-54, CE-55)", () => {
  test("CE-54 · el Curso principal va del 1 al 16 en una sola ruta", () => {
    expect(posicionEnRuta("Curso principal", 1)).toEqual({ ruta: "Curso principal", posicion: 1 });
    expect(posicionEnRuta("Curso principal", 16)).toEqual({ ruta: "Curso principal", posicion: 16 });
  });

  test("CE-54 · Conversation Avanzada sigue después de todo Conversation", () => {
    const ultimoConversation = posicionEnRuta("Conversation", 7);
    const primeroAvanzada = posicionEnRuta("Conversation Avanzada", 1);
    expect(primeroAvanzada.ruta).toBe(ultimoConversation.ruta);
    expect(primeroAvanzada.posicion).toBeGreaterThan(ultimoConversation.posicion);
  });

  test("CE-54 · Especial y Curso de niños son rutas propias: no se comparan con el Curso principal", () => {
    expect(posicionEnRuta("Especial", 1).ruta).not.toBe(posicionEnRuta("Curso principal", 1).ruta);
    expect(posicionEnRuta("Curso de niños", 2).ruta).toBe("Curso de niños");
  });

  test("da lo mismo que interno.ruta e interno.posicion de la 012", () => {
    expect(posicionEnRuta("Conversation Avanzada", 2)).toEqual({ ruta: "Conversation", posicion: 102 });
    expect(posicionEnRuta("Conversation", 3)).toEqual({ ruta: "Conversation", posicion: 3 });
  });
});

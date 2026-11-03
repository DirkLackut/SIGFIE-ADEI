import { test, expect } from "vitest";
import { paginar } from "@/dominio/impresion";

test("CE-29 · las filas se reparten en hojas y nada se pierde; sin filas, una hoja vacía", () => {
  const h = paginar(Array.from({ length: 53 }, (_, i) => i + 1), 24);
  expect(h.map((x) => x.length)).toEqual([24, 24, 5]);
  expect(h.flat()).toEqual(Array.from({ length: 53 }, (_, i) => i + 1));
  expect(paginar([], 24)).toEqual([[]]);
});

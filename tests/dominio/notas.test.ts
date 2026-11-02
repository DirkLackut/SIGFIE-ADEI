import { describe, test, expect } from "vitest";
import {
  calcularNota, estadoAcademico, enFranja, leerValorParcial, type ParcialCapturado, type ReglaAplicable,
} from "@/dominio/notas";
import { VECTORES_DE_NOTAS, type Entrada } from "../apoyo/vectores-notas";

const capturar = (entradas: Entrada[]): (ParcialCapturado | null)[] => entradas.map((v) =>
  v === null ? null : typeof v === "number" ? { condicion: "Registrado", valor: v } : { condicion: v, valor: null });

const REGLA_80: ReglaAplicable = { notaMinima: 80, condicionadoDesde: 77 };

describe("cálculo de la nota, con los mismos vectores que la vista de la base (D25)", () => {
  for (const v of VECTORES_DE_NOTAS) {
    test(v.caso, () => {
      const n = calcularNota(capturar(v.parciales));
      expect(n.exacta).toBe(v.exacta);
      expect(n.final).toBe(v.final);
      expect(n.provisional).toBe(v.provisional);
      expect(n.requiereRetiro).toBe(v.requiereRetiro);
      expect(n.faltan).toEqual(v.faltan);
      expect(estadoAcademico(n, REGLA_80)).toBe(v.estadoCon80);
      expect(enFranja(n, REGLA_80)).toBe(v.enFranja);
    });
  }

  test("CE-34 · un parcial Reprogramado cuenta con su nota, como uno Registrado", () => {
    const n = calcularNota([{ condicion: "Registrado", valor: 90 }, { condicion: "Reprogramado", valor: 84 },
      { condicion: "Registrado", valor: 90 }]);
    expect(n.final).toBe(88);
  });

  test("CE-17 · la mitad sube con cualquier par de enteros (x.5 → x + 1)", () => {
    for (let a = 0; a <= 100; a++) {
      const n = calcularNota([{ condicion: "Registrado", valor: a }, { condicion: "Registrado", valor: Math.min(a + 1, 100) },
        { condicion: "Justificado", valor: null }]);
      expect(n.final).toBe(Math.min(a + 1, 100));
    }
  });
});

describe("estado académico (CE-19 a CE-23, CE-29, CE-38 a CE-40)", () => {
  const completa = calcularNota(capturar([76, 76, 76]));

  test("CE-19, CE-20 · el mismo 76 aprueba con la regla de 75 y reprueba con la de 80", () => {
    expect(estadoAcademico(completa, { notaMinima: 75, condicionadoDesde: 72 })).toBe("Aprobado");
    expect(estadoAcademico(completa, REGLA_80)).toBe("Reprobado");
  });

  test("CE-23 · sin regla queda Pendiente", () => {
    expect(estadoAcademico(completa, null)).toBe("Pendiente");
  });

  test("CE-29 · condicionado manda sobre el cálculo", () => {
    expect(estadoAcademico(calcularNota(capturar([78, 78, 78])), REGLA_80, { condicionado: true })).toBe("Condicionado");
  });

  test("CE-39 · la baja por inasistencia es Reprobado", () => {
    expect(estadoAcademico(calcularNota(capturar([95, 95, "No presentado"])), REGLA_80, { bajaInasistencia: true })).toBe("Reprobado");
  });

  test("CE-38, CE-40 · Retirada y Trasladada no tienen estado", () => {
    for (const estadoInscripcion of ["Retirada", "Trasladada"] as const)
      expect(estadoAcademico(completa, REGLA_80, { estadoInscripcion })).toBeNull();
  });

  test("CE-30 · sin franja en la regla, nunca está en la franja", () => {
    expect(enFranja(calcularNota(capturar([78, 78, 78])), { notaMinima: 80, condicionadoDesde: null })).toBe(false);
  });
});

describe("lo que escribe el profesor en un parcial (CE-8, RN-03)", () => {
  test("CE-8 · acepta enteros de 0 a 100, con espacios alrededor", () => {
    expect(leerValorParcial(" 85 ")).toEqual({ ok: true, valor: 85 });
    expect(leerValorParcial("0")).toEqual({ ok: true, valor: 0 });
    expect(leerValorParcial("100")).toEqual({ ok: true, valor: 100 });
  });

  test("CE-8 · rechaza decimales, texto, negativos, más de 100 y vacío", () => {
    for (const t of ["85.5", "85,5", "abc", "-1", "101", "769", "", "1e2"])
      expect(leerValorParcial(t).ok, t).toBe(false);
  });
});

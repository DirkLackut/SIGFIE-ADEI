/** Formatos de presentación (diccionario de datos: fechas dd/mm/aaaa). */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-NI", { timeZone: "America/Managua", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** 13:30:00 → 1:30 p. m. — como se escriben los horarios en la academia. */
export function hora(h: string): string {
  const [hh, mm] = h.split(":").map(Number);
  const sufijo = hh < 12 ? "a. m." : "p. m.";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${sufijo}`;
}

export const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** 88123456 → 8812 3456: así se dictan y se leen los números en Nicaragua. */
export function telefono(t: string | null | undefined): string | null {
  if (!t) return null;
  return /^\d{8}$/.test(t) ? `${t.slice(0, 4)} ${t.slice(4)}` : t;
}

/** ADEI-2026-00012: lo único que viaja en la dirección al pasar de un expediente
 *  a elegir grupo (ni nombre ni cédula en la URL). */
export const esCodigoAdei = (v: unknown): v is string => typeof v === "string" && /^ADEI-\d{4}-\d{5}$/.test(v);

/** Nombre de una sucursal en las listas: la sede central se señala igual en todos
 *  los formularios («Altamira (central)»). */
export const opcionSucursal = (s: { id: string; nombre: string; es_central: boolean }) =>
  ({ valor: s.id, texto: s.es_central ? `${s.nombre} (central)` : s.nombre });

/** "1 resultado", "0 resultados", "1,250 resultados". */
export function cantidad(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("es-NI")} ${n === 1 ? singular : plural}`;
}

/**
 * Campos de formulario (T19). Cada campo tiene: etiqueta visible arriba, una
 * ayuda con el formato esperado y, si falla, el mensaje de la regla incumplida
 * debajo (CE-37). El valor escrito se conserva siempre: nunca se borra lo ya
 * ingresado por un error.
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

interface Base {
  nombre: string;
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  requerido?: boolean;
}

function Envoltura({ nombre, etiqueta, ayuda, error, requerido, children }: Base & { children: ReactNode }) {
  const idAyuda = ayuda ? `${nombre}-ayuda` : undefined;
  const idError = error ? `${nombre}-error` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={nombre} className="mb-1 block text-sm font-semibold">
        {etiqueta}
        {requerido ? <span className="text-dorado-texto" aria-hidden> *</span> : <span className="font-normal text-tinta-suave"> (opcional)</span>}
      </label>
      {children}
      {error && (
        <p id={idError} className="mt-1 flex gap-1.5 text-sm font-medium text-dorado-texto">
          <span aria-hidden>⚠</span><span>{error}</span>
        </p>
      )}
      {ayuda && !error && <p id={idAyuda} className="mt-1 text-xs text-tinta-suave">{ayuda}</p>}
    </div>
  );
}

const describe = (nombre: string, ayuda?: ReactNode, error?: string) =>
  [error ? `${nombre}-error` : null, ayuda && !error ? `${nombre}-ayuda` : null].filter(Boolean).join(" ") || undefined;

export function Campo({ nombre, etiqueta, ayuda, error, requerido, ...resto }:
  Base & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "required">) {
  return (
    <Envoltura {...{ nombre, etiqueta, ayuda, error, requerido }}>
      <input id={nombre} name={nombre} required={requerido} className="campo-entrada"
             aria-invalid={error ? true : undefined} aria-describedby={describe(nombre, ayuda, error)} {...resto} />
    </Envoltura>
  );
}

export function Selector({ nombre, etiqueta, ayuda, error, requerido, opciones, vacio = "Seleccione…", ...resto }:
  Base & { opciones: { valor: string; texto: string }[]; vacio?: string }
  & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "id" | "required">) {
  return (
    <Envoltura {...{ nombre, etiqueta, ayuda, error, requerido }}>
      <select id={nombre} name={nombre} required={requerido} className="campo-entrada"
              aria-invalid={error ? true : undefined} aria-describedby={describe(nombre, ayuda, error)} {...resto}>
        <option value="">{vacio}</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </Envoltura>
  );
}

export function AreaTexto({ nombre, etiqueta, ayuda, error, requerido, ...resto }:
  Base & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id" | "required">) {
  return (
    <Envoltura {...{ nombre, etiqueta, ayuda, error, requerido }}>
      <textarea id={nombre} name={nombre} required={requerido} rows={3} className="campo-entrada"
                aria-invalid={error ? true : undefined} aria-describedby={describe(nombre, ayuda, error)} {...resto} />
    </Envoltura>
  );
}

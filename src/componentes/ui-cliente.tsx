"use client";
/** Piezas que necesitan el navegador: estado de envío y mostrar contraseña. */
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { claseBoton, type EstiloBoton, type TamanoBoton } from "./ui";

/** Botón de envío que se desactiva y cambia de texto mientras se guarda: evita
 *  el doble clic que registraría dos veces lo mismo. */
export function BotonEnviar({ children, enviando = "Guardando…", estilo = "primario", nombre, valor, tamano }: {
  children: ReactNode; enviando?: string; estilo?: EstiloBoton; nombre?: string; valor?: string; tamano?: TamanoBoton;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={nombre} value={valor} disabled={pending} className={claseBoton(estilo, tamano)} aria-live="polite">
      {pending ? enviando : children}
    </button>
  );
}

/** Para lo que no se deshace con un clic (eliminar, quitar, desactivar una cuenta):
 *  el primer clic solo pregunta, en el mismo lugar y con el nombre de lo que se va
 *  a afectar; el segundo envía el formulario que lo contiene. Sin ventanas
 *  emergentes del navegador, que en el celular se confunden con avisos del sistema. */
export function BotonConfirmar({ children, pregunta, confirmar, enviando = "…", pequeno = false }: {
  children: ReactNode; pregunta: ReactNode; confirmar: string; enviando?: string; pequeno?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const clase = (e: EstiloBoton) => claseBoton(e, pequeno ? "pequeno" : "normal");
  if (!abierto) return <button type="button" className={clase("cuidado")} onClick={() => setAbierto(true)}>{children}</button>;
  return (
    <span role="group" aria-label="Confirmar" className="aparecer inline-flex flex-wrap items-center gap-2 rounded-md bg-dorado-suave px-2 py-1.5 text-sm">
      <span className="font-medium">{pregunta}</span>
      <BotonConfirmarEnvio clase={clase("cuidado")} enviando={enviando}>{confirmar}</BotonConfirmarEnvio>
      <button type="button" className={clase("secundario")} onClick={() => setAbierto(false)} autoFocus>No</button>
    </span>
  );
}
function BotonConfirmarEnvio({ clase, enviando, children }: { clase: string; enviando: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={clase}>{pending ? enviando : children}</button>;
}

/** React 19 vacía el formulario al terminar cada acción, y con eso se pierden las
 *  listas y casillas elegidas (un <select> vuelve a «Seleccione…» aunque se le pase
 *  defaultValue). Si la acción no salió bien, se cancela ese vaciado: la persona
 *  corrige solo lo marcado y no vuelve a llenar todo. Si salió bien, se vacía. */
export function conservarSiFalla(ok?: boolean) {
  return ok ? undefined : (e: React.FormEvent<HTMLFormElement>) => e.preventDefault();
}

/** Contraseña con botón "Mostrar": en el celular es fácil equivocarse. */
export function CampoContrasena({ nombre, etiqueta, autoComplete, error, ayuda }: {
  nombre: string; etiqueta: string; autoComplete: string; error?: string; ayuda?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={nombre} className="mb-1 block text-sm font-semibold">{etiqueta}<span className="text-dorado-texto" aria-hidden> *</span></label>
      <div className="flex gap-2">
        <input id={nombre} name={nombre} type={visible ? "text" : "password"} required autoComplete={autoComplete}
               className="campo-entrada" aria-invalid={error ? true : undefined}
               aria-describedby={error ? `${nombre}-error` : ayuda ? `${nombre}-ayuda` : undefined} />
        <button type="button" onClick={() => setVisible((v) => !v)} className={claseBoton("secundario") + " shrink-0 px-3"}
                aria-pressed={visible} aria-controls={nombre}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error && <p id={`${nombre}-error`} className="mt-1 flex gap-1.5 text-sm font-medium text-dorado-texto"><span aria-hidden>⚠</span>{error}</p>}
      {ayuda && !error && <p id={`${nombre}-ayuda`} className="mt-1 text-xs text-tinta-suave">{ayuda}</p>}
    </div>
  );
}

/**
 * Piezas visuales comunes (T19). Server Components: no llevan JavaScript al
 * navegador. Lo interactivo está en ui-cliente.tsx.
 */
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------- Marca ---- */

/**
 * Marca del sistema: el emblema oficial de ADEI (de una tinta, toma el color del
 * texto) con «ADEI» en negrita al lado, como en los promocionales del manual.
 * El emblema solo no se lee por debajo de ~96 px: por eso nunca va solo en pequeño.
 * claro = sobre fondo marino.
 */
export function Marca({ claro = false, compacta = false }: { claro?: boolean; compacta?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${claro ? "text-white" : "text-marino"}`}>
      <Emblema className={compacta ? "size-9" : "size-11"} />
      <span className="leading-none">
        <span className="block text-lg font-bold tracking-wide">ADEI</span>
        <span className={`mt-0.5 block text-[0.6875rem] font-semibold tracking-wider ${claro ? "text-white/80" : "text-tinta-suave"}`}>SIGFIE</span>
      </span>
    </span>
  );
}

/**
 * Emblema oficial, extraído en vector del Manual de Identidad Corporativa (versión
 * de una tinta). Se dibuja con el color del texto (currentColor): marino sobre
 * blanco, blanco sobre marino. Un solo archivo en caché para todas las páginas.
 */
export function Emblema({ className = "", titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 210 214" className={`shrink-0 ${className}`}
         role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <use href="/marca/emblema.svg#emblema" width="210" height="214" />
    </svg>
  );
}

/* --------------------------------------------------------------- Títulos --- */

export function TituloPagina({ titulo, descripcion, acciones, volver }: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  volver?: { href: Route; texto: string };
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-borde pb-4">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-1 inline-block text-sm font-medium text-azul hover:underline">
            ← {volver.texto}
          </Link>
        )}
        <h1 className="font-titulo text-2xl font-bold text-marino">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-3xl text-sm text-tinta-suave">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Seccion({ titulo, descripcion, children, acciones }: {
  titulo: string; descripcion?: ReactNode; children: ReactNode; acciones?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-borde bg-papel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
        <div>
          <h2 className="font-semibold">{titulo}</h2>
          {descripcion && <p className="text-sm text-tinta-suave">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * Botones de un formulario largo. En el celular quedan fijos abajo, para que
 * «Registrar» esté a mano sin bajar hasta el final; en la PC van en su lugar.
 */
export function BarraAcciones({ children }: { children: ReactNode }) {
  return <div className="barra-acciones flex flex-wrap gap-3">{children}</div>;
}

/* ---------------------------------------------------------------- Avisos --- */

const ESTILO_ALERTA = {
  info:    { caja: "border-azul/30 bg-marino-suave",   icono: "i", circulo: "bg-azul text-white",      etiqueta: "Información" },
  exito:   { caja: "border-cian/30 bg-cian-suave",     icono: "✓", circulo: "bg-verde text-marino",    etiqueta: "Listo" },
  cuidado: { caja: "border-dorado/50 bg-dorado-suave", icono: "!", circulo: "bg-dorado text-white",    etiqueta: "Atención" },
} as const;

/**
 * Mensaje en una caja. "cuidado" sirve para advertencias y para errores: el rojo
 * no se usa (principio 9). Lo que distingue un error es su título.
 */
export function Alerta({ tipo = "info", titulo, children }: {
  tipo?: keyof typeof ESTILO_ALERTA; titulo?: string; children?: ReactNode;
}) {
  const e = ESTILO_ALERTA[tipo];
  return (
    <div role={tipo === "cuidado" ? "alert" : "status"}
         className={`aparecer flex gap-3 rounded-lg border px-4 py-3 text-sm ${e.caja}`}>
      <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${e.circulo}`}>
        {e.icono}
      </span>
      <div className="min-w-0">
        <p className="sr-only">{e.etiqueta}:</p>
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Insignias -- */

const ESTILO_INSIGNIA = {
  verde: "bg-cian-suave text-cian border-cian/30",
  dorado: "bg-dorado-suave text-dorado-texto border-dorado/30",
  gris: "bg-papel-alt text-tinta-suave border-borde",
} as const;

export function Insignia({ color = "gris", children }: { color?: keyof typeof ESTILO_INSIGNIA; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${ESTILO_INSIGNIA[color]}`}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Enlaces -- */

const ESTILO_BOTON = {
  primario: "bg-marino text-white hover:bg-azul border-transparent",
  secundario: "bg-papel text-tinta border-borde hover:bg-papel-alt",
  cuidado: "bg-papel text-dorado-texto border-dorado hover:bg-dorado-suave",
} as const;
export type EstiloBoton = keyof typeof ESTILO_BOTON;
/** «pequeno» es para acciones dentro de una fila de tabla, donde un botón normal
 *  tapa los datos. Fuera de las tablas, siempre el normal (40 px: cómodo al tacto). */
export type TamanoBoton = "normal" | "pequeno";
const TAMANO_BOTON = { normal: "min-h-10 px-4 py-2 text-sm", pequeno: "min-h-8 px-2.5 py-1 text-xs" } as const;
export const claseBoton = (estilo: EstiloBoton = "primario", tamano: TamanoBoton = "normal") =>
  `boton inline-flex items-center justify-center gap-2 rounded-md border font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${TAMANO_BOTON[tamano]} ${ESTILO_BOTON[estilo]}`;

export function BotonEnlace({ href, estilo = "primario", children }: { href: Route; estilo?: EstiloBoton; children: ReactNode }) {
  return <Link href={href} className={claseBoton(estilo)}>{children}</Link>;
}

/* ---------------------------------------------------------------- Tablas --- */

/**
 * Tabla densa. Si no hay filas, lo DICE (RN-23: nunca una lista vacía sin
 * mensaje). En pantallas angostas se desplaza por dentro, no toda la página.
 */
/** Con `movil`, en pantallas angostas cada fila se muestra como una tarjeta en
 *  vez de una tabla que obliga a desplazarse de lado (CE-87). */
export function Tabla({ columnas, filas, vacio, resumen, movil }: {
  columnas: { titulo: string; ancho?: string; derecha?: boolean }[];
  filas: ReactNode[][];
  vacio: string;
  resumen?: ReactNode;
  movil?: ReactNode[];
}) {
  return (
    <div>
      {resumen && <p className="mb-2 text-sm text-tinta-suave" aria-live="polite">{resumen}</p>}
      {movil && (
        <ul className="divide-y divide-borde overflow-hidden rounded-md border border-borde bg-papel sm:hidden">
          {movil.length === 0 ? <li className="px-3 py-6 text-center text-tinta-suave">{vacio}</li>
            : movil.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      <div className={`max-h-[70vh] overflow-auto rounded-md border border-borde ${movil ? "hidden sm:block" : ""}`}>
        <table className="tabla">
          <thead>
            <tr>{columnas.map((c, i) => <th key={i} style={{ width: c.ancho }} className={c.derecha ? "text-right" : ""}>{c.titulo}</th>)}</tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={columnas.length} className="py-6 text-center text-tinta-suave">{vacio}</td></tr>
            ) : filas.map((f, i) => (
              <tr key={i}>{f.map((celda, j) => <td key={j} className={columnas[j]?.derecha ? "text-right cifra" : ""}>{celda}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Dato de solo lectura en una ficha: etiqueta pequeña arriba, valor abajo. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">{etiqueta}</dt>
      <dd className="mt-0.5">{children ?? <span className="text-tinta-suave">Sin registro</span>}</dd>
    </div>
  );
}

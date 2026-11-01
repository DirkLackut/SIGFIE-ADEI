"use client";
/**
 * Búsqueda de estudiantes (T23). Busca cuando la persona deja de escribir
 * (CE-73), dice siempre el total real (CE-42, CE-85) y nunca muestra una lista
 * vacía sin explicar por qué (CE-44).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { buscarEstudiantes, type RespuestaBusqueda } from "./acciones";
import { Alerta, Insignia, Tabla, claseBoton } from "@/componentes/ui";
import { cantidad } from "@/dominio/formato";

const ESPERA_MS = 300;

export function Buscador({ textoInicial = "" }: { textoInicial?: string }) {
  const [texto, setTexto] = useState(textoInicial);
  const [pagina, setPagina] = useState(1);
  const [r, setR] = useState<RespuestaBusqueda | null>(null);
  const [buscando, iniciar] = useTransition();
  const ultima = useRef(0);

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio.length < 3) return;
    const id = ++ultima.current;
    const t = setTimeout(() => iniciar(async () => {
      const res = await buscarEstudiantes(limpio, pagina);
      if (id === ultima.current) setR(res);   // descarta respuestas que llegan tarde
    }), ESPERA_MS);
    return () => clearTimeout(t);
  }, [texto, pagina]);

  const corto = texto.trim().length < 3;
  const ok = !corto && r?.estado === "ok" ? r : null;
  const paginas = ok ? Math.max(1, Math.ceil(ok.total / ok.por_pagina)) : 1;

  return (
    <div className="space-y-4">
      <div role="search">
        <label htmlFor="busqueda" className="mb-1 block text-sm font-semibold">Nombre, cédula o código ADEI</label>
        <input id="busqueda" type="search" value={texto} autoFocus autoComplete="off" spellCheck={false}
               placeholder="Ejemplo: gutierrez, 001-150190, ADEI-2026-00014"
               onChange={(e) => { setTexto(e.target.value); setPagina(1); }}
               className="campo-entrada max-w-xl text-base" aria-describedby="busqueda-ayuda" />
        <p id="busqueda-ayuda" className="mt-1 text-xs text-tinta-suave">
          No importan las mayúsculas, las tildes ni los guiones de la cédula. Busca al dejar de escribir.
        </p>
      </div>

      {corto ? (
        <p className="text-sm text-tinta-suave" role="status">
          {texto.trim() ? "Escriba al menos 3 letras o números para buscar." : "Escriba para buscar entre todos los estudiantes de la academia."}
        </p>
      ) : r?.estado === "denegado" ? (
        <Alerta tipo="cuidado">Su rol no permite buscar estudiantes.</Alerta>
      ) : r?.estado === "error" ? (
        <Alerta tipo="cuidado" titulo="No se pudo buscar">Intente de nuevo. Si su sesión venció, ingrese otra vez.</Alerta>
      ) : ok ? (
        <div className={buscando ? "opacity-60 transition-opacity" : ""}>
          <Tabla
            resumen={<><strong className="text-tinta">{cantidad(ok.total, "resultado", "resultados")}</strong> para «{texto.trim()}»{ok.total > ok.por_pagina && ` · página ${ok.pagina} de ${paginas}`}</>}
            vacio={`0 resultados para «${texto.trim()}». Revise la escritura o busque por otra parte del nombre o por la cédula.`}
            columnas={[{ titulo: "Código ADEI", ancho: "10rem" }, { titulo: "Apellidos y nombres" }, { titulo: "Cédula", ancho: "11rem" },
                       { titulo: "Sucursal" }, { titulo: "Matrícula", ancho: "7rem" }]}
            filas={ok.resultados.map((f) => [
              <Link key="c" href={`/estudiantes/${f.id}` as Route} className="font-mono text-sm font-semibold text-azul hover:underline">{f.codigo_adei}</Link>,
              <Link key="n" href={`/estudiantes/${f.id}` as Route} className="hover:underline">{f.apellidos}, {f.nombres}</Link>,
              <span key="ce" className="font-mono text-sm">{f.cedula ?? <span className="text-tinta-suave">Sin cédula</span>}</span>,
              f.sucursal,
              <Insignia key="e" color={f.estado_matricula === "Activo" ? "verde" : "gris"}>{f.estado_matricula}</Insignia>,
            ])}
            movil={ok.resultados.map((f) => (
              <Link key={f.id} href={`/estudiantes/${f.id}` as Route} className="block px-3 py-2.5 hover:bg-papel-alt active:bg-marino-suave">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{f.apellidos}, {f.nombres}</span>
                  <Insignia color={f.estado_matricula === "Activo" ? "verde" : "gris"}>{f.estado_matricula}</Insignia>
                </span>
                <span className="mt-0.5 block text-xs text-tinta-suave">
                  <span className="font-mono font-semibold text-azul">{f.codigo_adei}</span> · {f.cedula ? <span className="font-mono">{f.cedula}</span> : "Sin cédula"} · {f.sucursal}
                </span>
              </Link>
            ))}
          />
          {paginas > 1 && (
            <nav aria-label="Páginas de resultados" className="mt-3 flex items-center gap-2">
              <button className={claseBoton("secundario")} disabled={pagina <= 1 || buscando} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
              <span className="text-sm text-tinta-suave">Página {pagina} de {paginas}</span>
              <button className={claseBoton("secundario")} disabled={pagina >= paginas || buscando} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
            </nav>
          )}
        </div>
      ) : (
        <p className="text-sm text-tinta-suave" role="status">Buscando…</p>
      )}
    </div>
  );
}

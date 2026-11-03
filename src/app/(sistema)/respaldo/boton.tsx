"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { rpcDeSupabase } from "@/datos/rpc";
import { respaldo } from "@/datos/consultas";
import { Alerta, claseBoton } from "@/componentes/ui";

/**
 * CE-31 a CE-35. El respaldo se pide desde el navegador, directo a Supabase y con
 * la sesión de la persona (plan §6): con 20,000 estudiantes pesa 8 MB ya en Excel,
 * más de lo que Vercel Hobby deja responder. La base comprueba que sea la Asistente.
 */
export function BotonRespaldo() {
  const [estado, setEstado] = useState<"listo" | "trabajando" | { ok: boolean; mensaje: string }>("listo");
  const generar = async () => {
    setEstado("trabajando");
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const r = await respaldo(rpcDeSupabase(supabase));
      if (r.estado !== "ok") {
        setEstado({ ok: false, mensaje: r.estado === "denegado" ? "El respaldo lo genera solo la Asistente de Dirección."
          : r.estado === "incompleto" ? `No se generó: las hojas ${r.hojas} no cuadraban. El incidente quedó registrado; intente de nuevo.`
          : r.mensaje });
        return;
      }
      // El escritor de Excel se carga solo aquí: las demás pantallas no lo necesitan.
      const [{ generarXlsx, TIPO_XLSX }, { hojasRespaldo, nombreArchivo }] = await Promise.all([import("@/dominio/xlsx"), import("@/dominio/exportacion")]);
      const archivo = generarXlsx(hojasRespaldo(r));
      const url = URL.createObjectURL(new Blob([archivo as BlobPart], { type: TIPO_XLSX }));
      const a = document.createElement("a");
      a.href = url; a.download = nombreArchivo("respaldo", r.generado.fecha_hora);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const filas = r.hojas.reduce((n, h) => n + h.total, 0);
      setEstado({ ok: true, mensaje: `Respaldo descargado: ${r.hojas.length} hojas, ${filas.toLocaleString("en-US")} filas. Guárdelo en un lugar seguro.` });
    } catch (x) {
      setEstado({ ok: false, mensaje: `No se pudo generar el respaldo: ${(x as Error).message}` });
    }
  };
  return (
    <div className="space-y-3">
      <button type="button" className={claseBoton("primario")} disabled={estado === "trabajando"} onClick={generar}>
        {estado === "trabajando" ? "Generando… puede tardar un minuto" : "Descargar respaldo completo"}
      </button>
      {typeof estado === "object" && <Alerta tipo={estado.ok ? "exito" : "cuidado"}>{estado.mensaje}</Alerta>}
    </div>
  );
}

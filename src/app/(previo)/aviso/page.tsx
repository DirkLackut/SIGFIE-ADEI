import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerEstado } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { FormularioAviso } from "./formulario";

export const metadata: Metadata = { title: "Aviso de privacidad · SIGFIE-ADEI" };

/** CE-14: el aviso vigente, en cada sesión, antes de cualquier dato (Ley 787). */
export default async function PaginaAviso() {
  const estado = await obtenerEstado();
  if (!estado?.cuenta) redirect("/ingresar");
  const supabase = await clienteSesion();
  const { data: aviso } = await supabase.from("aviso_privacidad")
    .select("version, texto").eq("version", estado.version_aviso ?? "").maybeSingle();
  if (!aviso) {
    return <p role="alert">No hay un aviso de privacidad vigente. Consulte a la Asistente de Dirección.</p>;
  }
  const parrafos = aviso.texto.split(/\n\s*\n/);
  return (
    <article className="rounded-lg border border-borde bg-papel p-5 sm:p-8">
      <p className="text-xs font-semibold tracking-wider text-azul uppercase">Antes de continuar</p>
      <h1 className="mt-1 font-titulo text-2xl font-bold text-marino">Aviso de privacidad</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Versión {aviso.version}. Se acepta una vez en cada ingreso. Sin aceptarlo no se puede usar el sistema.
      </p>
      <div className="mt-6 space-y-3 text-[0.9375rem] leading-relaxed break-words">
        {parrafos.map((p, i) => <p key={i} className={i === 0 ? "font-semibold" : ""}>{p}</p>)}
      </div>
      <div className="mt-8 border-t border-borde pt-5"><FormularioAviso version={aviso.version} /></div>
    </article>
  );
}

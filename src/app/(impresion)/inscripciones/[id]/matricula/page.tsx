import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { hojaMatricula } from "@/datos/consultas";
import { Alerta, Emblema } from "@/componentes/ui";
import { componerHoja, type Campo } from "@/dominio/hoja-matricula";
import { esUuid } from "@/dominio/formato";
import { BotonImprimir } from "../../../actas/[id]/imprimir/boton";

export const metadata: Metadata = { title: "Hoja de matrícula · SIGFIE-ADEI" };

/** Renglones del formato impreso: qué campos van juntos en cada línea. */
const RENGLONES = {
  alumno: [["Nombres completos"], ["Apellidos"], ["Fecha de nacimiento", "Edad"], ["Dirección"],
    ["Lugar donde vive", "Cédula del alumno N.º"], ["N.º Celular del alumno", "Nivel de escolaridad"], ["Correo electrónico"]],
  tutor: [["Nombre del tutor", "N.º Celular del tutor"], ["Cédula del tutor"], ["En caso de emergencia llamar a"]],
  academia: [["Fecha de ingreso", "N.º Recibo"], ["Nivel", "Horario"], ["Inicio nivel", "Término nivel"], ["Profesor"], ["Curso"], ["Inscrito por", "Paga"]],
} as const;

/**
 * CE-44 a CE-51: la Hoja de matrícula de ADEI, prellenada (docs/formatos/hoja-de-matricula.jpg).
 * Se reproduce el formato; sin «Estado civil» ni «Padece de alguna enfermedad» (CE-48).
 * Lo que el sistema no registra queda en blanco para llenarse a mano (CE-47).
 */
export default async function PaginaHojaMatricula({ params }: PageProps<"/inscripciones/[id]/matricula">) {
  await exigirAcceso(["asistente"]);
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const r = await hojaMatricula(rpcDeSupabase(await clienteSesion()), id);
  if (r.estado === "no_existe") notFound();
  if (r.estado !== "ok") return (
    <div className="mx-auto max-w-2xl space-y-3 p-6">
      <Alerta tipo="cuidado">{r.estado === "denegado" ? "La Hoja de matrícula la genera la Asistente de Dirección." : r.mensaje}</Alerta>
      <Link href="/inicio" className="text-sm font-semibold text-azul hover:underline">← Inicio</Link>
    </div>
  );
  const h = componerHoja(r);
  const campo = (seccion: keyof typeof h.secciones, etiqueta: string) => h.secciones[seccion].find((c) => c.etiqueta === etiqueta)!;

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[216mm] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex gap-4 text-sm font-semibold">
          {r.alumno.id && <Link href={`/estudiantes/${r.alumno.id}` as Route} className="text-azul hover:underline">← Expediente</Link>}
          {r.academia.grupo_id && <Link href={`/grupos/${r.academia.grupo_id}` as Route} className="text-azul hover:underline">← Grupo {r.academia.codigo_grupo}</Link>}
        </div>
        <BotonImprimir />
      </div>
      <article className="hoja relative mx-auto mb-6 flex min-h-[279mm] max-w-[216mm] flex-col border border-borde bg-papel px-[16mm] py-[12mm] text-[10.5pt] text-tinta">
        <header className="flex items-start gap-6">
          <Emblema className="size-[26mm] text-marino" titulo="Emblema de ADEI" />
          <div className="flex-1 pt-4 text-center font-titulo font-bold leading-snug">
            <p className="text-[12pt]">ACADEMIA DE ENSEÑANZA EN INGLÉS</p>
            <p className="text-[12pt]">HOJA DE MATRÍCULA</p>
          </div>
          <div aria-label="Espacio para la foto" className="grid h-[36mm] w-[30mm] shrink-0 place-items-center border border-tinta text-[8pt] text-tinta-suave">Foto</div>
        </header>

        {(["alumno", "tutor", "academia"] as const).map((s) => (
          <section key={s} className="mt-5">
            <h2 className="mb-2 font-bold underline">{s === "alumno" ? "DATOS DEL ALUMNO" : s === "tutor" ? "DATOS DEL TUTOR" : "DATOS DE LA ACADEMIA"}</h2>
            <div className="space-y-2.5">
              {RENGLONES[s].map((r, i) => (
                <div key={i} className={`grid gap-x-5 ${r.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {r.map((e) => <Linea key={e} c={campo(s, e)} />)}
                </div>
              ))}
              {s === "tutor" && h.notaTutores && <p className="text-[8.5pt] text-tinta-suave">{h.notaTutores}</p>}
            </div>
          </section>
        ))}

        <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-bold">
          <span>Requisitos entregados:</span>
          {h.requisitos.map((x) => <span key={x}>{x}: <span className="inline-block w-[12mm] border-b border-tinta">&nbsp;</span></span>)}
        </p>

        <footer className="mt-auto flex justify-between pt-6 text-[7.5pt] text-tinta-suave">
          <span>{h.codigo_adei} · {h.codigo_grupo} · {h.sucursal}</span>
          <span>«sin registro»: el sistema no tiene ese dato de este estudiante</span>
        </footer>
      </article>
    </>
  );
}

/** «Etiqueta: ____valor____», como en el formato. */
function Linea({ c }: { c: Campo }) {
  return (
    <p className="flex min-w-0 items-end gap-2">
      <span className="shrink-0 font-bold">{c.etiqueta}:</span>
      <span className={`min-h-[6mm] flex-1 border-b border-tinta px-1 ${c.tipo === "sin_registro" ? "text-[9pt] italic text-tinta-suave" : ""}`}>
        {c.valor || " "}
      </span>
    </p>
  );
}

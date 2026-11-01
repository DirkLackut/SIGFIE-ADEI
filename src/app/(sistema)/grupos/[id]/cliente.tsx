"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { accionInscribir, accionAnular, accionCambiarProfesor, type EstadoAccion } from "./acciones";
import { buscarEstudiantes, type FilaBusqueda } from "../../estudiantes/acciones";
import type { RespuestaInscripcion } from "@/datos/grupos";
import { Alerta, claseBoton } from "@/componentes/ui";
import { BotonEnviar, conservarSiFalla } from "@/componentes/ui-cliente";
import { useConfirmarExito } from "@/componentes/movimiento";
import { Campo, Selector } from "@/componentes/campos";

/** Inscribir: buscar al estudiante aquí mismo y pulsar "Inscribir". Si se cruza
 *  con otro grupo suyo, se advierte y se pide confirmar (CE-84). */
export function Inscribir({ grupoId, inicial }: { grupoId: string; inicial?: string }) {
  const [texto, setTexto] = useState(inicial ?? "");
  const [resultados, setResultados] = useState<FilaBusqueda[] | null>(null);
  const [respuesta, setRespuesta] = useState<{ est: FilaBusqueda; r: RespuestaInscripcion } | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    const t = texto.trim();
    if (t.length < 3) return;
    const h = setTimeout(async () => {
      const r = await buscarEstudiantes(t, 1);
      setResultados(r.estado === "ok" ? r.resultados : []);
    }, 300);
    return () => clearTimeout(h);
  }, [texto]);

  const hacer = (est: FilaBusqueda, confirmar = false) => iniciar(async () => {
    setRespuesta({ est, r: await accionInscribir(grupoId, est.id, confirmar) });
  });

  const r = respuesta?.r;
  return (
    <div className="space-y-3">
      {r && respuesta && (
        r.estado === "inscrito" ? <Alerta tipo="exito">{respuesta.est.nombres} {respuesta.est.apellidos} quedó inscrito.</Alerta>
        : r.estado === "ya_inscrito" ? <Alerta tipo="cuidado">{respuesta.est.nombres} {respuesta.est.apellidos} ya está inscrito en este grupo.</Alerta>
        : r.estado === "superposicion" ? (
          <Alerta tipo="cuidado" titulo="Se cruza con otro grupo">
            <p>{respuesta.est.nombres} {respuesta.est.apellidos} ya cursa {r.grupos.map((g) => g.codigo_grupo).join(", ")} en la misma modalidad, con fechas y horas que se cruzan.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={claseBoton("cuidado")} disabled={pendiente} onClick={() => hacer(respuesta.est, true)}>Inscribir de todos modos</button>
              <button className={claseBoton("secundario")} onClick={() => setRespuesta(null)}>No inscribir</button>
            </div>
          </Alerta>
        ) : <Alerta tipo="cuidado" titulo="No se inscribió">{r.mensaje}</Alerta>
      )}
      <div>
        <label htmlFor="buscar-inscribir" className="mb-1 block text-sm font-semibold">Buscar estudiante para inscribir</label>
        <input id="buscar-inscribir" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
               placeholder="Nombre, cédula o código ADEI" className="campo-entrada max-w-md" />
      </div>
      {texto.trim().length >= 3 && resultados && (
        resultados.length === 0 ? <p className="text-sm text-tinta-suave">0 resultados para «{texto.trim()}».</p> : (
          <ul className="divide-y divide-borde rounded-md border border-borde">
            {resultados.slice(0, 8).map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span><span className="font-mono text-sm font-semibold">{f.codigo_adei}</span> · {f.apellidos}, {f.nombres}
                  {f.estado_matricula !== "Activo" && <span className="text-tinta-suave"> ({f.estado_matricula})</span>}</span>
                <button className={claseBoton("primario")} disabled={pendiente} onClick={() => hacer(f)}>Inscribir</button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export function Anular({ grupoId, inscripcionId }: { grupoId: string; inscripcionId: string }) {
  const [s, accion] = useActionState<EstadoAccion, FormData>(accionAnular, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  if (s.ok) return <span className="aparecer text-sm text-cian">{s.mensaje}</span>;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-dorado-texto">Anular…</summary>
      <form action={accion} onReset={conservarSiFalla(s.ok)} className="desplegable mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="grupo" value={grupoId} />
        <input type="hidden" name="inscripcion" value={inscripcionId} />
        <label className="text-sm">Motivo <input name="motivo" required minLength={5} className="campo-entrada mt-1" placeholder="Por ejemplo: inscrito por error" /></label>
        <BotonEnviar estilo="cuidado" enviando="Anulando…">Confirmar anulación</BotonEnviar>
      </form>
      {s.mensaje && <div className="mt-2"><Alerta tipo="cuidado">{s.mensaje}</Alerta></div>}
    </details>
  );
}

export function CambiarProfesor({ grupoId, profesores }: { grupoId: string; profesores: { valor: string; texto: string }[] }) {
  const [s, accion] = useActionState<EstadoAccion, FormData>(accionCambiarProfesor, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  return (
    <form action={accion} onReset={conservarSiFalla(s.ok)} className="space-y-3">
      <input type="hidden" name="grupo" value={grupoId} />
      {s.mensaje && !s.ok && <Alerta tipo="cuidado">{s.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector nombre="profesor_id" etiqueta="Profesor nuevo" requerido opciones={profesores} />
        <Campo nombre="motivo" etiqueta="Motivo" requerido placeholder="Por ejemplo: licencia del titular" ayuda="Queda en la auditoría." />
      </div>
      <BotonEnviar estilo="secundario" enviando="Cambiando…">Cambiar profesor</BotonEnviar>
    </form>
  );
}

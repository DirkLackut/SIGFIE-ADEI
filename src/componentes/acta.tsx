"use client";
/**
 * El acta en pantalla (spec 002, T8 y T9). Reemplaza la Hoja de registro de notas,
 * así que conserva su estructura: una fila numerada por estudiante con I, II, III y
 * Final, y la reprobada en rojo (principio 9). En el celular cada fila se vuelve
 * una tarjeta (RNF-06).
 *
 * Tres modos:
 *   · profesor   — captura con el acta Abierta; avisa inasistencias; entrega.
 *   · asistente  — decide reprogramaciones, retiros, bajas, traslados y Condicionado;
 *                  con el acta Entregada, modifica parciales con motivo (CE-48).
 *   · lectura    — Dirección (CE-58).
 *
 * La nota que se ve mientras se escribe la calcula dominio/notas.ts; la que vale es
 * la que devuelve la base al guardar (D25).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alerta, Insignia, claseBoton } from "./ui";
import { calcularNota, estadoAcademico, leerValorParcial, type Condicion, type ParcialCapturado } from "@/dominio/notas";
import { celdaParcial } from "@/dominio/acta-impresa";
import type { Acta, FilaActa, ParcialEnviado, RespuestaEntrega, Resumen } from "@/datos/actas";
import {
  accionAvisar, accionCondicionar, accionDecidir, accionEntregar, accionGuardarParciales, accionReprogramar,
} from "@/servidor/acciones-acta";

type ActaOk = Extract<Acta, { estado: "ok" }>;
export type Modo = "profesor" | "asistente" | "lectura";

const COLUMNAS = "sm:grid-cols-[2.25rem_minmax(11rem,1fr)_repeat(3,8.5rem)_4.5rem_8.5rem]";

export function ActaEnPantalla({ acta, modo }: { acta: ActaOk; modo: Modo }) {
  const { filas, permisos, grupo } = acta;
  const captura = modo === "profesor" ? permisos.capturar : modo === "asistente" && permisos.modificar_entregada;
  return (
    <div className="space-y-3">
      {filas.length === 0 ? (
        <p className="rounded-md border border-borde px-3 py-6 text-center text-tinta-suave">Este grupo no tiene inscritos.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-borde">
          <div className={`hidden gap-3 border-b-2 border-marino bg-marino-suave px-3 py-2 text-xs font-semibold tracking-wide uppercase sm:grid ${COLUMNAS}`}>
            <span className="text-right">N.º</span><span>Nombres y apellidos</span>
            <span className="text-center">I</span><span className="text-center">II</span><span className="text-center">III</span>
            <span className="text-right">Final</span><span>Estado</span>
          </div>
          <ol className="divide-y divide-borde">
            {filas.map((f, i) => (
              <li key={`${f.inscripcion_id}-${f.version}`} className="px-3 py-2.5 even:bg-papel-alt">
                <Fila numero={i + 1} fila={f} grupoId={grupo.id} modo={modo} captura={captura}
                      reprogramar={permisos.reprogramar} actaAbierta={grupo.estado_acta === "Abierta"} />
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-xs text-tinta-suave">NP: no presentado (vale 0) · J: justificado (no cuenta) · R: reprogramado · C: condicionado.
        Una nota es provisional mientras falte la condición de algún parcial.</p>
      {modo === "profesor" && permisos.entregar && <EntregarActa grupoId={grupo.id} />}
    </div>
  );
}

/* ---------------------------------------------------------------- fila ---- */

type Casilla = { condicion: Condicion | ""; texto: string };
const casillasDe = (f: FilaActa): Casilla[] => [1, 2, 3].map((n) => {
  const p = f.parciales.find((x) => x.numero === n);
  if (!p) return { condicion: "", texto: "" };
  // CE-34: con la reprogramación autorizada, lo que sigue es anotar la nota.
  if (p.condicion === "No presentado" && p.reprogramacion_autorizada) return { condicion: "Reprogramado", texto: "" };
  return { condicion: p.condicion, texto: p.valor === null ? "" : String(p.valor) };
});
const llevaNota = (c: Condicion | "") => c === "Registrado" || c === "Reprogramado";

function Fila({ numero, fila, grupoId, modo, captura, reprogramar, actaAbierta }: {
  numero: number; fila: FilaActa; grupoId: string; modo: Modo; captura: boolean; reprogramar: boolean; actaAbierta: boolean;
}) {
  // Lo último que se sabe de la base. Cambia sin recargar cuando otra sesión ganó (CE-12).
  const [f, setF] = useState(fila);
  const excluida = f.estado_inscripcion === "Retirada" || f.estado_inscripcion === "Trasladada";
  const editable = captura && !excluida && (modo === "asistente" || !f.baja_inasistencia);
  const [casillas, setCasillas] = useState<Casilla[]>(() => casillasDe(f));
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [avisando, setAvisando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const puedeAvisar = modo === "profesor" && captura && f.estado_inscripcion === "En curso" && !f.baja_inasistencia && !f.aviso_inasistencia;
  const [decidiendo, setDecidiendo] = useState(false);
  const decisiones = modo === "asistente" && hayDecisiones(f, reprogramar, actaAbierta);
  const avisoPendiente = !!f.aviso_inasistencia && !f.baja_inasistencia && f.estado_inscripcion === "En curso";

  const original = casillasDe(f);
  const cambiada = casillas.some((c, i) => c.condicion !== original[i].condicion || c.texto !== original[i].texto);
  const invalidas = casillas.map((c) => llevaNota(c.condicion) && !leerValorParcial(c.texto).ok);

  // Vista previa (D25): lo escrito y válido cuenta; lo inválido, como si faltara.
  const capturados: (ParcialCapturado | null)[] = casillas.map((c, i) => {
    if (c.condicion === "") return null;
    if (llevaNota(c.condicion)) {
      const v = leerValorParcial(c.texto);
      return v.ok && !invalidas[i] ? { condicion: c.condicion, valor: v.valor } : null;
    }
    return { condicion: c.condicion, valor: null };
  });
  const nota = editable ? calcularNota(capturados)
    : { final: f.nota_final, provisional: f.provisional, requiereRetiro: f.requiere_retiro, exacta: f.nota_exacta, faltan: f.faltan };
  const regla = f.nota_minima === null ? null : { notaMinima: f.nota_minima, condicionadoDesde: f.condicionado_desde };
  const estado = editable
    ? estadoAcademico(nota, regla, { estadoInscripcion: f.estado_inscripcion, condicionado: f.condicionado, bajaInasistencia: f.baja_inasistencia })
    : f.estado;

  const cambiar = (i: number, c: Partial<Casilla>) => setCasillas((cs) => cs.map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, ...c };
    // Escribir un número es registrar la nota; elegir NP o J borra el número.
    if (c.texto !== undefined && c.texto !== "" && !llevaNota(n.condicion)) n.condicion = "Registrado";
    if (c.condicion !== undefined && !llevaNota(c.condicion)) n.texto = "";
    return n;
  }));

  const guardar = () => iniciar(async () => {
    setMensaje(null);
    const enviados: ParcialEnviado[] = casillas.map((c, i) => ({
      numero: i + 1, condicion: c.condicion, valor: llevaNota(c.condicion) ? Number(c.texto) : null }));
    const r = await accionGuardarParciales(grupoId, f.inscripcion_id, enviados, f.version, modo === "asistente" ? motivo : null);
    if (r.estado === "guardado") toast.success(`${f.nombres} ${f.apellidos}: guardado.`);
    else if (r.estado === "conflicto") {
      const actual = { ...f, ...r.resultado };
      setF(actual);
      setCasillas(casillasDe(actual));
      setMensaje("Otra sesión cambió a este estudiante mientras usted escribía. Se cargaron los datos actuales: revíselos y vuelva a guardar.");
    } else setMensaje(r.mensaje);
  });

  return (
    <div className={`grid items-start gap-x-3 gap-y-2 ${COLUMNAS}`}>
      <span className="cifra hidden pt-2 text-right text-sm text-tinta-suave sm:block">{numero}.</span>
      <div className="min-w-0">
        <p className="font-semibold"><span className="cifra text-tinta-suave sm:hidden">{numero}. </span>{f.apellidos}, {f.nombres}</p>
        <p className="font-mono text-xs text-tinta-suave">{f.codigo_adei}
          {puedeAvisar && !avisando && (
            <button type="button" onClick={() => setAvisando(true)}
                    className="ml-3 font-sans text-xs font-semibold text-azul hover:underline">Dejó de asistir…</button>
          )}
          {decisiones && (
            <button type="button" onClick={() => setDecidiendo((d) => !d)} aria-expanded={decidiendo}
                    className={`ml-3 font-sans text-xs font-semibold hover:underline ${avisoPendiente ? "text-dorado-texto" : "text-azul"}`}>
              {decidiendo ? "Cerrar" : avisoPendiente ? "Decidir el aviso…" : "Decisiones…"}</button>
          )}
        </p>
        <Senales fila={f} />
      </div>

      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 sm:block">
          <span className="w-8 text-xs font-semibold text-tinta-suave sm:hidden">{["I", "II", "III"][i]}</span>
          {editable ? (
            <EditorParcial casilla={casillas[i]} invalida={invalidas[i]} etiqueta={`Parcial ${["I", "II", "III"][i]} de ${f.nombres} ${f.apellidos}`}
              reprogramable={!!f.parciales.find((p) => p.numero === i + 1)?.reprogramacion_autorizada}
              onCambio={(c) => cambiar(i, c)} />
          ) : (
            <span className="cifra block pt-2 text-sm sm:text-center">{excluida ? "—" : celdaParcial(f.parciales.find((p) => p.numero === i + 1)) || "—"}</span>
          )}
        </div>
      ))}

      <div className="flex items-baseline gap-2 sm:block sm:pt-2 sm:text-right">
        <span className="w-8 text-xs font-semibold text-tinta-suave sm:hidden">Final</span>
        <span className={`cifra text-lg font-bold sm:text-base ${estado === "Reprobado" ? "text-reprobado" : ""}`}>
          {excluida || nota.final === null ? "—" : nota.final}
        </span>
      </div>
      <div className="sm:pt-1.5"><EstadoFila fila={f} estado={estado} provisional={nota.provisional} /></div>

      {(editable && (cambiada || mensaje)) && (
        <div className="space-y-2 sm:col-span-full sm:col-start-2">
          {mensaje && <Alerta tipo="cuidado">{mensaje}</Alerta>}
          {modo === "asistente" && (
            <label className="block max-w-md text-sm font-semibold">Motivo de la modificación <span className="text-dorado-texto" aria-hidden>*</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo-entrada mt-1 font-normal"
                     placeholder="Por ejemplo: error de transcripción del parcial II" />
              <span className="mt-1 block text-xs font-normal text-tinta-suave">El acta ya fue entregada: el motivo queda en la auditoría.</span>
            </label>
          )}
          {cambiada && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={claseBoton("primario")} onClick={guardar}
                      disabled={pendiente || invalidas.some(Boolean) || (modo === "asistente" && motivo.trim().length < 5)}>
                {pendiente ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className={claseBoton("secundario")} disabled={pendiente}
                      onClick={() => { setCasillas(original); setMensaje(null); }}>Deshacer</button>
              {invalidas.some(Boolean) && <p className="self-center text-sm font-medium text-dorado-texto">⚠ Cada nota es un número entero del 0 al 100.</p>}
            </div>
          )}
        </div>
      )}

      {puedeAvisar && avisando && (
        <div className="sm:col-span-full sm:col-start-2"><AvisarInasistencia grupoId={grupoId} fila={f} cerrar={() => setAvisando(false)} /></div>
      )}
      {decisiones && decidiendo && (
        <div className="sm:col-span-full sm:col-start-2">
          <DecisionesAsistente grupoId={grupoId} fila={f} reprogramar={reprogramar} actaAbierta={actaAbierta} />
        </div>
      )}
    </div>
  );
}

function EditorParcial({ casilla, invalida, etiqueta, reprogramable, onCambio }: {
  casilla: Casilla; invalida: boolean; etiqueta: string; reprogramable: boolean; onCambio: (c: Partial<Casilla>) => void;
}) {
  const conNota = llevaNota(casilla.condicion) || casilla.condicion === "";
  return (
    <div className="flex gap-1">
      <input aria-label={`${etiqueta}: nota`} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off"
             value={casilla.texto} disabled={!conNota} onChange={(e) => onCambio({ texto: e.target.value.trim() })}
             aria-invalid={invalida || undefined}
             className="campo-entrada campo-parcial cifra" />
      <select aria-label={`${etiqueta}: condición`} value={casilla.condicion}
              onChange={(e) => onCambio({ condicion: e.target.value as Condicion | "" })}
              data-normal={casilla.condicion === "Registrado" || casilla.condicion === "" ? "" : undefined}
              className="campo-entrada campo-condicion">
        <option value="">—</option>
        <option value="Registrado">Nota</option>
        <option value="No presentado">NP</option>
        <option value="Justificado">J</option>
        {reprogramable && <option value="Reprogramado">R</option>}
      </select>
    </div>
  );
}

function Senales({ fila: f }: { fila: FilaActa }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {f.aviso_inasistencia && !f.baja_inasistencia && f.estado_inscripcion === "En curso" &&
        <Insignia color="dorado">Dejó de asistir: decide la Asistente</Insignia>}
      {f.baja_inasistencia && <Insignia color="gris">Baja por inasistencia</Insignia>}
      {f.parciales.some((p) => p.condicion === "No presentado" && p.reprogramacion_autorizada) &&
        <Insignia color="verde">Reprogramación autorizada</Insignia>}
      {f.requiere_retiro && <Insignia color="dorado">Tres justificados: decidir retiro</Insignia>}
      {f.sin_regla && !f.provisional && <Insignia color="dorado">Sin regla de aprobación</Insignia>}
    </div>
  );
}

function EstadoFila({ fila: f, estado, provisional }: { fila: FilaActa; estado: string | null; provisional: boolean }) {
  if (f.estado_inscripcion === "Retirada" || f.estado_inscripcion === "Trasladada")
    return <span className="text-sm text-tinta-suave">{f.estado_inscripcion}</span>;
  if (provisional) return <span className="text-sm text-tinta-suave">Provisional</span>;
  if (estado === "Reprobado") return <span className="text-sm font-semibold text-reprobado">Reprobado</span>;
  if (estado === "Aprobado") return <Insignia color="verde">Aprobado</Insignia>;
  if (estado === "Condicionado") return <Insignia color="dorado">Condicionado</Insignia>;
  return <span className="text-sm text-tinta-suave">{estado ?? "—"}</span>;
}

/* ------------------------------------------------------------- profesor ---- */

function AvisarInasistencia({ grupoId, fila: f, cerrar }: { grupoId: string; fila: FilaActa; cerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const enviar = () => iniciar(async () => {
    const r = await accionAvisar(grupoId, f.inscripcion_id, texto);
    if (r.ok) toast.success("Aviso enviado a la Asistente de Dirección.");
    else setError(r.mensaje);
  });
  return (
    <div className="aparecer max-w-xl space-y-2 rounded-md border border-borde bg-papel p-3">
      <label className="block text-sm font-semibold">Observación para la Asistente
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} className="campo-entrada mt-1 font-normal"
               placeholder="Por ejemplo: no asiste desde el 12 de octubre" />
      </label>
      <p className="text-xs text-tinta-suave">La inscripción no cambia: la Asistente decide si es retiro o baja.</p>
      {error && <Alerta tipo="cuidado">{error}</Alerta>}
      <div className="flex gap-2">
        <button type="button" className={claseBoton("primario")} disabled={pendiente || texto.trim().length < 5} onClick={enviar}>
          {pendiente ? "Enviando…" : "Enviar aviso"}</button>
        <button type="button" className={claseBoton("secundario")} onClick={cerrar}>Cancelar</button>
      </div>
    </div>
  );
}

function EntregarActa({ grupoId }: { grupoId: string }) {
  const [r, setR] = useState<RespuestaEntrega | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const pedir = (confirmar: boolean) => iniciar(async () => {
    const x = await accionEntregar(grupoId, confirmar);
    setR(x);
    if (x.estado === "entregada") { toast.success("Acta entregada."); router.refresh(); }
  });
  return (
    <div className="space-y-3 border-t border-borde pt-4">
      {r?.estado === "incompleta" && (
        <Alerta tipo="cuidado" titulo="Todavía no se puede entregar">
          <ul className="mt-1 list-disc pl-5">
            {r.faltan.map((x) => (
              <li key={x.codigo_adei}>{x.apellidos}, {x.nombres}: {[
                x.faltan.length ? `falta la condición del parcial ${x.faltan.map((n) => ["I", "II", "III"][n - 1]).join(", ")}` : "",
                x.aviso_sin_decidir ? "su aviso de inasistencia espera la decisión de la Asistente" : "",
                x.requiere_retiro ? "tiene tres justificados: la Asistente debe decidir el retiro" : ""].filter(Boolean).join("; ")}.</li>
            ))}
          </ul>
        </Alerta>
      )}
      {r?.estado === "sin_calificaciones" && <Alerta tipo="cuidado">El acta no tiene ninguna calificación registrada.</Alerta>}
      {r?.estado === "error" && <Alerta tipo="cuidado">{r.mensaje}</Alerta>}
      {r?.estado === "resumen" ? (
        <div className="aparecer space-y-3 rounded-md border border-marino/30 bg-marino-suave p-4">
          <p className="font-semibold">Resumen del acta</p>
          <TablaResumen resumen={r.resumen} />
          <p className="text-sm">Al entregarla ya no podrá cambiar ninguna nota; solo la Asistente de Dirección, con un motivo.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={claseBoton("primario")} disabled={pendiente} onClick={() => pedir(true)}>
              {pendiente ? "Entregando…" : "Confirmar entrega"}</button>
            <button type="button" className={claseBoton("secundario")} onClick={() => setR(null)}>Volver</button>
          </div>
        </div>
      ) : (
        <button type="button" className={claseBoton("primario")} disabled={pendiente} onClick={() => pedir(false)}>
          {pendiente ? "Revisando…" : "Entregar acta…"}</button>
      )}
    </div>
  );
}

export function TablaResumen({ resumen: s }: { resumen: Resumen }) {
  const datos: [string, number | string][] = [["Inscritos", s.inscritos], ["Aprobados", s.aprobados], ["Reprobados", s.reprobados],
    ["Condicionados", s.condicionados], ["Pendientes", s.pendientes], ["Retirados", s.retirados], ["Trasladados", s.trasladados],
    ["Promedio", s.promedio ?? "—"]];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
      {datos.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-borde/60 py-1.5">
          <dt className="text-tinta-suave">{k}</dt><dd className="cifra font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------- asistente --- */

/** Lo que la Asistente puede decidir sobre una inscripción en este momento. */
function opciones(f: FilaActa, reprogramar: boolean, actaAbierta: boolean) {
  const enCurso = f.estado_inscripcion === "En curso" && !f.baja_inasistencia;
  return {
    reprogramables: reprogramar && enCurso
      ? f.parciales.filter((p) => p.condicion === "No presentado" && !p.reprogramacion_autorizada) : [],
    decidir: actaAbierta && enCurso,
    condicionar: !f.condicionado && f.en_franja,
  };
}
function hayDecisiones(f: FilaActa, reprogramar: boolean, actaAbierta: boolean) {
  const o = opciones(f, reprogramar, actaAbierta);
  return o.reprogramables.length > 0 || o.decidir || o.condicionar || f.condicionado;
}

function DecisionesAsistente({ grupoId, fila: f, reprogramar, actaAbierta }: {
  grupoId: string; fila: FilaActa; reprogramar: boolean; actaAbierta: boolean;
}) {
  const { reprogramables, decidir, condicionar } = opciones(f, reprogramar, actaAbierta);
  return (
    <div className="aparecer">
      <div className="max-w-2xl space-y-4 rounded-md border border-borde bg-papel p-3">
        {f.aviso_inasistencia && decidir && (
          <p className="text-sm"><span className="font-semibold">Aviso del profesor:</span> {f.aviso_inasistencia}</p>
        )}
        {reprogramables.map((p) => <Reprogramar key={p.numero} grupoId={grupoId} fila={f} numero={p.numero} />)}
        {decidir && <Decidir grupoId={grupoId} fila={f} />}
        {(condicionar || f.condicionado) && <Condicionar grupoId={grupoId} fila={f} />}
      </div>
    </div>
  );
}

function useOperacion() {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<{ ok: boolean; mensaje?: string }>, exito: string) => iniciar(async () => {
    setError(null);
    const r = await fn();
    if (r.ok) toast.success(exito); else if (r.mensaje) setError(r.mensaje);
  });
  return { error, pendiente, correr, setError };
}

function Reprogramar({ grupoId, fila: f, numero }: { grupoId: string; fila: FilaActa; numero: number }) {
  const [recibo, setRecibo] = useState("");
  const op = useOperacion();
  const parcial = ["I", "II", "III"][numero - 1];
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Reprogramar el parcial {parcial} (No presentado)</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">N.º de recibo <span className="text-tinta-suave">(opcional)</span>
          <input value={recibo} onChange={(e) => setRecibo(e.target.value)} maxLength={40} className="campo-entrada mt-1 w-40" /></label>
        <button type="button" className={claseBoton("secundario")} disabled={op.pendiente}
                onClick={() => op.correr(() => accionReprogramar(grupoId, f.inscripcion_id, numero, recibo),
                  `Reprogramación del parcial ${parcial} autorizada: el profesor ya puede anotar la nota.`)}>
          {op.pendiente ? "Autorizando…" : "Autorizar"}</button>
      </div>
      {op.error && <Alerta tipo="cuidado">{op.error}</Alerta>}
    </div>
  );
}

const DECISIONES = [
  { valor: "retiro", texto: "Retiro justificado: queda Retirada, sin nota" },
  { valor: "baja", texto: "Baja por inasistencia: lo que falta queda NP y reprueba" },
  { valor: "traslado", texto: "Traslado a otro grupo: queda Trasladada, sin nota" },
  { valor: "continua", texto: "Sigue en el grupo: descartar el aviso" },
] as const;

function Decidir({ grupoId, fila: f }: { grupoId: string; fila: FilaActa }) {
  const [decision, setDecision] = useState<(typeof DECISIONES)[number]["valor"] | "">("");
  const [motivo, setMotivo] = useState("");
  const [advertir, setAdvertir] = useState<number | null>(null);
  const op = useOperacion();
  const opciones = DECISIONES.filter((d) => d.valor !== "continua" || f.aviso_inasistencia);
  const enviar = (confirmar: boolean) => op.correr(async () => {
    const r = await accionDecidir(grupoId, f.inscripcion_id, decision as never, motivo, confirmar);
    if (!r.ok && "advertir" in r) { setAdvertir(r.advertir); return { ok: false }; }
    return r;
  }, "Decisión registrada.");
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Situación de la inscripción</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label="Decisión" value={decision} onChange={(e) => { setDecision(e.target.value as never); setAdvertir(null); }} className="campo-entrada">
          <option value="">Elija una decisión…</option>
          {opciones.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}
        </select>
        <input aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300}
               className="campo-entrada" placeholder="Motivo (queda en la auditoría)" />
      </div>
      {advertir !== null ? (
        <Alerta tipo="cuidado" titulo="Tiene parciales con nota">
          <p>{advertir === 1 ? "1 parcial con nota dejará" : `${advertir} parciales con nota dejarán`} de contar. Se conservan en la auditoría.</p>
          <button type="button" className={`${claseBoton("cuidado")} mt-2`} disabled={op.pendiente} onClick={() => enviar(true)}>Confirmar de todos modos</button>
        </Alerta>
      ) : (
        <button type="button" className={claseBoton("secundario")} disabled={op.pendiente || !decision || motivo.trim().length < 5}
                onClick={() => enviar(false)}>{op.pendiente ? "Registrando…" : "Registrar decisión"}</button>
      )}
      {op.error && <Alerta tipo="cuidado">{op.error}</Alerta>}
    </div>
  );
}

function Condicionar({ grupoId, fila: f }: { grupoId: string; fila: FilaActa }) {
  const [texto, setTexto] = useState("");
  const op = useOperacion();
  const quitar = f.condicionado;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{quitar ? "Quitar el Condicionado" : `Condicionar (nota ${f.nota_final}, dentro de la franja)`}</p>
      {quitar && f.justificacion_condicionado && <p className="text-sm text-tinta-suave">Justificación: {f.justificacion_condicionado}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <input aria-label={quitar ? "Motivo" : "Justificación"} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
               className="campo-entrada max-w-md" placeholder={quitar ? "Motivo para quitarlo" : "Justificación del Condicionado"} />
        <button type="button" className={claseBoton(quitar ? "cuidado" : "secundario")} disabled={op.pendiente || texto.trim().length < 5}
                onClick={() => op.correr(() => accionCondicionar(grupoId, f.inscripcion_id, quitar, texto),
                  quitar ? "Condicionado quitado." : "Inscripción condicionada.")}>
          {op.pendiente ? "Guardando…" : quitar ? "Quitar" : "Condicionar"}</button>
      </div>
      {!quitar && <p className="text-xs text-tinta-suave">En el nivel siguiente se le exigirá {f.nota_minima}.</p>}
      {op.error && <Alerta tipo="cuidado">{op.error}</Alerta>}
    </div>
  );
}

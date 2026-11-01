"use client";
import { useActionState } from "react";
import { accionGuardarCatalogo, accionCambiarCatalogo, type EstadoCatalogo } from "./acciones";
import { Campo, Selector } from "@/componentes/campos";
import { BotonConfirmar, BotonEnviar, useErroresVivos } from "@/componentes/ui-cliente";
import { Alerta } from "@/componentes/ui";
import { useConfirmarExito } from "@/componentes/movimiento";
import type { Entidad } from "@/dominio/catalogos";

export interface DefCampo {
  nombre: string; etiqueta: string; requerido?: boolean; ayuda?: string; ancho?: string;
  tipo?: "text" | "time" | "number" | "tel"; opciones?: { valor: string; texto: string }[];
}

/** Formulario de alta o edición de un valor de catálogo. Todo se elige o se
 *  escribe aquí, una sola vez; en los demás formularios solo se selecciona (CE-21). */
export function FormularioCatalogo({ entidad, campos, id, valores = {}, boton, fijos = {} }: {
  entidad: Entidad; campos: DefCampo[]; id?: string; valores?: Record<string, string>; boton: string; fijos?: Record<string, string>;
}) {
  const [s, accion] = useActionState<EstadoCatalogo, FormData>(accionGuardarCatalogo, {});
  const v = { ...valores, ...(s.ok ? {} : s.valores ?? {}) };
  const { e, alEscribir } = useErroresVivos(s.errores, s);
  useConfirmarExito(s, !!s.ok, s.mensaje);
  return (
    <form action={accion} onInput={alEscribir} className="space-y-3" noValidate key={s.marca ?? 0}>
      <input type="hidden" name="entidad" value={entidad} />
      {id && <input type="hidden" name="id" value={id} />}
      {Object.entries(fijos).map(([k, x]) => <input key={k} type="hidden" name={k} value={x} />)}
      {s.mensaje && !s.ok && <Alerta tipo="cuidado">{s.mensaje}</Alerta>}
      {s.homonimos && (
        <Alerta tipo="cuidado" titulo="Ya hay un profesor con ese nombre">
          <ul className="my-1 list-disc pl-5">{s.homonimos.map((h) => <li key={h.id}>{h.nombres} {h.apellidos} — teléfono {h.telefono}</li>)}</ul>
          <p className="mb-2">¿Es otra persona con el mismo nombre?</p>
          <BotonEnviar nombre="confirmar" valor="otra-persona" estilo="cuidado">Sí, es otra persona: agregarla</BotonEnviar>
        </Alerta>
      )}
      <div className="flex flex-wrap items-start gap-3">
        {campos.map((c) => (
          <div key={c.nombre} style={{ width: c.ancho ?? "14rem" }} className="max-w-full">
            {c.opciones ? (
              <Selector nombre={c.nombre} etiqueta={c.etiqueta} requerido={c.requerido} opciones={c.opciones} defaultValue={v[c.nombre]} error={e[c.nombre]} ayuda={c.ayuda} />
            ) : (
              <Campo nombre={c.nombre} etiqueta={c.etiqueta} requerido={c.requerido} type={c.tipo ?? "text"} defaultValue={v[c.nombre]}
                     error={e[c.nombre]} ayuda={c.ayuda} autoComplete="off" inputMode={c.tipo === "tel" ? "numeric" : undefined} />
            )}
          </div>
        ))}
      </div>
      <BotonEnviar>{boton}</BotonEnviar>
    </form>
  );
}

/** Activar, desactivar y eliminar. Si no se puede eliminar porque está en uso,
 *  ofrece desactivar (CE-23). Si el profesor tiene cuenta, ofrece desactivarla (CE-83). */
export function AccionesFila({ entidad, id, activo, nombre, eliminable = true }: { entidad: Entidad; id: string; activo?: boolean; nombre: string; eliminable?: boolean }) {
  const [s, accion] = useActionState<EstadoCatalogo, FormData>(accionCambiarCatalogo, {});
  useConfirmarExito(s, !!s.ok && !s.cuentaActiva, s.mensaje);
  const formulario = (op: string, contenido: React.ReactNode, extra?: Record<string, string>) => (
    <form action={accion} className="inline">
      <input type="hidden" name="entidad" value={entidad} /><input type="hidden" name="id" value={id} />
      <input type="hidden" name="operacion" value={op} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {contenido}
    </form>
  );
  // En la tabla los botones van pequeños: con 36 niveles, botones grandes en cada
  // fila tapan los datos. Desactivar se deshace con «Activar»; eliminar no, y por
  // eso pregunta antes.
  const boton = (op: string, texto: string, estilo: "secundario" | "cuidado" = "secundario", extra?: Record<string, string>) =>
    formulario(op, <BotonEnviar estilo={estilo} enviando="…" tamano="pequeno">{texto}</BotonEnviar>, extra);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {activo !== undefined && (activo ? boton("desactivar", "Desactivar", "cuidado") : boton("activar", "Activar"))}
        {eliminable && formulario("eliminar", <BotonConfirmar pequeno pregunta={<>¿Eliminar «{nombre}»?</>} confirmar="Sí, eliminar">Eliminar</BotonConfirmar>)}
      </div>
      {s.mensaje && !(s.ok && !s.cuentaActiva) && (
        <Alerta tipo="cuidado">
          {s.mensaje}
          {s.ofrecerDesactivar && activo && <div className="mt-2">{boton("desactivar", "Desactivar en su lugar", "cuidado")}</div>}
          {s.cuentaActiva && <div className="mt-2">{boton("desactivar_cuenta", `Desactivar también la cuenta «${s.cuentaActiva.nombre_usuario}»`, "cuidado", { usuario_id: s.cuentaActiva.id })}</div>}
        </Alerta>
      )}
    </div>
  );
}

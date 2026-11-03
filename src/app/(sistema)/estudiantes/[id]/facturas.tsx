"use client";
import { useActionState } from "react";
import { accionGuardarFactura, accionAnularFactura, accionCambiarEstado,
  type EstadoFactura, type EstadoCambio } from "./acciones-003";
import { Campo, Selector, AreaTexto } from "@/componentes/campos";
import { BotonEnviar, CampoFecha, conservarSiFalla } from "@/componentes/ui-cliente";
import { useConfirmarExito } from "@/componentes/movimiento";
import { Alerta } from "@/componentes/ui";
import { FORMAS_PAGO } from "@/dominio/factura";
import { ESTADOS_MATRICULA } from "@/dominio/filtro";
import { hoyEnManagua } from "@/dominio/edad";
import type { FacturaBD } from "@/datos/consultas";

export interface OpcionInscripcion { id: string; texto: string; conFactura: boolean }

/**
 * CE-52 a CE-62: registrar o corregir una factura impresa. Si el monto es atípico
 * (CE-56), pide confirmar sin perder lo escrito; si el número ya existe (CE-54), lo dice.
 */
export function FormularioFactura({ estudianteId, inscripciones, inscripcionInicial, factura }: {
  estudianteId: string; inscripciones: OpcionInscripcion[]; inscripcionInicial?: string; factura?: FacturaBD;
}) {
  const [s, accion] = useActionState<EstadoFactura, FormData>(accionGuardarFactura, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  const v = (k: string, inicial: string) => s.valores?.[k] ?? inicial;
  const e = s.errores ?? {};
  const corrigiendo = !!factura;
  const otros = factura?.otros_amparados?.map((o) => o.codigo_adei).join(", ") ?? "";
  if (s.ok && !corrigiendo) return <Alerta tipo="exito">{s.mensaje}</Alerta>;
  return (
    <form action={accion} onReset={conservarSiFalla(s.ok)} className="space-y-3" noValidate>
      <input type="hidden" name="estudiante" value={estudianteId} />
      {factura && <><input type="hidden" name="id" value={factura.id} /><input type="hidden" name="version" value={factura.version} /></>}
      {s.mensaje && <Alerta tipo={s.ok ? "exito" : "cuidado"}>{s.mensaje}</Alerta>}
      {s.duplicada && <Alerta tipo="cuidado" titulo="Factura repetida">{s.duplicada} Revise la serie y el número.</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo nombre="serie" etiqueta="Serie" requerido maxLength={1} defaultValue={v("serie", factura?.serie ?? "B")} error={e.serie} ayuda="Una letra; hoy es «B»." />
        <Campo nombre="numero" etiqueta="Número" requerido inputMode="numeric" maxLength={5} defaultValue={v("numero", factura ? String(factura.numero) : "")} error={e.numero} ayuda="El impreso en la factura." />
        <CampoFecha nombre="fecha_emision" etiqueta="Fecha de emisión" requerido max={hoyEnManagua(new Date())}
          defaultValue={v("fecha_emision", factura?.fecha_emision ?? hoyEnManagua(new Date()))} error={e.fecha_emision} />
        <Campo nombre="monto" etiqueta="Monto" requerido inputMode="decimal" defaultValue={v("monto", factura ? String(factura.monto) : "")} error={e.monto} ayuda="Por ejemplo 34.00 o 1,245.50" />
        <Selector nombre="moneda" etiqueta="Moneda" requerido vacio="Elija…" defaultValue={v("moneda", factura?.moneda ?? "USD")} error={e.moneda}
          opciones={[{ valor: "USD", texto: "US$ (dólares)" }, { valor: "NIO", texto: "C$ (córdobas)" }]} />
        <Selector nombre="forma_pago" etiqueta="Forma de pago" requerido vacio="Elija…" defaultValue={v("forma_pago", factura?.forma_pago ?? "Efectivo")} error={e.forma_pago}
          opciones={FORMAS_PAGO.map((f) => ({ valor: f, texto: f }))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector nombre="inscripcion_id" etiqueta="Inscripción que paga" vacio="Ninguna en particular" error={e.inscripcion_id}
          defaultValue={v("inscripcion_id", factura?.inscripcion_id ?? inscripcionInicial ?? "")}
          opciones={inscripciones.filter((i) => !i.conFactura || i.id === factura?.inscripcion_id || i.id === inscripcionInicial).map((i) => ({ valor: i.id, texto: i.texto }))} />
        <Campo nombre="otros" etiqueta="Otros estudiantes que ampara" defaultValue={v("otros", otros)} error={e.otros}
          ayuda="Códigos ADEI separados por coma, para un recibo familiar." />
      </div>
      {corrigiendo && <Campo nombre="motivo" etiqueta="Motivo de la corrección" requerido minLength={5} defaultValue={v("motivo", "")} error={e.motivo} />}
      {s.atipico ? (
        <Alerta tipo="cuidado" titulo="Monto atípico">
          <p>{s.atipico}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <BotonEnviar estilo="cuidado" nombre="confirmar" valor="1">Sí, registrarla así</BotonEnviar>
            <span className="self-center text-sm">o corrija el monto y vuelva a guardar.</span>
          </div>
        </Alerta>
      ) : null}
      <BotonEnviar>{corrigiendo ? "Guardar corrección" : "Registrar factura"}</BotonEnviar>
    </form>
  );
}

/** CE-63 */
export function AnularFactura({ estudianteId, id }: { estudianteId: string; id: string }) {
  const [s, accion] = useActionState<EstadoFactura, FormData>(accionAnularFactura, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  return (
    <form action={accion} onReset={conservarSiFalla(s.ok)} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="estudiante" value={estudianteId} />
      <input type="hidden" name="id" value={id} />
      <label className="text-sm">Motivo <input name="motivo" required minLength={5} className="campo-entrada mt-1" placeholder="Por ejemplo: registrada por error" /></label>
      <BotonEnviar estilo="cuidado" enviando="Anulando…">Anular factura</BotonEnviar>
      {s.mensaje && !s.ok && <Alerta tipo="cuidado">{s.mensaje}</Alerta>}
    </form>
  );
}

/** CE-67 a CE-71: cambiar el estado de matrícula, con la fecha y una observación. */
export function CambiarEstado({ estudianteId, actual, ultimoCambio }: { estudianteId: string; actual: string; ultimoCambio: string | null }) {
  const [s, accion] = useActionState<EstadoCambio, FormData>(accionCambiarEstado, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  const e = s.errores ?? {};
  const v = (k: string, inicial: string) => s.valores?.[k] ?? inicial;
  if (s.ok) return <Alerta tipo="exito">{s.mensaje}</Alerta>;
  return (
    <form action={accion} onReset={conservarSiFalla(s.ok)} className="space-y-3" noValidate>
      <input type="hidden" name="estudiante" value={estudianteId} />
      <input type="hidden" name="actual" value={actual} />
      <input type="hidden" name="ultimo" value={ultimoCambio ?? ""} />
      {s.mensaje && <Alerta tipo="cuidado">{s.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector nombre="nuevo" etiqueta="Estado nuevo" requerido vacio="Elija…" defaultValue={v("nuevo", "")} error={e.nuevo}
          opciones={ESTADOS_MATRICULA.filter((x) => x !== actual).map((x) => ({ valor: x, texto: x }))} />
        <CampoFecha nombre="fecha" etiqueta="Fecha del cambio" requerido max={hoyEnManagua(new Date())} min={ultimoCambio ?? undefined}
          defaultValue={v("fecha", hoyEnManagua(new Date()))} error={e.fecha} ayuda="Hoy, o el día en que ocurrió." />
      </div>
      <AreaTexto nombre="observacion" etiqueta="Observación" maxLength={300} defaultValue={v("observacion", "")} error={e.observacion}
        ayuda="Por ejemplo: se mudó de ciudad. Hasta 300 caracteres." />
      {s.advertir && (
        <Alerta tipo="cuidado" titulo="Tiene inscripciones en curso">
          <p>El cambio de estado no lo saca de estos grupos: decida en cada acta si es retiro, baja o traslado.</p>
          <ul className="mt-1 list-disc pl-5">
            {s.advertir.map((i) => <li key={i.inscripcion_id}><a className="font-mono text-azul hover:underline" href={`/grupos/${i.grupo_id}`}>{i.codigo_grupo}</a> · {i.nivel}</li>)}
          </ul>
          <div className="mt-2"><BotonEnviar estilo="cuidado" nombre="confirmar" valor="1">Cambiar el estado de todos modos</BotonEnviar></div>
        </Alerta>
      )}
      <BotonEnviar>Cambiar estado</BotonEnviar>
    </form>
  );
}

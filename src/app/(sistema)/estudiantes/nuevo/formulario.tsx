"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { accionRegistrar, accionCompletarCedula, buscarTutor, type EstadoRegistro } from "./acciones";
import { Campo, Selector } from "@/componentes/campos";
import { BotonEnviar, conservarSiFalla } from "@/componentes/ui-cliente";
import { Alerta, BarraAcciones, claseBoton } from "@/componentes/ui";
import { calcularEdad, hoyEnManagua } from "@/dominio/edad";
import { fecha } from "@/dominio/formato";

export function FormularioEstudiante({ sucursales }: { sucursales: { valor: string; texto: string }[] }) {
  const [estado, accion] = useActionState<EstadoRegistro, FormData>(accionRegistrar, {});
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  const [nacimiento, setNacimiento] = useState(v.fecha_nacimiento ?? "");
  const hoy = hoyEnManagua(new Date());
  const edad = /^\d{4}-\d{2}-\d{2}$/.test(nacimiento) && nacimiento <= hoy ? calcularEdad(nacimiento, hoy) : null;
  const menor = edad !== null && edad < 18;

  return (
    <form action={accion} onReset={conservarSiFalla()} className="space-y-6" noValidate>
      {estado.mensaje && <Alerta tipo="cuidado" titulo="No se registró">{estado.mensaje}</Alerta>}
      {Object.keys(e).length > 0 && !estado.existente && (
        <Alerta tipo="cuidado" titulo="Revise los campos marcados">Lo que ya escribió se conserva.</Alerta>
      )}

      {estado.existente && (
        <Alerta tipo="cuidado" titulo="Ese estudiante ya está registrado">
          La cédula pertenece a <strong>{estado.existente.nombre}</strong> ({estado.existente.codigo_adei}).{" "}
          <Link href={`/estudiantes/${estado.existente.id}` as Route} className="font-semibold underline">Abrir su expediente</Link>
        </Alerta>
      )}

      {estado.coincidencias && (
        <Alerta tipo="cuidado" titulo="¿Es la misma persona?">
          <p>Ya hay {estado.coincidencias.length === 1 ? "un estudiante" : "estudiantes"} con el mismo nombre y fecha de nacimiento:</p>
          <ul className="my-2 space-y-1">
            {estado.coincidencias.map((c) => (
              <li key={c.id}>
                <Link href={`/estudiantes/${c.id}` as Route} className="font-semibold underline">{c.codigo_adei}</Link>{" "}
                — {c.nombres} {c.apellidos}, nacido el {fecha(c.fecha_nacimiento)}{c.cedula ? `, cédula ${c.cedula}` : ", sin cédula"}
              </li>
            ))}
          </ul>
          <p className="mb-2">Si es la misma persona, abra su expediente. Si es otra, regístrela: la decisión queda anotada.</p>
          <BotonEnviar nombre="confirmar" valor="otra-persona" estilo="cuidado" enviando="Registrando…">Es otra persona: registrarla</BotonEnviar>
        </Alerta>
      )}

      <fieldset className="grid gap-4 rounded-lg border border-borde bg-papel p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Identificación</legend>
        <Campo nombre="nombres" etiqueta="Nombres" requerido defaultValue={v.nombres} error={e.nombres} autoComplete="off" />
        <Campo nombre="apellidos" etiqueta="Apellidos" requerido defaultValue={v.apellidos} error={e.apellidos} autoComplete="off" />
        <Campo nombre="cedula" etiqueta="Cédula" defaultValue={v.cedula} error={e.cedula} autoComplete="off"
               ayuda="Formato 001-150190-0012K. Si no tiene (por ejemplo, un niño), déjela en blanco." />
        <div>
          <Campo nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" requerido type="date" max={hoy}
                 defaultValue={v.fecha_nacimiento} error={e.fecha_nacimiento}
                 onChange={(ev) => setNacimiento(ev.currentTarget.value)} />
          {edad !== null && !e.fecha_nacimiento && (
            <p className="mt-1 text-sm font-medium text-azul" aria-live="polite">
              {edad} {edad === 1 ? "año" : "años"} · {menor ? "menor de edad: se pedirán tutor y contacto de emergencia" : "mayor de edad"}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-borde bg-papel p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Contacto y sucursal</legend>
        <Campo nombre="telefono" etiqueta="Teléfono" requerido={!menor} inputMode="numeric" defaultValue={v.telefono}
               error={e.telefono} ayuda="8 dígitos, por ejemplo 8812 3456." autoComplete="off" />
        <Campo nombre="correo" etiqueta="Correo" type="email" defaultValue={v.correo} error={e.correo} autoComplete="off" />
        <Campo nombre="direccion" etiqueta="Dirección" defaultValue={v.direccion} error={e.direccion} autoComplete="off" />
        <Campo nombre="contacto_emergencia" etiqueta="Contacto de emergencia" requerido={menor} defaultValue={v.contacto_emergencia}
               error={e.contacto_emergencia} ayuda="Nombre y teléfono, por ejemplo «Madre, 8812 3456»." autoComplete="off" />
        <Selector nombre="sucursal_id" etiqueta="Sucursal" requerido opciones={sucursales} defaultValue={v.sucursal_id} error={e.sucursal_id} />
      </fieldset>

      {menor && <BloqueTutor v={v} e={e} />}

      <BarraAcciones>
        <BotonEnviar enviando="Registrando…">Registrar estudiante</BotonEnviar>
        <Link href="/estudiantes" className={claseBoton("secundario")}>Cancelar</Link>
      </BarraAcciones>

      {estado.completar && (
        <Alerta tipo="cuidado" titulo="Esta persona ya está registrada sin cédula">
          <p>En lugar de crear un expediente nuevo, complete el existente con la cédula:</p>
          <ul className="mt-2 space-y-2">
            {estado.completar.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span><strong>{c.codigo_adei}</strong> — {c.nombres} {c.apellidos}, {fecha(c.fecha_nacimiento)}</span>
                <button formAction={accionCompletarCedula} name="id" value={c.id} className={claseBoton("primario")}>Completar con la cédula</button>
              </li>
            ))}
          </ul>
          <p className="mt-2">Si no es la misma persona, use «Es otra persona» abajo.</p>
          <div className="mt-2"><BotonEnviar nombre="confirmar" valor="otra-persona" estilo="cuidado">Es otra persona: registrarla</BotonEnviar></div>
        </Alerta>
      )}
    </form>
  );
}

/** Tutor de un menor (CE-33). Si la cédula ya existe, trae sus datos (CE-38). */
function BloqueTutor({ v, e }: { v: EstadoRegistro["valores"] & object; e: Record<string, string> }) {
  const [cedula, setCedula] = useState(v.tutor_cedula ?? "");
  const [nombre, setNombre] = useState(v.tutor_nombre ?? "");
  const [telefono, setTelefono] = useState(v.tutor_telefono ?? "");
  const [encontrado, setEncontrado] = useState<boolean | null>(null);

  async function buscar() {
    const t = await buscarTutor(cedula);
    setEncontrado(!!t);
    if (t) { setNombre(t.nombre_completo); setTelefono(t.telefono); }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border-2 border-dorado bg-dorado-suave/40 p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Tutor (obligatorio para menores de 18 años)</legend>
      <div className="sm:col-span-2">
        <label htmlFor="tutor_cedula" className="mb-1 block text-sm font-semibold">Cédula del tutor <span className="text-dorado-texto">*</span></label>
        <div className="flex max-w-md gap-2">
          <input id="tutor_cedula" name="tutor_cedula" value={cedula} onChange={(ev) => { setCedula(ev.target.value); setEncontrado(null); }}
                 className="campo-entrada" aria-invalid={e.tutor_cedula ? true : undefined} autoComplete="off" />
          <button type="button" onClick={buscar} className={claseBoton("secundario") + " shrink-0"}>Buscar tutor</button>
        </div>
        {e.tutor_cedula && <p className="mt-1 text-sm font-medium text-dorado-texto">⚠ {e.tutor_cedula}</p>}
        <p className="mt-1 text-xs text-tinta-suave" aria-live="polite">
          {encontrado === true ? "Tutor ya registrado: se vinculará con sus datos guardados (por ejemplo, el de un hermano)."
            : encontrado === false ? "No está registrado: complete su nombre y teléfono."
            : "Si el tutor ya está registrado (por ejemplo, por un hermano), búsquelo para no escribir sus datos otra vez."}
        </p>
      </div>
      <Campo nombre="tutor_nombre" etiqueta="Nombre completo del tutor" requerido value={nombre} readOnly={encontrado === true}
             onChange={(ev) => setNombre(ev.currentTarget.value)} error={e.tutor_nombre} autoComplete="off" />
      <Campo nombre="tutor_telefono" etiqueta="Teléfono del tutor" requerido inputMode="numeric" value={telefono} readOnly={encontrado === true}
             onChange={(ev) => setTelefono(ev.currentTarget.value)} error={e.tutor_telefono} autoComplete="off" />
    </fieldset>
  );
}

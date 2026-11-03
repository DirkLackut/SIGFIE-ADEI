"use client";
import { useActionState, useRef, useState } from "react";
import { accionCrearCuenta, accionRestablecer, accionEstado, accionRoles, type EstadoCuenta } from "./acciones";
import { Campo, Selector } from "@/componentes/campos";
import { BotonConfirmar, BotonEnviar, conservarSiFalla, useErroresVivos } from "@/componentes/ui-cliente";
import { Aparecer, Desplegable, useConfirmarExito } from "@/componentes/movimiento";
import { Alerta, claseBoton } from "@/componentes/ui";
import type { Rol } from "@/dominio/acceso";
import { copiarTexto } from "@/dominio/portapapeles";

type Op = { valor: string; texto: string };
const ROLES: { rol: Rol; nombre: string; detalle: string }[] = [
  { rol: "asistente", nombre: "Asistente de Dirección", detalle: "Registra y modifica todo: estudiantes, grupos, catálogos y cuentas." },
  { rol: "direccion", nombre: "Dirección", detalle: "Director o Sub-directora: consulta y busca, sin modificar." },
  { rol: "profesor", nombre: "Profesor", detalle: "Ve solo sus grupos. Se vincula a un profesor del catálogo." },
];

/** CE-8: la temporal se muestra una sola vez, con lo que hay que hacer con ella. */
function Temporal({ t }: { t: { usuario: string; clave: string } }) {
  const [copiado, setCopiado] = useState<"no" | "copiado" | "manual">("no");
  const codigo = useRef<HTMLElement>(null);
  // Selecciona la contraseña en pantalla: sirve para «copiar» y para copiarla a mano.
  const seleccionar = () => {
    const sel = window.getSelection(); if (!codigo.current || !sel) return false;
    const r = document.createRange(); r.selectNodeContents(codigo.current); sel.removeAllRanges(); sel.addRange(r);
    return true;
  };
  const copiar = async () => {
    const escribir = navigator.clipboard?.writeText ? (x: string) => navigator.clipboard.writeText(x) : undefined;
    // execCommand está en desuso, pero es el único respaldo cuando el portapapeles moderno está negado.
    setCopiado(await copiarTexto(t.clave, { escribir, conSeleccion: () => seleccionar() && document.execCommand("copy") }));
  };
  return (
    <div role="status" className="rounded-lg border-2 border-azul bg-marino-suave p-4">
      <p className="font-semibold">Contraseña temporal de «{t.usuario}»</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code ref={codigo} className="rounded-md border border-borde bg-papel px-3 py-2 font-mono text-xl tracking-wider select-all">{t.clave}</code>
        <button type="button" className={claseBoton("secundario")} onClick={copiar}>
          {copiado === "copiado" ? "Copiada ✓" : "Copiar"}
        </button>
      </div>
      {copiado === "manual" && (
        <p className="mt-2 text-sm font-semibold text-dorado-texto" aria-live="polite">
          Este navegador no dejó copiarla. Ya quedó seleccionada: cópiela con Ctrl+C (o anótela).
        </p>
      )}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li><strong>Anótela ahora:</strong> no se vuelve a mostrar ni queda guardada en ningún lado.</li>
        <li>Entréguela en persona. Al ingresar, el sistema le pedirá elegir una propia.</li>
        <li>Vence en 3 días si no se usa.</li>
      </ul>
    </div>
  );
}

function CasillasRoles({ marcados, onCambio, error }: { marcados: Rol[]; onCambio: (r: Rol[]) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">Roles <span className="text-dorado-texto">*</span></legend>
      <div className="space-y-2">
        {ROLES.map((r) => (
          <label key={r.rol} className="flex cursor-pointer gap-3 rounded-md border border-borde p-2.5 hover:bg-papel-alt has-checked:border-azul has-checked:bg-marino-suave">
            <input type="checkbox" name="roles" value={r.rol} checked={marcados.includes(r.rol)} className="mt-1 size-4 accent-[#03214c]"
                   onChange={(e) => onCambio(e.target.checked ? [...marcados, r.rol] : marcados.filter((x) => x !== r.rol))} />
            <span><span className="block text-sm font-semibold">{r.nombre}</span><span className="block text-xs text-tinta-suave">{r.detalle}</span></span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm font-medium text-dorado-texto">⚠ {error}</p>}
    </fieldset>
  );
}

export function NuevaCuenta({ profesoresSinCuenta }: { profesoresSinCuenta: Op[] }) {
  const [s, accion] = useActionState<EstadoCuenta, FormData>(accionCrearCuenta, {});
  const [roles, setRoles] = useState<Rol[]>([]);
  const [clave, setClave] = useState(0);
  const { e, alEscribir } = useErroresVivos(s.errores, s);
  if (s.ok && s.temporal) {
    return (
      <div className="space-y-3">
        <Aparecer destacar><Temporal t={s.temporal} /></Aparecer>
        <button className={claseBoton("secundario")} onClick={() => { setRoles([]); setClave((k) => k + 1); location.reload(); }}>Crear otra cuenta</button>
      </div>
    );
  }
  const v = (s.valores ?? {}) as Record<string, string>;
  return (
    <form key={clave} action={accion} onReset={conservarSiFalla()} onInput={alEscribir} className="space-y-4" noValidate>
      {s.mensaje && <Alerta tipo="cuidado" titulo="No se creó la cuenta">{s.mensaje}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="nombre_usuario" etiqueta="Nombre de usuario" requerido defaultValue={v.nombre_usuario} error={e.nombre_usuario}
               ayuda="Con el que ingresará. 4 a 30 caracteres, sin espacios. Ejemplo: carlos.mena" autoCapitalize="none" autoComplete="off" />
        <Campo nombre="correo" etiqueta="Correo" type="email" defaultValue={v.correo} error={e.correo} autoComplete="off"
               ayuda="Si tiene, podrá restablecer su contraseña por sí mismo más adelante." />
      </div>
      <CasillasRoles marcados={roles} onCambio={setRoles} error={e.roles} />
      {roles.includes("profesor") && (
        profesoresSinCuenta.length ? (
          <Selector nombre="profesor_id" etiqueta="Profesor del catálogo" requerido opciones={profesoresSinCuenta} error={e.profesor_id}
                    ayuda="Cada profesor puede tener una sola cuenta." />
        ) : <Alerta tipo="cuidado">Todos los profesores activos ya tienen cuenta, o no hay profesores en el catálogo.</Alerta>
      )}
      <BotonEnviar enviando="Creando…">Crear cuenta</BotonEnviar>
    </form>
  );
}

export function AccionesCuenta({ id, nombreUsuario, activa, propia, roles, profesorId, profesores }: {
  id: string; nombreUsuario: string; activa: boolean; propia: boolean; roles: Rol[]; profesorId: string | null; profesores: Op[];
}) {
  const [sR, restablecer] = useActionState<EstadoCuenta, FormData>(accionRestablecer, {});
  const [sE, estado] = useActionState<EstadoCuenta, FormData>(accionEstado, {});
  const [sRol, guardarRoles] = useActionState<EstadoCuenta, FormData>(accionRoles, {});
  const [marcados, setMarcados] = useState<Rol[]>(roles);
  useConfirmarExito(sE, !!sE.ok, sE.mensaje);
  useConfirmarExito(sRol, !!sRol.ok, sRol.mensaje);
  return (
    <div className="space-y-2">
      {sR.temporal && <Aparecer clave={sR.temporal.clave} destacar><Temporal t={sR.temporal} /></Aparecer>}
      {/* Lo que salió bien se confirma con un aviso pasajero; lo que falló se queda aquí. */}
      {[sR, sE, sRol].map((s, i) => s.mensaje && !s.ok ? <Alerta key={i} tipo="cuidado">{s.mensaje}</Alerta> : null)}
      <div className="flex flex-wrap items-start gap-2">
        <Desplegable estilo="boton" titulo="Restablecer contraseña">
          <form action={restablecer} className="max-w-xs rounded-md border border-borde bg-papel p-3 text-sm">
            <input type="hidden" name="id" value={id} /><input type="hidden" name="nombre_usuario" value={nombreUsuario} />
            <p className="mb-2">Se generará una contraseña temporal. La actual deja de servir.</p>
            <BotonEnviar enviando="Generando…">Generar temporal</BotonEnviar>
          </form>
        </Desplegable>
        <Desplegable estilo="boton" titulo="Roles">
          <form action={guardarRoles} className="max-w-md space-y-3 rounded-md border border-borde bg-papel p-3">
            <input type="hidden" name="id" value={id} />
            <CasillasRoles marcados={marcados} onCambio={setMarcados} />
            {marcados.includes("profesor") && <Selector nombre="profesor_id" etiqueta="Profesor del catálogo" requerido opciones={profesores} defaultValue={profesorId ?? ""} />}
            <BotonEnviar>Guardar roles</BotonEnviar>
          </form>
        </Desplegable>
        {!propia && (
          <form action={estado}>
            <input type="hidden" name="id" value={id} /><input type="hidden" name="operacion" value={activa ? "desactivar" : "activar"} />
            {activa
              ? <BotonConfirmar pregunta={<>¿Desactivar «{nombreUsuario}»? No podrá ingresar hasta que la reactive.</>} confirmar="Sí, desactivar">Desactivar</BotonConfirmar>
              : <BotonEnviar estilo="secundario" enviando="…">Reactivar</BotonEnviar>}
          </form>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { exigirAcceso, NOMBRE_ROL } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Insignia, Seccion, TituloPagina } from "@/componentes/ui";
import { fechaHora } from "@/dominio/formato";
import { temporalVencida, vencimientoTemporal } from "@/dominio/contrasena";
import type { Rol } from "@/dominio/acceso";
import { AccionesCuenta, NuevaCuenta } from "./cliente";

export const metadata: Metadata = { title: "Cuentas · SIGFIE-ADEI" };

export default async function PaginaCuentas() {
  const estado = await exigirAcceso(["asistente"]);
  const s = await clienteSesion();
  const [{ data: cuentas }, { data: profesores }] = await Promise.all([
    s.from("usuario").select("id, nombre_usuario, correo, estado, profesor_id, debe_cambiar_contrasena, contrasena_temporal_emitida, ultimo_acceso, usuario_rol(rol), profesor(nombres, apellidos)").order("nombre_usuario"),
    s.from("profesor").select("id, nombres, apellidos").eq("activo", true).order("apellidos"),
  ]);
  const conCuenta = new Set((cuentas ?? []).map((c) => c.profesor_id).filter(Boolean));
  const op = (p: { id: string; nombres: string; apellidos: string }) => ({ valor: p.id, texto: `${p.apellidos}, ${p.nombres}` });
  const ahora = new Date();

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Cuentas de usuario"
        descripcion="Cada persona entra con su propia cuenta. La contraseña inicial es temporal: se muestra una sola vez y la persona elige la suya al ingresar." />

      <Seccion titulo="Nueva cuenta">
        <div className="max-w-2xl"><NuevaCuenta profesoresSinCuenta={(profesores ?? []).filter((p) => !conCuenta.has(p.id)).map(op)} /></div>
      </Seccion>

      <Seccion titulo="Cuentas existentes" descripcion={`${cuentas?.length ?? 0} cuentas`}>
        <ul className="divide-y divide-borde">
          {(cuentas ?? []).map((c) => {
            const roles = ((c.usuario_rol ?? []) as { rol: Rol }[]).map((r) => r.rol);
            const prof = c.profesor as unknown as { nombres: string; apellidos: string } | null;
            const temp = c.debe_cambiar_contrasena && c.contrasena_temporal_emitida ? new Date(c.contrasena_temporal_emitida) : null;
            return (
              <li key={c.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.nombre_usuario}</span>
                    <Insignia color={c.estado === "activo" ? "verde" : "gris"}>{c.estado === "activo" ? "Activa" : "Inactiva"}</Insignia>
                    {temp && (temporalVencida(temp, ahora)
                      ? <Insignia color="dorado">Temporal vencida</Insignia>
                      : <Insignia color="dorado">Temporal hasta {fechaHora(vencimientoTemporal(temp).toISOString())}</Insignia>)}
                    {c.nombre_usuario === estado.nombre_usuario && <Insignia>Usted</Insignia>}
                  </p>
                  <p className="text-sm text-tinta-suave">{roles.map((r) => NOMBRE_ROL[r]).join(" · ")}{prof && ` — ${prof.nombres} ${prof.apellidos}`}</p>
                  <p className="text-xs text-tinta-suave">{c.correo ?? "Sin correo"} · Último ingreso: {fechaHora(c.ultimo_acceso)}</p>
                </div>
                <AccionesCuenta id={c.id} nombreUsuario={c.nombre_usuario} activa={c.estado === "activo"} propia={c.nombre_usuario === estado.nombre_usuario}
                  roles={roles} profesorId={c.profesor_id}
                  profesores={(profesores ?? []).filter((p) => !conCuenta.has(p.id) || p.id === c.profesor_id).map(op)} />
              </li>
            );
          })}
        </ul>
      </Seccion>
    </div>
  );
}

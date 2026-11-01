"use server";
/**
 * Server Action del ingreso (T17). Solo conecta la lógica de src/servidor/ingreso.ts
 * con Supabase. La contraseña llega aquí por POST y va directo a Supabase Auth:
 * no se guarda, no se registra y nunca vuelve al navegador.
 */
import { redirect } from "next/navigation";
import { clienteServicio, clienteSesion } from "@/servidor/supabase";
import { ingresar } from "@/servidor/ingreso";

export interface EstadoIngreso { mensaje?: string; usuario?: string }

export async function accionIngresar(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const usuario = String(datos.get("usuario") ?? "");
  const contrasena = String(datos.get("contrasena") ?? "");
  const servicio = clienteServicio();
  const sesion = await clienteSesion();

  const r = await ingresar({
    ahora: new Date(),
    async buscarCuenta(nombre) {
      const { data } = await servicio.from("usuario")
        .select("id, estado, debe_cambiar_contrasena, contrasena_temporal_emitida")
        .eq("nombre_usuario", nombre).maybeSingle();
      if (!data) return null;
      const { data: auth } = await servicio.auth.admin.getUserById(data.id);
      if (!auth.user?.email) return null;
      return {
        id: data.id,
        activa: data.estado === "activo",
        debeCambiar: data.debe_cambiar_contrasena,
        temporalEmitida: data.contrasena_temporal_emitida ? new Date(data.contrasena_temporal_emitida) : null,
        correoAuth: auth.user.email,
      };
    },
    async iniciarSesion(correo, clave) {
      const { error } = await sesion.auth.signInWithPassword({ email: correo, password: clave });
      if (!error) return "ok";
      // 400 = datos que no coinciden (o cuenta suspendida); lo demás es el servicio.
      return error.status === 400 || error.code === "invalid_credentials" || error.code === "user_banned"
        ? "credenciales" : "error";
    },
    async cerrarSesion() { await sesion.auth.signOut(); },
    async registrarDenegado(nombre, motivo) {
      await servicio.rpc("registrar_ingreso_denegado", { p_nombre_usuario: nombre, p_detalle: motivo });
    },
    async registrarAcceso() {
      const { error } = await sesion.rpc("registrar_evento", { p_tipo: "Acceso", p_entidad: "sesion" });
      if (error) throw new Error(error.message);
      const { data } = await sesion.auth.getUser();
      if (data.user) await servicio.from("usuario").update({ ultimo_acceso: new Date().toISOString() }).eq("id", data.user.id);
    },
  }, { usuario, contrasena });

  if (r.ok) redirect(r.destino);
  return { mensaje: r.mensaje, usuario };
}

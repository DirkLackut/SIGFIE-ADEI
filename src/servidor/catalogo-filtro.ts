import "server-only";
import { clienteSesion } from "./supabase";
import type { CatalogoFiltro } from "@/dominio/filtro";

/** Los catálogos que ofrecen los criterios del filtrado (CE-1). Incluye los
 *  valores desactivados: un filtro sobre 2021 tiene que poder elegirlos (001·CE-25). */
export async function catalogoFiltro(): Promise<CatalogoFiltro & { programas: string[]; sucursalesCompletas: { id: string; nombre: string; es_central: boolean }[] }> {
  const s = await clienteSesion();
  const [suc, mod, hor, niv, pro] = await Promise.all([
    s.from("sucursal").select("id, nombre, es_central").order("es_central", { ascending: false }).order("nombre"),
    s.from("modalidad").select("id, nombre").order("nombre"),
    s.from("horario").select("id, modalidad_id, hora_inicio, hora_fin").order("hora_inicio"),
    s.from("nivel").select("id, nombre, programa, orden").order("programa").order("orden"),
    s.from("profesor").select("id, nombres, apellidos").order("apellidos").order("nombres"),
  ]);
  const niveles = (niv.data ?? []) as { id: string; nombre: string; programa: string }[];
  return {
    sucursales: (suc.data ?? []).map((x) => ({ id: x.id, nombre: x.nombre })),
    sucursalesCompletas: suc.data ?? [],
    modalidades: mod.data ?? [],
    horarios: (hor.data ?? []) as CatalogoFiltro["horarios"],
    niveles,
    profesores: pro.data ?? [],
    programas: [...new Set(niveles.map((n) => n.programa))],
  };
}

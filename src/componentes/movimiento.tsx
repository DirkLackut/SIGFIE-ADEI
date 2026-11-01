"use client";
/**
 * Movimiento (plan §14, D19 y D20). Criterio de Emil Kowalski: solo se anima lo
 * que tiene propósito, lo frecuente no se anima, nada pasa de 300 ms, curvas de
 * salida rápida. Con «reducir movimiento» del sistema no hay animación
 * (MotionConfig reducedMotion="user" y la regla de globals.css).
 *
 * LazyMotion + domAnimation: se carga solo lo necesario para opacidad,
 * desplazamiento y altura (unos kB), no la librería entera.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { Toaster, toast } from "sonner";

const SALIDA = [0.23, 1, 0.32, 1] as const;

/** Envuelve la app una vez: configura motion y el lugar de los avisos pasajeros. */
export function ProveedorMovimiento({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: SALIDA }}>
        {children}
        {/* Abajo a la derecha en la PC; en el celular sonner los pone a lo ancho.
            Entran y salen por el mismo borde (continuidad espacial). */}
        <Toaster position="bottom-right" closeButton duration={4000}
          toastOptions={{
            classNames: {
              toast: "!font-sans !rounded-lg !border !border-cian/30 !bg-cian-suave !text-tinta !shadow-lg",
              title: "!font-semibold",
              closeButton: "!bg-papel !border-borde",
            },
          }} />
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * Confirma con un aviso pasajero lo que se hizo en el lugar (vincular, guardar
 * roles, desactivar). Los errores NO pasan por aquí: se quedan junto al campo
 * o en la caja de «Atención», porque hay que leerlos con calma (CE-37).
 */
export function useConfirmarExito(estado: object, exito: boolean, mensaje?: string) {
  const anterior = useRef(estado);
  useEffect(() => {
    if (estado === anterior.current) return; // solo cuando la acción responde, no al montar
    anterior.current = estado;
    if (exito && mensaje) toast.success(mensaje);
  }, [estado, exito, mensaje]);
}

/**
 * Panel que se despliega: «Editar datos», «Vincular tutor», «Roles»…
 * Ocasional, así que sí se anima: la altura crece desde el botón (200 ms) y al
 * cerrar se recoge más rápido (150 ms). Reemplaza a <details>, que no puede
 * animar la altura en todos los navegadores.
 */
export function Desplegable({ titulo, children, abiertoInicial = false, estilo = "bloque" }: {
  titulo: ReactNode; children: ReactNode; abiertoInicial?: boolean; estilo?: "bloque" | "boton";
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const id = useId();
  const boton = estilo === "bloque"
    ? "flex w-full items-center gap-2 px-4 py-2.5 text-left font-semibold text-azul hover:bg-papel-alt"
    : "boton inline-flex min-h-10 items-center gap-2 rounded-md border border-borde bg-papel px-4 py-2 text-sm font-semibold text-tinta hover:bg-papel-alt";
  return (
    <div className={estilo === "bloque" ? "rounded-md border border-borde" : ""}>
      <button type="button" className={boton} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((a) => !a)}>
        <m.span aria-hidden className="inline-block text-xs" animate={{ rotate: abierto ? 90 : 0 }} transition={{ duration: 0.15 }}>▶</m.span>
        {titulo}
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <m.div id={id} key="contenido" className="overflow-hidden"
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: "auto", opacity: 1 }}
                 exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}>
            <div className={estilo === "bloque" ? "border-t border-borde p-4" : "pt-2"}>{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Entrada corta de un elemento que aparece por una acción (un aviso, una
 * contraseña temporal, una confirmación). 8 px y fundido: se nota que algo
 * cambió, sin robar tiempo.
 */
export function Aparecer({ children, clave, destacar = false }: { children: ReactNode; clave?: string | number; destacar?: boolean }) {
  return (
    <AnimatePresence mode="popLayout">
      <m.div key={clave}
             initial={destacar ? { opacity: 0, scale: 0.96 } : { opacity: 0, y: 8 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, transition: { duration: 0.12 } }}
             transition={destacar ? { type: "spring", duration: 0.4, bounce: 0.2 } : undefined}>
        {children}
      </m.div>
    </AnimatePresence>
  );
}

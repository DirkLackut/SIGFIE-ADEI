# Impeccable en SIGFIE-ADEI

Copia de `pbakaus/impeccable` (Apache 2.0, motor 0.1.18), instalada el 2026-10-31.

- **Se incluyen** las instrucciones (`SKILL.md`, `reference/`) y el lanzador del motor
  (`scripts/impeccable`). El lanzador descarga el motor desde las *releases* de GitHub
  y **lo rechaza si su SHA-256 no coincide** con `scripts/engine-checksums.txt`.
- **No se incluye** el modo en vivo (`live-browser*.js`): abre un servidor que escribe en
  el código fuente. Si una orden lo pide, se responde que no está instalado.
- **Telemetría apagada:** antes de usarlo, `scripts/impeccable telemetry off`.
- **Uso en este proyecto:** modo *Operate* (herramienta de trabajo). Manda el manual de
  ADEI: ver la skill `marca-adei` y el plan §14. Órdenes útiles: `critique`, `audit`,
  `polish`, `harden`, `clarify`, `adapt`, y `detect` sobre la app en marcha.
- Nunca se apunta `detect` a un sitio desplegado con datos reales: solo a la app local
  con datos sintéticos.

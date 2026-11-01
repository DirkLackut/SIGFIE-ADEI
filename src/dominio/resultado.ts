/**
 * Resultado de una validación: el valor ya normalizado, o la regla incumplida
 * redactada para mostrársela al usuario (CE-37: "indicará el campo y la regla").
 */
export type Resultado<T = string> = { ok: true; valor: T } | { ok: false; regla: string };

export const valido = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
export const invalido = (regla: string): Resultado<never> => ({ ok: false, regla });

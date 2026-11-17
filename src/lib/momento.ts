// Cuándo sale una escena, para mostrarlo: «Ep 7 · 15:46», «ED2 · 0:45», «Ep 1».
// Vive aparte para que el navegador lo use sin cargar todos los datos de escenas.

export function momento(e: { ep: string | null; s: number | null }): string | null {
  const ep = e.ep == null ? '' : /^\d+$/.test(e.ep) ? `Ep ${e.ep}` : e.ep;
  const t = e.s ? `${Math.floor(e.s / 60)}:${String(e.s % 60).padStart(2, '0')}` : '';
  return [ep, t].filter(Boolean).join(' · ') || null;
}

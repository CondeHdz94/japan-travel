import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { getSecret } from 'astro:env/server';

const COOKIE = 'viajero';

function claveViaje(): string {
  const k = getSecret('TRIP_KEY');
  if (!k) throw new Error('Falta configurar TRIP_KEY');
  return k;
}

const hash = (s: string) => createHash('sha256').update(s).digest();

function firma(id: number): string {
  return createHmac('sha256', hash(`sesion:${claveViaje()}`)).update(String(id)).digest('base64url');
}

export function claveCorrecta(intento: unknown): boolean {
  if (typeof intento !== 'string') return false;
  return timingSafeEqual(hash(intento.trim()), hash(claveViaje()));
}

export function abrirSesion(cookies: AstroCookies, id: number) {
  cookies.set(COOKIE, `${id}.${firma(id)}`, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function cerrarSesion(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

/** Id de la persona con sesión abierta, o null. */
export function sesion(cookies: AstroCookies): number | null {
  const [idTxt, f] = (cookies.get(COOKIE)?.value ?? '').split('.');
  const id = Number(idTxt);
  if (!f || !Number.isInteger(id) || id <= 0) return null;
  const buena = Buffer.from(firma(id));
  const dada = Buffer.from(f);
  return buena.length === dada.length && timingSafeEqual(buena, dada) ? id : null;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

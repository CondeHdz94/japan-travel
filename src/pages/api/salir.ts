import type { APIRoute } from 'astro';
import { cerrarSesion, json } from '../../lib/sesion';

export const prerender = false;

export const POST: APIRoute = ({ cookies }) => {
  cerrarSesion(cookies);
  return json({ ok: true });
};

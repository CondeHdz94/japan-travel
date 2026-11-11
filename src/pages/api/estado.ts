import type { APIRoute } from 'astro';
import { estado } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => json(await estado(sesion(cookies)));

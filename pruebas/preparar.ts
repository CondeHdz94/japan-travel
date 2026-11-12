import { vaciarBase } from './ayudas';

/** Antes de la tanda: la base de pruebas arranca vacía. */
export default async function preparar() {
  await vaciarBase();
}

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Este proyecto

Sitio para organizar un viaje en grupo de Cali a Japón. El `README.md` explica la arquitectura,
el modelo de datos, la API y cómo se bajan las fotos: leerlo antes de tocar código.

Reglas de trabajo:

- **Idioma.** Todo en español (textos, nombres de variables, comentarios), con tono colombiano
  informal en lo que ve el usuario.
- **Diseño.** Es la prioridad. Mantener el sistema visual de `src/styles/global.css` y revisar
  cada cambio de interfaz en un navegador, en escritorio (1280) y en celular (390), con sesión
  abierta, antes de darlo por terminado.
- **Nada salta.** Poner o quitar un sello no puede mover el contenido: reservar el espacio.
- **Interactividad.** Usar los atributos `data-marca`, `data-poner` y `data-sellos` que maneja
  `src/scripts/grupo.ts`, en lugar de escribir lógica nueva por página.
- **Datos de viaje.** Lo que no esté verificado en una fuente oficial se marca «por confirmar».
- **Secretos.** `.env` y `.env.production` no suben al repo ni se leen sin permiso del usuario.
- **Publicar.** Un push a `main` sale directo al grupo: solo se hace cuando el usuario lo pide.
- **Pruebas.** Se prueba contra el servidor local (`.data/local.db`), y los viajeros o marcas de
  prueba se borran al terminar. En producción, solo con permiso y limpiando después.
- **Build en Windows.** `pnpm build` falla al empaquetar para Vercel (`EPERM symlink`); no es un
  error del código. Se verifica con el servidor de desarrollo.

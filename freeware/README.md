# Freeware — herramientas web gratuitas de ACACIA

Este directorio contiene todas las *free apps* / freeware de ACACIA. Es un
**módulo autocontenido y "split-ready"**: vive dentro de `acaciaco-site` pero
está diseñado para poder extraerse a su propio repositorio sin tocar el código
de las herramientas.

## Por qué vive aquí (decisión de arquitectura)

Se evaluó separar el freeware en un repo aparte. Para este caso —**un sitio
estático servido en Vercel, bajo un solo dominio y con assets/estilos/scripts
compartidos**— mantenerlo en el monorepo es la opción **más fácil de mantener**:

| Opción | Costo de mantenimiento |
| --- | --- |
| **Monorepo (elegida)** | Un solo `vercel.json`, un solo deploy, cero duplicación de `/styles`, `/scripts` y `/assets`. |
| Submódulo git | HEAD desprendido, doble commit por cambio, fricción diaria. |
| Repo espejo + subtree | Hay que sincronizar en cada cambio; los assets compartidos se duplican. |

La separación real solo conviene si en el futuro el freeware necesita un
**deploy/dominio/equipo independiente**. Mientras eso no pase, el monorepo gana.

## Estructura

```
freeware/
  index.html              ← hub: grid + JSON-LD ItemList + footer
  <herramienta>/
    index.html            ← página (SEO, JSON-LD, <style> con design tokens)
    app.jsx               ← lógica (React por CDN + Babel standalone)
    favicon.svg           ← ícono propio de la herramienta
```

Recursos compartidos (viven en la raíz del sitio, **no** en este directorio):

- `/styles/freeware-premium.css` — capa premium común (focus, scrollbar, reveals).
- `/scripts/analytics.js` — analítica ligera + `window.acaciaTrack(...)`.
- `/scripts/freeware-promo.js` — carrusel de promo de las apps de pago (FlowFin, etc.).
- `/assets/acacia-logo.jpg` — logo de marca.

## Convenciones para una nueva herramienta

1. Carpeta `freeware/<slug>/` con `index.html`, `app.jsx`, `favicon.svg`.
2. Reusar la plantilla de *design tokens* en el `<style>` (light + dark) y
   enlazar `/styles/freeware-premium.css`.
3. Soporte ES/EN, toggle de tema y `localStorage` (`acacia-theme`, `acacia-lang`).
4. Incluir `<div id="acacia-promo"></div>` + `/scripts/freeware-promo.js` y un
   CTA a la app de pago relevante (p. ej. FlowFin para herramientas de finanzas).
5. Cálculo 100% en el navegador; nada se sube.
6. Registrar la herramienta en:
   - `freeware/index.html` (grid, footer y JSON-LD `ItemList`).
   - `/sitemap.xml`.

## Cómo extraerlo a su propio repo (cuando convenga)

El seam ya está limpio. El día que se quiera un repo independiente:

```bash
# 1) Sacar el historial de /freeware a una rama nueva
git subtree split --prefix=freeware -b freeware-only

# 2) Crear el repo nuevo y empujar esa rama
git push git@github.com:jospabloh/acacia-freeware.git freeware-only:main

# 3) En acacia-site, decidir el mecanismo de consumo:
#    - submódulo:  git submodule add <repo> freeware
#    - subtree:    git subtree add --prefix=freeware <repo> main --squash
```

Habría que mover/duplicar los recursos compartidos (`/styles/freeware-premium.css`,
`/scripts/*.js`, `/assets/acacia-logo.jpg`) o exponerlos vía CDN, y añadir un
`vercel.json` propio al nuevo repo. Mientras tanto, todo funciona con el deploy
único de `acaciaco-site`.

# FOOTBALL TYCOON — Static Deployment Guide

**Tagline:** *Build Your Club. Control Your Legacy.*

FOOTBALL TYCOON is a 100% client-side, local-first React + TypeScript + Vite application. All historical JSON databases, simulation engines, and IndexedDB save persistence run entirely in the browser with no backend, no database server, and no external API keys required.

## Build for Production

```bash
npm install
npm run build
```

This outputs the production static bundle to `dist/`.

## Free Static Hosting Options

### 1. Cloudflare Pages (Recommended)
1. Push the repository to GitHub/GitLab, or deploy directly with Wrangler:
   ```bash
   npx wrangler pages deploy dist --project-name=football-tycoon
   ```
2. If connecting via the Cloudflare Pages dashboard:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`

### 2. Netlify
```bash
npx netlify-cli deploy --prod --dir=dist
```
- **Build command:** `npm run build`
- **Publish directory:** `dist`

### 3. Vercel
```bash
npx vercel --prod
```
- **Framework Preset:** Vite
- **Output Directory:** `dist`

### 4. GitHub Pages
Upload the `dist/` directory via `gh-pages` or GitHub Actions (`actions/upload-pages-artifact`). If hosting under a repository subpath (e.g. `https://user.github.io/football-tycoon/`), set `base: './'` in `vite.config.ts`.

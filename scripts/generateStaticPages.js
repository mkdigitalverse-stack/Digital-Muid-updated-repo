import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEO_DATA, injectSeoIntoHtml } from '../server/htmlSeoInjector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const baseIndexHtmlPath = path.join(distDir, 'index.html');

function generatePages() {
  if (!fs.existsSync(baseIndexHtmlPath)) {
    console.error(`[SSG Generator] Base dist/index.html not found at ${baseIndexHtmlPath}. Run vite build first.`);
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(baseIndexHtmlPath, 'utf8');

  // 1. Update root dist/index.html with root SEO
  const rootHtml = injectSeoIntoHtml(baseHtml, '/');
  fs.writeFileSync(baseIndexHtmlPath, rootHtml, 'utf8');
  console.log('[SSG Generator] Updated dist/index.html with root homepage SEO & canonical.');

  // 2. Generate subdirectories and index.html for each public page
  for (const [routePath, seo] of Object.entries(SEO_DATA)) {
    if (routePath === '/') continue;

    const cleanSubdir = routePath.replace(/^\/+/, '');
    const targetDir = path.join(distDir, cleanSubdir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const pageHtml = injectSeoIntoHtml(baseHtml, routePath);
    const targetHtmlPath = path.join(targetDir, 'index.html');
    fs.writeFileSync(targetHtmlPath, pageHtml, 'utf8');

    console.log(`[SSG Generator] Generated static SEO page: ${cleanSubdir}/index.html (Canonical: ${seo.canonicalUrl})`);
  }

  console.log('[SSG Generator] Successfully generated all static SEO pre-rendered pages!');
}

generatePages();

// Turn the Vite build into a claude.ai Artifact page: the page itself (title,
// inlined styles, font link, root, module script) plus the scripts it loads,
// published beside it with the Artifact tool's `files` map.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = 'artifact';
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const script = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)?.[1];
const fonts = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)"/)?.[1];
if (!script || !cssHref) throw new Error('Could not find the entry script or stylesheet in dist/index.html');

const css = readFileSync(join(dist, cssHref), 'utf8');
if (/<\/style/i.test(css)) throw new Error('Stylesheet contains a closing style tag');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const page = `<title>Floorplan Studio</title>
<style>
${css.trim()}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts ? `<link rel="stylesheet" href="${fonts}">` : ''}
<div id="root"></div>
<script type="module" src="${script}"></script>
`;
writeFileSync(join(out, 'index.html'), page);

const files = {};
let total = page.length;
for (const f of readdirSync(join(dist, 'assets'))) {
  if (f.endsWith('.css')) continue;
  copyFileSync(join(dist, 'assets', f), join(out, 'assets', f));
  files[`assets/${f}`] = `${out}/assets/${f}`;
  total += statSync(join(dist, 'assets', f)).size;
}
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 2));
console.log(`artifact/index.html ${(page.length / 1024).toFixed(1)} kB + ${Object.keys(files).length} files, ${(total / 1024 / 1024).toFixed(2)} MB total`);

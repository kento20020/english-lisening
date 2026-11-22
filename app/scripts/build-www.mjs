// mimic/ の B Pocket（デザイン案）から、iOS アプリに入れる画面（www/）を作る。
// Pocket の見た目を直せば、次のビルドでアプリにもそのまま反映される。
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const mimicDir = path.resolve(appDir, '../mimic');
const out = path.join(appDir, 'www');

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`pocket.html の「${label}」が ${count} 箇所見つかりました（1 箇所のはず）。build-www.mjs を Pocket に合わせて直してください。`);
  }
  return text.replace(from, to);
}

function removeBetween(text, startMark, endMark, label) {
  const s = text.indexOf(startMark);
  const e = text.indexOf(endMark, s);
  if (s < 0 || e < 0) throw new Error(`pocket.html の「${label}」が見つかりません`);
  return text.slice(0, s) + text.slice(e + endMark.length);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const f of ['base.css', 'pocket.css', 'mimic.js', 'logo.svg']) {
  await cp(path.join(mimicDir, f), path.join(out, f));
}

let html = await readFile(path.join(mimicDir, 'pocket.html'), 'utf8');
// 試作用のデザイン切り替えバーは、アプリには要らない
html = removeBetween(html, '<nav class="proto-bar"', '</nav>\n', 'デザイン案の切り替えバー');
// オフラインでも同じ見た目になるよう、ネットのフォントは使わず iPhone の丸ゴシックで表示する
html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '');
html = html.replace(/\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
html = replaceOnce(html, '<title>Mimic Pocket</title>', '<title>Mimic</title>', 'タイトル');
html = replaceOnce(html, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="format-detection" content="telephone=no">',
  'viewport');
html = replaceOnce(html, '<link rel="stylesheet" href="pocket.css">',
  '<link rel="stylesheet" href="pocket.css">\n<link rel="stylesheet" href="app.css">', 'pocket.css の読み込み');
html = replaceOnce(html, '<script src="mimic.js"></script>',
  '<script src="mimic.js"></script>\n<script src="app.js"></script>', 'mimic.js の読み込み');
await writeFile(path.join(out, 'index.html'), html);

await cp(path.join(appDir, 'src/app.css'), path.join(out, 'app.css'));
await build({
  entryPoints: [path.join(appDir, 'src/app.js')],
  outfile: path.join(out, 'app.js'),
  bundle: true,
  format: 'iife',
  target: ['safari15'],
  legalComments: 'none',
  logLevel: 'warning',
});

console.log('www/ を作りました（B Pocket ＋ 課金まわり）');

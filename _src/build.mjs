// Builds the website from _src: one page per language, plus the legal pages.
// Run from the website folder: node _src/build.mjs
// config.json holds the on/off switches. A language goes live when its code is in config.languages.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SRC, '..');
const read = (file) => readFileSync(join(SRC, file), 'utf8');
const config = JSON.parse(read('config.json'));
const LANG_NAME = { en: 'EN', it: 'IT', es: 'ES' };

const homeOf = (lang) => (lang === 'en' ? '/' : `/${lang}/`);

// <!--if:name--> … <!--/if--> keeps its content when the switch is on; <!--if:!name--> when it's off.
function applySwitches(html) {
  return html.replace(/<!--if:(!?)(\w+)-->([\s\S]*?)<!--\/if-->/g, (_, not, name, body) => {
    if (!(name in config)) throw new Error(`Unknown switch: ${name}`);
    return Boolean(config[name]) !== Boolean(not) ? body : '';
  });
}

function fill(html, values) {
  const out = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Missing text: ${key}`);
    return values[key];
  });
  return out;
}

function headline(lines) {
  let delay = 0.05;
  const word = (w, last) => {
    if (w === '@icon') return '<span class="pop" aria-hidden="true"><svg class="ic"><use href="#i-shield"/></svg></span>';
    const html = `<span class="w${last ? ' fx' : ''}" style="--d:${delay.toFixed(2)}s">${w}</span>`;
    delay += 0.12;
    return html;
  };
  return lines
    .map((line, i) => `<span class="l">${line.map((w) => word(w, i === lines.length - 1)).join(' ')}</span>`)
    .join('');
}

function languageLinks(lang, path, label) {
  if (config.languages.length < 2) return '';
  const links = config.languages.map((code) => {
    const current = code === lang ? ' aria-current="true"' : '';
    return `<a href="${homeOf(code)}${path}" hreflang="${code}" data-lang="${code}"${current}>${LANG_NAME[code]}</a>`;
  });
  return `<details class="langs"><summary aria-label="${label}: ${LANG_NAME[lang]}">${LANG_NAME[lang]}</summary><div class="lang-menu">${links.join('')}</div></details>`;
}

function shared(lang, copy, path) {
  const parts = { ...copy, lang, home: homeOf(lang), languageLinks: languageLinks(lang, path, copy.languageLabel), langRedirect: lang === 'en' && !path ? read('parts/redirect.html') : '' };
  return {
    ...parts,
    header: fill(applySwitches(read('parts/header.html')), parts),
    footer: fill(read('parts/footer.html'), parts),
    storeButtons: fill(applySwitches(read('parts/stores.html')), parts),
    fixSpan: config.alerts ? 'c7' : 'c12',
  };
}

function alternates(path) {
  const links = config.languages.map((code) => `<link rel="alternate" hreflang="${code}" href="https://spamlock.app${homeOf(code)}${path}">`);
  return [...links, `<link rel="alternate" hreflang="x-default" href="https://spamlock.app/${path}">`].join('\n');
}

function write(file, html) {
  const target = join(ROOT, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log('wrote', file);
}

for (const lang of config.languages) {
  const copy = JSON.parse(read(`copy/${lang}.json`));
  const client = {
    lang,
    android: config.android,
    film: { app: `/assets/film/film-${lang}-appstore.mp4`, play: `/assets/film/film-${lang}-play.mp4`, poster: `/assets/film/poster-${lang}.webp` },
    ...copy.client,
  };
  const values = {
    ...shared(lang, copy, ''),
    h1: headline(copy.h1Lines),
    alternates: alternates(''),
    client: JSON.stringify(client).replace(/</g, '\\u003c'),
  };
  write(`${lang === 'en' ? '' : `${lang}/`}index.html`, fill(applySwitches(read('page.html')), values));

  for (const page of ['privacy', 'terms']) {
    const file = `legal/${page}.${lang}.html`;
    const legal = { ...shared(lang, copy, `${page}.html`), content: read(file), pageTitle: copy[`${page}Title`], alternates: alternates(`${page}.html`) };
    write(`${lang === 'en' ? '' : `${lang}/`}${page}.html`, fill(read('legal.html'), legal));
  }
}

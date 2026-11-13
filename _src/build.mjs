// Builds the website from _src: one page per language, plus the legal pages.
// Run from the website folder: node _src/build.mjs
// config.json holds the on/off switches. A language goes live when its code is in config.languages.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHelp, HELP_BASE } from './help/build-help.mjs';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SRC, '..');
const read = (file) => readFileSync(join(SRC, file), 'utf8');
const config = JSON.parse(read('config.json'));
const LANG_NAME = { en: 'EN', it: 'IT', es: 'ES' };
const HELP_LANGUAGES = JSON.parse(read('help/help.json')).languages;

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
    .join(' ');
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
  const parts = { ...copy, lang, home: homeOf(lang), helpNav: helpNav(lang, copy), languageLinks: languageLinks(lang, path, copy.languageLabel), langRedirect: lang === 'en' && !path ? read('parts/redirect.html') : '' };
  return {
    ...parts,
    header: fill(applySwitches(read('parts/header.html')), parts),
    footer: fill(read('parts/footer.html'), parts),
    storeButtons: fill(applySwitches(read('parts/stores.html')), parts),
    fixSpan: config.alerts ? 'c7' : 'c12',
  };
}

// Links to the other parts of the site: in the header on computers, in the row under it on phones.
function helpNav(lang, copy) {
  if (!HELP_LANGUAGES.includes(lang)) return '';
  return `<a class="nav-help" href="${HELP_BASE[lang]}">${copy.navHelp}</a>`;
}

function alternates(path) {
  const links = config.languages.map((code) => `<link rel="alternate" hreflang="${code}" href="https://spamlock.app${homeOf(code)}${path}">`);
  return [...links, `<link rel="alternate" hreflang="x-default" href="https://spamlock.app/${path}">`].join('\n');
}

// Long-cached files get a ?v= stamp from their content, so a change reaches visitors straight away.
function stampAssets(html) {
  return html.replace(/\/assets\/(site\.css|site\.js|consent\.js|lang\.js|help\.css|help\.js)/g, (path) => {
    const hash = createHash('sha1').update(readFileSync(join(ROOT, path))).digest('hex').slice(0, 8);
    return `${path}?v=${hash}`;
  });
}

// Links to other websites open in a new tab, so the visitor keeps our page open.
function externalLinksNewTab(html) {
  return html.replace(/<a ([^>]*?)href="(https?:\/\/(?!spamlock\.app)[^"]*)"([^>]*)>/g, (tag, before, url, after) =>
    /\btarget=/.test(before + after) ? tag : `<a ${before}href="${url}"${after} target="_blank" rel="noopener">`);
}

function write(file, html) {
  const target = join(ROOT, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.endsWith('.html') ? externalLinksNewTab(stampAssets(html)) : html);
  console.log('wrote', file);
}

// Search engines' description of the app, the site and the launch film for one language.
function structuredData(lang, copy) {
  const site = 'https://spamlock.app';
  const url = `${site}${homeOf(lang)}`;
  const stores = ['https://apps.apple.com/app/id1529407969'];
  if (config.android) stores.push('https://play.google.com/store/apps/details?id=com.maxaquilino.spamlock');
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'Spamlock',
        url: `${site}/`,
        logo: `${site}/assets/apple-touch-icon.png`,
        email: 'spamlock.app@gmail.com',
        sameAs: stores,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: 'Spamlock',
        url,
        inLanguage: lang,
        publisher: { '@id': `${site}/#organization` },
      },
      {
        '@type': 'MobileApplication',
        '@id': `${url}#app`,
        name: 'Spamlock',
        url,
        description: copy.metaDescription,
        inLanguage: lang,
        applicationCategory: 'SecurityApplication',
        operatingSystem: config.android ? 'iOS, Android' : 'iOS',
        installUrl: stores,
        image: `${site}/assets/film/og-${lang}.jpg`,
        screenshot: `${site}/assets/media/${lang}/home.webp`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': `${site}/#organization` },
      },
      {
        '@type': 'VideoObject',
        '@id': `${url}#film`,
        name: copy.client.filmLabel,
        description: copy.filmLead,
        inLanguage: lang,
        thumbnailUrl: `${site}/assets/film/og-${lang}.jpg`,
        contentUrl: `${site}/assets/film/film-${lang}-appstore.mp4`,
        uploadDate: '2026-11-02',
        duration: 'PT34S',
      },
    ],
  }).replace(/</g, '\\u003c');
}

// One entry per page, each naming its translations. Help pages name only the translations they really have.
function sitemap(lastmod, help) {
  const entry = (path) => config.languages.map((lang) => {
    const links = [...config.languages.map((code) => [code, code]), ['x-default', 'en']]
      .map(([tag, code]) => `    <xhtml:link rel="alternate" hreflang="${tag}" href="https://spamlock.app${homeOf(code)}${path}"/>`)
      .join('\n');
    return `  <url>\n    <loc>https://spamlock.app${homeOf(lang)}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n${links}\n  </url>`;
  }).join('\n');
  const helpEntry = ({ path, lastmod: date, alternates }) => {
    const links = alternates ? [...Object.entries(alternates), ...(alternates.en ? [['x-default', alternates.en]] : [])]
      .map(([tag, href]) => `\n    <xhtml:link rel="alternate" hreflang="${tag}" href="https://spamlock.app${href}"/>`).join('') : '';
    return `  <url>\n    <loc>https://spamlock.app${path}</loc>\n    <lastmod>${date || lastmod}</lastmod>${links}\n  </url>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${['', 'privacy.html', 'terms.html'].map(entry).join('\n')}\n${help.map(helpEntry).join('\n')}${help.length ? '\n' : ''}</urlset>\n`;
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
    ogAlternates: copy.ogAlternates.map((locale) => `<meta property="og:locale:alternate" content="${locale}">`).join('\n'),
    jsonLd: structuredData(lang, copy),
    client: JSON.stringify(client).replace(/</g, '\\u003c'),
  };
  write(`${lang === 'en' ? '' : `${lang}/`}index.html`, fill(applySwitches(read('page.html')), values));

  for (const page of ['privacy', 'terms']) {
    const file = `legal/${page}.${lang}.html`;
    const legal = { ...shared(lang, copy, `${page}.html`), content: read(file), pageTitle: copy[`${page}Title`], pageDescription: copy[`${page}Description`], pagePath: `${page}.html`, alternates: alternates(`${page}.html`) };
    write(`${lang === 'en' ? '' : `${lang}/`}${page}.html`, fill(read('legal.html'), legal));
  }
}

const help = buildHelp({ read, write, fill, applySwitches, shared, config, src: SRC });
write('sitemap.xml', sitemap(new Date().toISOString().slice(0, 10), help));
write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: https://spamlock.app/sitemap.xml\n');

// Security help pages (/help/): hub, guides, articles and the news list, built from _src/help.
// Called by _src/build.mjs, which passes its own helpers so the shared header, footer and store buttons stay identical.
// Content: one JSON per page in content/<lang>/<slug>.json; news items in news/<lang>.json (optional).
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://spamlock.app';
export const HELP_BASE = { en: '/help/', it: '/it/guide/', es: '/es/guia/' };
const BASE = HELP_BASE;
const DAY = 24 * 60 * 60 * 1000;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const say = (text, values) => text.replace(/%\{(\w+)\}/g, (_, key) => values[key]);
const ic = (id) => `<svg class="h-ic" aria-hidden="true"><use href="#${id}"/></svg>`;
const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function longDate(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

function check(page, file, needed) {
  for (const key of needed) if (page[key] == null || page[key] === '') throw new Error(`${file}: missing "${key}"`);
  for (const key of ['published', 'reviewed']) {
    if (page[key] && !/^\d{4}-\d{2}-\d{2}$/.test(page[key])) throw new Error(`${file}: "${key}" must be YYYY-MM-DD`);
  }
}

export function buildHelp({ read, write, fill, applySwitches, shared, config, src }) {
  const settings = JSON.parse(read('help/help.json'));
  const frame = read('help/page.html');
  const urls = [];
  const warnings = [];
  // Start from an empty output folder, so a page removed from content/ disappears from the site too.
  for (const base of Object.values(BASE)) rmSync(join(src, '..', base), { recursive: true, force: true });

  // Translations: a page and its versions in other languages share a key, the English slug ("translationOf").
  // Pages are written natively in each language, so only pages that really have a twin get hreflang links.
  const twins = { hub: {} };
  for (const lang of settings.languages) {
    if (!BASE[lang]) throw new Error(`No help folder for language: ${lang}`);
    twins.hub[lang] = BASE[lang];
    for (const f of readdirSync(join(src, 'help/content', lang)).filter((name) => name.endsWith('.json'))) {
      const slug = f.replace(/\.json$/, '');
      const key = lang === 'en' ? slug : JSON.parse(read(`help/content/${lang}/${f}`)).translationOf || `${lang}:${slug}`;
      (twins[key] ||= {})[lang] = `${BASE[lang]}${slug}.html`;
    }
  }
  for (const [key, paths] of Object.entries(twins)) {
    if (key !== 'hub' && !key.includes(':') && !paths.en) throw new Error(`translationOf "${key}": no English page with that name`);
  }
  const alternates = (key) => {
    const paths = twins[key] || {};
    if (Object.keys(paths).length < 2) return '';
    return [...Object.entries(paths), ...(paths.en ? [['x-default', paths.en]] : [])]
      .map(([code, path]) => `<link rel="alternate" hreflang="${code}" href="${SITE}${path}">`).join('\n');
  };
  // The language menu opens the same page in the other language when it exists, else that language's home.
  const languageMenu = (header, key) => header.replace(/href="[^"]*" hreflang="(\w+)" data-lang/g, (tag, code) =>
    (twins[key]?.[code] ? `href="${twins[key][code]}" hreflang="${code}" data-lang` : tag));

  for (const lang of settings.languages) {
    const base = BASE[lang];
    const t = JSON.parse(read(`help/${lang}.json`));
    const copy = JSON.parse(read(`copy/${lang}.json`));
    const site = shared(lang, copy, '');
    // On help pages the header link shows where the visitor is.
    const frameValues = { ...site, header: site.header.replaceAll('class="nav-help"', 'class="nav-help" aria-current="page"'), siteName: copy.siteName, ogLocale: copy.ogLocale };
    const fileOf = (path) => path.replace(/^\//, '').replace(/\/$/, '/index.html');

    // Pages
    const dir = join(src, 'help/content', lang);
    const pages = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
      const page = JSON.parse(read(`help/content/${lang}/${f}`));
      page.slug = f.replace(/\.json$/, '');
      page.path = `${base}${page.slug}.html`;
      check(page, f, ['type', 'topic', 'short', 'title', 'pageTitle', 'description', 'published', 'reviewed', 'answer']);
      if (!['guide', 'article'].includes(page.type)) throw new Error(`${f}: unknown type "${page.type}"`);
      if (!t.topics[page.topic]) throw new Error(`${f}: unknown topic "${page.topic}"`);
      if (page.type === 'guide' && !page.steps?.length) throw new Error(`${f}: a guide needs steps`);
      // Headings are written for each page, never shared, so every page can rank for its own topic.
      if (page.type === 'guide') check(page, f, ['stepsTitle']);
      if (page.can?.length) check(page, f, ['canTitle']);
      return page;
    });
    const bySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
    // Same order as the app's Urgent help list.
    const guides = pages.filter((p) => p.type === 'guide' && p.topic === 'whatif').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const articles = pages.filter((p) => !guides.includes(p)).sort((a, b) => b.published.localeCompare(a.published));

    const newsFile = `help/news/${lang}.json`;
    const news = existsSync(join(src, newsFile)) ? JSON.parse(read(newsFile)) : [];
    news.forEach((n, i) => check(n, `${newsFile} item ${i + 1}`, ['id', 'date', 'tag', 'title', 'summary', 'source']));
    news.sort((a, b) => b.date.localeCompare(a.date));
    const newsPath = `${base}news.html`;

    // Sections that exist on the hub, so topic links never point at nothing.
    const hubAnchor = { whatif: guides.length ? 'topic-whatif' : null };
    const topicLink = (topic) => (hubAnchor[topic] ? `${base}#${hubAnchor[topic]}` : null);

    const crumbs = (items) => `<nav class="h-crumbs" aria-label="${t.breadcrumb}">${items
      .map(([name, href]) => (href ? `<a href="${href}">${esc(name)}</a>` : `<span>${esc(name)}</span>`))
      .join('<span aria-hidden="true">/</span>')}</nav>`;

    const storeUrl = 'https://apps.apple.com/app/id1529407969';
    const appCard = (app) => app ? `<aside class="h-card h-app" aria-label="${esc(app.title)}">
    <span class="h-app-logo">${ic('i-lock')}</span>
    <p class="h-app-title">${esc(app.title)}</p>
    <p>${esc(app.text)}</p>
    <a class="h-btn" href="${storeUrl}">${ic('i-phone')}${copy.downloadIphone}</a>${config.android ? `
    <a class="h-btn" href="https://play.google.com/store/apps/details?id=com.maxaquilino.spamlock">${ic('i-android')}${copy.downloadAndroid}</a>` : ''}
  </aside>` : '';

    const related = (page) => {
      const links = (page.related || []).map((slug) => {
        const other = bySlug[slug];
        if (!other) throw new Error(`${page.slug}: related page "${slug}" doesn't exist`);
        return `<a class="h-rel" href="${other.path}">${esc(other.short)}</a>`;
      });
      const sources = (page.sources || []).map((s) => `<a href="${esc(s.url)}">${esc(s.label)}</a>`);
      if (!links.length && !sources.length) return '';
      const list = sources.length > 1 ? `${sources.slice(0, -1).join(', ')} ${t.and} ${sources.at(-1)}` : sources[0];
      return `<section class="h-related"${links.length ? ` aria-label="${t.relatedTitle}"` : ''}>${links.length ? `
      <p class="h-rel-title">${t.relatedTitle}</p>
      ${links.join('\n      ')}` : ''}${sources.length ? `
      <p class="h-small h-sources">${say(t.sources, { list })}</p>` : ''}
    </section>`;
    };

    // No date on the page (user, 2026-11-13); "reviewed" stays in the data for Google and the build warnings.
    const checkedLine = (page) => (page.checkedOn ? esc(say(t.checkedOn, { os: page.checkedOn.os, version: page.checkedOn.version })) : '');

    // Old or out-of-date pages: a reminder in the build output, never a failure.
    const now = Date.now();
    for (const page of pages) {
      const months = (now - Date.parse(`${page.reviewed}T00:00:00Z`)) / DAY / 30.44;
      if (months > settings.reviewEveryMonths) warnings.push(`${page.path}: reviewed ${page.reviewed}, more than ${settings.reviewEveryMonths} months ago`);
      const latest = page.checkedOn && settings.latestOs[page.checkedOn.os];
      if (latest && parseInt(page.checkedOn.version, 10) < latest) warnings.push(`${page.path}: checked on ${page.checkedOn.os} ${page.checkedOn.version}, ${page.checkedOn.os} ${latest} is out`);
    }

    const structured = (page, trail) => ld({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: page.title,
          description: page.description,
          inLanguage: lang,
          datePublished: page.published,
          dateModified: page.reviewed,
          mainEntityOfPage: `${SITE}${page.path}`,
          author: { '@type': 'Organization', name: 'Spamlock', url: `${SITE}/` },
          publisher: { '@type': 'Organization', name: 'Spamlock', url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/assets/apple-touch-icon.png` } },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: trail.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(path ? { item: `${SITE}${path}` } : {}) })),
        },
      ],
    });

    const writePage = (path, key, values) => {
      const header = languageMenu(frameValues.header, key);
      write(fileOf(path), fill(applySwitches(frame), { ...frameValues, header, pagePath: path, mainClass: '', alternates: alternates(key), ...values }));
      urls.push({ path, lastmod: values.lastmod, alternates: twins[key] && Object.keys(twins[key]).length > 1 ? twins[key] : null });
    };

    for (const page of pages) {
      const topicName = t.topics[page.topic];
      const trail = [[t.hubName, base], [topicName, topicLink(page.topic)], [page.short, page.path]];
      const common = {
        crumbs: crumbs(trail.slice(0, 2)),
        title: esc(page.title),
        checked: checkedLine(page) ? `\n      <p class="h-small">${checkedLine(page)}</p>` : '',
        answerLabel: t.answerLabel,
        answer: esc(page.answer),
        related: related(page),
        appCard: appCard(page.app),
      };
      let content;
      if (page.type === 'guide') {
        const steps = page.steps.map((s, i) => `        <li class="h-card h-step">
          <span class="h-num" aria-hidden="true">${i + 1}</span>
          <div class="h-step-text">
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.text)}</p>${s.links?.length ? `
            <div class="h-links">${s.links.map((l) => `<a class="h-chip" href="${esc(l.url)}">${esc(l.label)}${ic('h-out')}</a>`).join('')}</div>` : ''}
          </div>
        </li>`).join('\n');
        content = fill(read('help/guide.html'), { ...common, stepsTitle: esc(page.stepsTitle), stepsIntro: t.stepsIntro, steps });
      } else {
        content = fill(read('help/article.html'), { ...common, chat: chat(page, t), parts: parts(page), can: can(page.can, page.canTitle && esc(page.canTitle)) });
      }
      writePage(page.path, lang === 'en' ? page.slug : page.translationOf || `${lang}:${page.slug}`, { pageId: page.slug, pageTitle: esc(page.pageTitle), pageDescription: esc(page.description), ogType: 'article', jsonLd: structured(page, trail), content, lastmod: page.reviewed, mainClass: ' has-crumbs' });
    }

    // News list
    const tagClass = { scam: 'amber', breach: '', phones: 'slate' };
    if (news.length) {
      const tags = [...new Set(news.map((n) => n.tag))];
      for (const tag of tags) if (!t.newsTags[tag]) throw new Error(`${newsFile}: unknown tag "${tag}"`);
      const filters = tags.length > 1 ? `<div class="h-filters" role="group" aria-label="${t.newsTitle}"><button class="h-filter" type="button" aria-pressed="true">${t.newsAll}</button>${tags.map((tag) => `<button class="h-filter" type="button" aria-pressed="false" data-tag="${tag}">${t.newsFilters[tag]}</button>`).join('')}</div>` : '';
      const items = news.map((n) => `    <li class="h-card h-item" id="${esc(n.id)}" data-tag="${n.tag}">
      <div class="h-item-meta"><span class="h-tag ${tagClass[n.tag]}">${t.newsTags[n.tag]}</span><span class="h-small">${longDate(n.date, lang)}</span></div>
      <h2>${esc(n.title)}</h2>
      <p>${esc(n.summary)}</p>
      <div class="h-item-foot"><a href="${esc(n.source.url)}">${t.newsSource} ${esc(n.source.label)}</a>${n.app ? `<span class="h-tag">${t.newsInApp} ${esc(n.app)}</span>` : ''}</div>
    </li>`).join('\n');
      const content = fill(read('help/news.html'), { crumbs: crumbs([[t.hubName, base]]), title: t.newsTitle, intro: t.newsIntro, filters, items, note: t.newsNote });
      writePage(newsPath, 'news', { pageId: 'news', pageTitle: esc(t.newsPageTitle), pageDescription: esc(t.newsDescription), ogType: 'website', jsonLd: '', content, lastmod: news[0].date });
    }

    // Hub
    const shownTopics = settings.topics.filter((tp) => hubAnchor[tp.id]);
    const topics = shownTopics.length > 1 ? `<nav class="h-pills" aria-label="${t.hubName}">${shownTopics.map((tp) => `<a class="h-pill" href="#${hubAnchor[tp.id]}">${ic(tp.icon)}${t.topics[tp.id]}</a>`).join('')}</nav>` : '';
    const featured = articles.find((a) => a.featured);
    const top = [
      featured ? `<a class="h-card h-feature" href="${featured.path}">${featured.chat ? miniChat(featured.chat[0]) : ''}
      <span class="h-small">${t.topics[featured.topic]}</span>
      <span class="h-title">${esc(featured.title)}</span>
    </a>` : '',
      news.length ? `<section class="h-card h-latest" aria-labelledby="latest">
      <div class="h-latest-head"><span class="h-live" aria-hidden="true"></span><h2 id="latest">${t.latestTitle}</h2><a href="${newsPath}">${t.allNews}</a></div>
      ${news.slice(0, 4).map((n) => `<a class="h-latest-row" href="${newsPath}#${esc(n.id)}"><span class="h-small">${longDate(n.date, lang)}, ${t.newsTags[n.tag]}</span><b>${esc(n.title)}</b></a>`).join('\n      ')}
    </section>` : '',
    ].filter(Boolean);
    const hub = fill(read('help/hub.html'), {
      title: t.hubTitle,
      intro: t.hubIntro,
      topics,
      top: top.length ? `  <div class="${top.length > 1 ? 'h-grid2' : ''}">\n    ${top.join('\n    ')}\n  </div>` : '',
      whatIf: guides.length ? `  <section class="h-section" id="topic-whatif" aria-labelledby="whatif">
    <div class="h-section-head"><h2 id="whatif">${t.whatIfTitle}</h2><span class="h-muted">${t.whatIfLead}</span></div>
    <div class="h-whatif">
      ${guides.map((g) => `<a class="h-card" href="${g.path}">${esc(g.short)}${ic('h-arrow')}</a>`).join('\n      ')}
    </div>
  </section>` : '',
      articles: articles.length ? `  <section class="h-section" aria-labelledby="recent">
    <h2 id="recent">${t.articlesTitle}</h2>
    <div class="h-grid3">
      ${articles.slice(0, 6).map((a) => `<a class="h-card h-article-card" href="${a.path}"><span class="h-tag">${t.topics[a.topic]}</span><span class="h-title">${esc(a.title)}</span>${checkedLine(a) ? `<span class="h-small">${checkedLine(a)}</span>` : ''}</a>`).join('\n      ')}
    </div>
  </section>` : '',
    });
    writePage(base, 'hub', { pageId: 'hub', pageTitle: esc(t.hubPageTitle), pageDescription: esc(t.hubDescription), ogType: 'website', jsonLd: '', content: hub, lastmod: null });
  }

  for (const w of warnings) console.warn('REVIEW', w);
  return urls;
}

// Animated scam chat: tabs per scam; each scene = example chat + warning signs + what you can do.
function chat(page, t) {
  if (!page.chat?.length) return '';
  const id = (i) => `scene-${i + 1}`;
  const tabs = page.chat.length > 1 ? `    <div class="h-tabs" role="tablist" aria-label="${t.chatTabs}">${page.chat.map((s, i) => `<button class="h-tab" type="button" role="tab" id="tab-${i + 1}" aria-controls="${id(i)}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${esc(s.label)}</button>`).join('')}</div>\n` : '';
  const scenes = page.chat.map((s, i) => {
    const d = (n) => `d${n + 1}`;
    return `    <div class="h-scene" id="${id(i)}"${page.chat.length > 1 ? ` role="tabpanel" aria-labelledby="tab-${i + 1}"` : ''}${i ? ' hidden' : ''}>
      <div class="h-stage">
        <div class="h-phone" aria-label="${t.chatLabel}" role="img">
          <div class="h-phone-top"><span class="h-avatar">${ic('h-person')}</span><span class="h-who"><b>${esc(s.who)}</b><span>${esc(s.whoNote)}</span></span></div>
          <div class="h-chat"><span class="h-typing" aria-hidden="true"><i></i><i></i><i></i></span>
            ${s.messages.map((m, n) => `<p class="h-msg ${d(n)}">${esc(m.text)}<span class="h-flag ${d(n)}">${n + 1}</span></p>`).join('\n            ')}
          </div>
        </div>
        <ol class="h-signs">
          ${s.messages.map((m, n) => `<li class="h-sign ${d(n)}"><span>${n + 1}</span>${esc(m.sign)}</li>`).join('\n          ')}
        </ol>
      </div>
${s.can?.length ? can(s.can, null) : ''}
    </div>`;
  }).join('\n');
  return tabs + scenes;
}

function miniChat(scene) {
  const [a, b] = scene.messages;
  return `<span class="h-mini" aria-hidden="true"><span class="h-typing"><i></i><i></i><i></i></span><span class="h-msg d1">${esc(a.text)}</span>${b ? `<span class="h-msg d2">${esc(b.text)}<span class="h-flag d2">!</span></span>` : ''}</span>`;
}

function parts(page) {
  return (page.parts || []).map((p) => `    <section class="h-part">
      <h2>${esc(p.title)}</h2>
      ${[].concat(p.text).map((para) => `<p>${esc(para)}</p>`).join('\n      ')}
    </section>`).join('\n');
}

function can(list, title) {
  if (!list?.length) return '';
  const items = `<ol class="h-can h-grid3">${list.map((c) => `<li class="h-card">${ic('h-tick')}<span>${esc(c)}</span></li>`).join('')}</ol>`;
  return title ? `    <section class="h-part"><h2>${title}</h2>${items}</section>` : `      ${items}`;
}

/**
 * Server-Side & SSG HTML SEO Injector
 * 
 * Injects page-specific title, meta description, canonical link,
 * OpenGraph tags, JSON-LD structured data, and semantic crawlable HTML
 * into index.html prior to sending it to crawlers or clients.
 */

import { SEO_DATA, getPageSEO, BASE_URL } from './seoData.js';

export function injectSeoIntoHtml(html, pathname) {
  const seo = getPageSEO(pathname);
  if (!seo) {
    // Default fallback: ensure at least canonical link is present
    const cleanPath = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    const fallbackCanonical = `${BASE_URL}${cleanPath === '/' ? '/' : cleanPath}`;
    if (!html.includes('rel="canonical"')) {
      html = html.replace('</head>', `  <link rel="canonical" href="${fallbackCanonical}" />\n  </head>`);
    }
    return html;
  }

  let modifiedHtml = html;

  // 1. Title replacement
  if (seo.title) {
    if (modifiedHtml.includes('<title>')) {
      modifiedHtml = modifiedHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${seo.title}</title>`);
    } else {
      modifiedHtml = modifiedHtml.replace('</head>', `  <title>${seo.title}</title>\n  </head>`);
    }
  }

  // 2. Meta description replacement
  if (seo.description) {
    if (modifiedHtml.includes('name="description"')) {
      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name=["']description["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
        `<meta name="description" content="${seo.description.replace(/"/g, '&quot;')}" />`
      );
    } else {
      modifiedHtml = modifiedHtml.replace(
        '</head>',
        `  <meta name="description" content="${seo.description.replace(/"/g, '&quot;')}" />\n  </head>`
      );
    }
  }

  // 3. Canonical tag
  const canonicalTag = `<link rel="canonical" href="${seo.canonicalUrl}" />`;
  if (modifiedHtml.includes('rel="canonical"')) {
    modifiedHtml = modifiedHtml.replace(/<link\s+rel=["']canonical["']\s+href=["'][\s\S]*?["']\s*\/?>/i, canonicalTag);
  } else {
    modifiedHtml = modifiedHtml.replace('</head>', `  ${canonicalTag}\n  </head>`);
  }

  // 4. OpenGraph tags
  const ogTitle = `<meta property="og:title" content="${(seo.ogTitle || seo.title).replace(/"/g, '&quot;')}" />`;
  const ogDesc = `<meta property="og:description" content="${(seo.ogDescription || seo.description).replace(/"/g, '&quot;')}" />`;
  const ogUrl = `<meta property="og:url" content="${seo.canonicalUrl}" />`;
  const ogType = `<meta property="og:type" content="${seo.ogType || 'website'}" />`;

  if (modifiedHtml.includes('property="og:title"')) {
    modifiedHtml = modifiedHtml.replace(/<meta\s+property=["']og:title["']\s+content=["'][\s\S]*?["']\s*\/?>/i, ogTitle);
  } else {
    modifiedHtml = modifiedHtml.replace('</head>', `  ${ogTitle}\n  </head>`);
  }

  if (modifiedHtml.includes('property="og:description"')) {
    modifiedHtml = modifiedHtml.replace(/<meta\s+property=["']og:description["']\s+content=["'][\s\S]*?["']\s*\/?>/i, ogDesc);
  } else {
    modifiedHtml = modifiedHtml.replace('</head>', `  ${ogDesc}\n  </head>`);
  }

  if (modifiedHtml.includes('property="og:url"')) {
    modifiedHtml = modifiedHtml.replace(/<meta\s+property=["']og:url["']\s+content=["'][\s\S]*?["']\s*\/?>/i, ogUrl);
  } else {
    modifiedHtml = modifiedHtml.replace('</head>', `  ${ogUrl}\n  </head>`);
  }

  if (modifiedHtml.includes('property="og:type"')) {
    modifiedHtml = modifiedHtml.replace(/<meta\s+property=["']og:type["']\s+content=["'][\s\S]*?["']\s*\/?>/i, ogType);
  } else {
    modifiedHtml = modifiedHtml.replace('</head>', `  ${ogType}\n  </head>`);
  }

  // 5. Twitter Card tags
  const twTitle = `<meta name="twitter:title" content="${(seo.ogTitle || seo.title).replace(/"/g, '&quot;')}" />`;
  const twDesc = `<meta name="twitter:description" content="${(seo.ogDescription || seo.description).replace(/"/g, '&quot;')}" />`;
  if (!modifiedHtml.includes('name="twitter:title"')) {
    modifiedHtml = modifiedHtml.replace('</head>', `  ${twTitle}\n  ${twDesc}\n  </head>`);
  }

  // 6. JSON-LD Schema
  if (seo.schema) {
    const jsonLdTag = `\n  <script type="application/ld+json" id="server-seo-jsonld">\n${JSON.stringify(seo.schema, null, 2)}\n  </script>\n`;
    modifiedHtml = modifiedHtml.replace('</head>', `${jsonLdTag}</head>`);
  }

  // 7. Semantic crawlable body inside <div id="root">
  if (seo.semanticHtml) {
    const semanticWrapper = `<div id="root">\n  <div id="ssr-semantic-content" class="sr-crawler-content" style="opacity: 0.99;">\n${seo.semanticHtml.trim()}\n  </div>\n</div>`;
    modifiedHtml = modifiedHtml.replace(/<div\s+id=["']root["']\s*>\s*<\/div>/i, semanticWrapper);
  }

  return modifiedHtml;
}

export { SEO_DATA, getPageSEO, BASE_URL };

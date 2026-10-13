import React, { useEffect } from 'react';
import { getPageSEO, PageSEO } from '../seo/seoData';

interface SEOHeadProps {
  path?: string;
  customData?: Partial<PageSEO>;
}

export const SEOHead: React.FC<SEOHeadProps> = ({ path, customData }) => {
  const currentPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const seo = customData ? { ...(getPageSEO(currentPath) || {}), ...customData } : getPageSEO(currentPath);

  useEffect(() => {
    if (!seo) return;

    // 1. Document Title
    const originalTitle = document.title;
    if (seo.title) {
      document.title = seo.title;
    }

    // Helper: update or create meta tag
    const setMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
      let tag = document.querySelector(`meta[${attribute}="${key}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // 2. Meta Description
    if (seo.description) {
      setMetaTag('name', 'description', seo.description);
    }

    // 3. Robots Meta Tag (ensure index, follow)
    setMetaTag('name', 'robots', 'index, follow');

    // 4. Canonical Link Tag
    const canonicalUrl = seo.canonicalUrl || `https://digitalmuid.in${seo.path}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 5. Open Graph Meta Tags
    setMetaTag('property', 'og:title', seo.ogTitle || seo.title);
    setMetaTag('property', 'og:description', seo.ogDescription || seo.description);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', seo.ogType || 'website');
    setMetaTag('property', 'og:site_name', 'DigitalMUID');

    // 6. Twitter Card Meta Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', seo.ogTitle || seo.title);
    setMetaTag('name', 'twitter:description', seo.ogDescription || seo.description);

    // 7. Schema.org JSON-LD Script
    let schemaScript = document.getElementById('seo-schema-jsonld') as HTMLScriptElement | null;
    if (seo.schema) {
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'seo-schema-jsonld';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(seo.schema);
    }

    return () => {
      // Keep document title and canonical stable during client navigation
    };
  }, [seo, currentPath]);

  return null;
};

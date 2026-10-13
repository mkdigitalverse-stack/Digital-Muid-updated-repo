import { SEO_DATA as RAW_SEO_DATA, getPageSEO as rawGetPageSEO, BASE_URL as RAW_BASE_URL } from '../../server/seoData.js';

export interface PageSEO {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogType?: string;
  ogImage?: string;
  schema: Record<string, any>;
  semanticHtml?: string;
}

export const BASE_URL: string = RAW_BASE_URL;
export const SEO_DATA: Record<string, PageSEO> = RAW_SEO_DATA as Record<string, PageSEO>;
export const getPageSEO: (pathname: string) => PageSEO | null = rawGetPageSEO as (pathname: string) => PageSEO | null;

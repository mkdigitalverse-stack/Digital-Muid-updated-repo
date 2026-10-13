/**
 * DigitalMUID — SEO Migration & URL Redirect Middleware
 *
 * Handles:
 * 1. Host normalization (www.digitalmuid.in -> digitalmuid.in)
 * 2. Subdomain mapping (learnskill.digitalmuid.in)
 * 3. Route canonicalization aliases:
 *    - /consultation -> 301 /business-growth-consultation
 *    - /courses      -> 301 /learn
 *    - /web-services, /web-development, /web-design -> 301 /web
 * 4. Legacy WordPress URLs indexed in Google Search Console:
 *    - /services-3/                                                    -> 301 /services
 *    - /price/                                                         -> 410 Gone (Permanently retired)
 *    - learnskill.digitalmuid.in/courses/complete-meta-ads-mastery... -> 301 https://digitalmuid.in/learn/meta-ads-mastery
 *    - learnskill.digitalmuid.in/terms-conditions/                     -> 301 https://digitalmuid.in/terms
 *    - /services-3/social-media-marketing/                             -> 301 /services/modern-marketing
 *    - /smm-packages-in-lucknow/                                       -> 301 /services/modern-marketing
 * 5. Trailing slash normalization (e.g. /web/ -> /web)
 */

export function seoRedirectMiddleware(req, res, next) {
  const host = (req.headers.host || '').toLowerCase();
  const rawPath = req.path || '/';
  const queryPart = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  // -------------------------------------------------------------------------
  // 1. WWW TO NON-WWW CANONICALIZATION (Permanent 301)
  // -------------------------------------------------------------------------
  if (host.startsWith('www.')) {
    const nonWwwHost = host.replace(/^www\./, '');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return res.redirect(301, `${protocol}://${nonWwwHost}${req.url}`);
  }

  // -------------------------------------------------------------------------
  // 2. SUBDOMAIN CHECK: learnskill.digitalmuid.in
  // -------------------------------------------------------------------------
  if (host.includes('learnskill.digitalmuid.in') || host.startsWith('learnskill.')) {
    const normalizedSubPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

    // URL 3: Old Meta Ads Course on learnskill subdomain
    if (
      normalizedSubPath === '/courses/complete-meta-ads-mastery-course-why-its-essential-to-start-early-in-your-career' ||
      normalizedSubPath.includes('complete-meta-ads-mastery-course')
    ) {
      return res.redirect(301, 'https://digitalmuid.in/learn/meta-ads-mastery' + queryPart);
    }

    // URL 4: Old Terms & Conditions on learnskill subdomain -> 301 https://digitalmuid.in/terms
    if (normalizedSubPath === '/terms-conditions' || normalizedSubPath === '/terms') {
      return res.redirect(301, 'https://digitalmuid.in/terms' + queryPart);
    }

    // Any other courses on old subdomain -> redirect to consolidated /learn
    if (normalizedSubPath === '' || normalizedSubPath === '/' || normalizedSubPath.startsWith('/courses') || normalizedSubPath.startsWith('/learn')) {
      return res.redirect(301, 'https://digitalmuid.in/learn' + queryPart);
    }

    // General fallback for old subdomain
    return res.redirect(301, 'https://digitalmuid.in/learn' + queryPart);
  }

  const normalizedPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

  // -------------------------------------------------------------------------
  // 3. LEGACY WORDPRESS MAPPINGS: digitalmuid.in
  // -------------------------------------------------------------------------

  // URL 1: Old Services directory -> /services (Permanent 301)
  if (normalizedPath === '/services-3') {
    return res.redirect(301, '/services' + queryPart);
  }

  // URL 5: Old Social Media Marketing service page -> /services/modern-marketing (Permanent 301)
  if (normalizedPath === '/services-3/social-media-marketing') {
    return res.redirect(301, '/services/modern-marketing' + queryPart);
  }

  // URL 6: Old SMM Packages in Lucknow page -> /services/modern-marketing (Permanent 301)
  if (normalizedPath === '/smm-packages-in-lucknow') {
    return res.redirect(301, '/services/modern-marketing' + queryPart);
  }

  // URL 3 (Main domain path hit): Old Meta Ads course page -> /learn/meta-ads-mastery (Permanent 301)
  if (
    normalizedPath === '/courses/complete-meta-ads-mastery-course-why-its-essential-to-start-early-in-your-career' ||
    normalizedPath.includes('complete-meta-ads-mastery-course')
  ) {
    return res.redirect(301, '/learn/meta-ads-mastery' + queryPart);
  }

  // URL 2: Old Pricing page (Permanently Retired) -> 410 Gone
  if (normalizedPath === '/price') {
    res.status(410);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>410 Gone — Pricing Page Retired | DigitalMUID</title>
  <meta name="robots" content="noindex, follow">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07111F; color: #E2E8F0; padding: 60px 20px; text-align: center; line-height: 1.6; }
    .box { max-width: 600px; margin: 0 auto; background: #0A1A2F; border: 1px solid #1E293B; border-radius: 16px; padding: 40px; }
    h1 { color: #FF6B00; font-size: 28px; margin-bottom: 12px; }
    p { color: #94A3B8; font-size: 15px; margin-bottom: 24px; }
    a { display: inline-block; background: #FF6B00; color: #FFF; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
    a.sec { background: transparent; border: 1px solid #334155; color: #CBD5E1; margin-left: 10px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>410 — Pricing Packages Discontinued</h1>
    <p>DigitalMUID has transitioned from static, off-the-shelf pricing packages to bespoke client advisory and customized project scoping. Please explore our strategic services or book a growth consultation to discuss your specific requirements.</p>
    <a href="/services">Explore Services</a>
    <a href="/business-growth-consultation" class="sec">Book Consultation</a>
  </div>
</body>
</html>`);
  }

  // URL 4 (Main domain path hit): Old Terms & Conditions -> 301 /terms
  if (normalizedPath === '/terms-conditions') {
    return res.redirect(301, '/terms' + queryPart);
  }

  // -------------------------------------------------------------------------
  // 4. DUPLICATE ROUTE ALIASES -> PRIMARY CANONICAL URLS (Permanent 301)
  // -------------------------------------------------------------------------
  // /consultation -> /business-growth-consultation
  if (normalizedPath === '/consultation') {
    return res.redirect(301, '/business-growth-consultation' + queryPart);
  }

  // /courses -> /learn
  if (normalizedPath === '/courses') {
    return res.redirect(301, '/learn' + queryPart);
  }

  // /web-services, /web-development, /web-design -> /web
  if (
    normalizedPath === '/web-services' ||
    normalizedPath === '/web-development' ||
    normalizedPath === '/web-design'
  ) {
    return res.redirect(301, '/web' + queryPart);
  }

  // -------------------------------------------------------------------------
  // 5. TRAILING SLASH NORMALIZATION (e.g. /web/ -> /web)
  // -------------------------------------------------------------------------
  // Strip trailing slashes on any remaining non-root paths (ignore / and static assets)
  if (rawPath.length > 1 && rawPath.endsWith('/') && !rawPath.startsWith('/api/')) {
    const strippedPath = rawPath.replace(/\/+$/, '');
    return res.redirect(301, strippedPath + queryPart);
  }

  // Pass through to next handler if no legacy or canonical redirect matched
  next();
}

/**
 * DigitalMUID — SEO Migration & URL Redirect Middleware
 *
 * Handles legacy WordPress URLs indexed in Google Search Console:
 * 1. /services-3/                                                    -> 301 /services
 * 2. /price/                                                         -> 410 Gone (Permanently retired)
 * 3. learnskill.digitalmuid.in/courses/complete-meta-ads-mastery... -> 301 https://digitalmuid.in/learn/meta-ads-mastery
 * 4. learnskill.digitalmuid.in/terms-conditions/                     -> 410 Gone (Old subdomain terms retired)
 * 5. /services-3/social-media-marketing/                             -> 301 /services/modern-marketing
 * 6. /smm-packages-in-lucknow/                                       -> 301 /services/modern-marketing (Retains SMM service intent)
 */

export function seoRedirectMiddleware(req, res, next) {
  // Normalize hostname and path
  const host = (req.headers.host || '').toLowerCase();
  const rawPath = req.path || '/';
  // Strip trailing slashes for clean matching (except root '/')
  const normalizedPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

  // -------------------------------------------------------------------------
  // A. SUBDOMAIN CHECK: learnskill.digitalmuid.in
  // -------------------------------------------------------------------------
  if (host.includes('learnskill.digitalmuid.in') || host.startsWith('learnskill.')) {
    // URL 3: Old Meta Ads Course on learnskill subdomain
    if (
      normalizedPath === '/courses/complete-meta-ads-mastery-course-why-its-essential-to-start-early-in-your-career' ||
      normalizedPath.includes('complete-meta-ads-mastery-course')
    ) {
      return res.redirect(301, 'https://digitalmuid.in/learn/meta-ads-mastery');
    }

    // URL 4: Old Terms & Conditions on learnskill subdomain
    if (normalizedPath === '/terms-conditions' || normalizedPath === '/terms') {
      res.status(410);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>410 Gone — Terms & Conditions Retired | DigitalMUID</title>
  <meta name="robots" content="noindex, follow">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07111F; color: #E2E8F0; padding: 60px 20px; text-align: center; line-height: 1.6; }
    .box { max-width: 600px; margin: 0 auto; background: #0A1A2F; border: 1px border #1E293B; border-radius: 16px; padding: 40px; }
    h1 { color: #FF6B00; font-size: 28px; margin-bottom: 12px; }
    p { color: #94A3B8; font-size: 15px; margin-bottom: 24px; }
    a { display: inline-block; background: #FF6B00; color: #FFF; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
    a.sec { background: transparent; border: 1px solid #334155; color: #CBD5E1; margin-left: 10px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>410 — Content Permanently Retired</h1>
    <p>The legacy Terms & Conditions page on this previous learning subdomain has been permanently retired as part of the DigitalMUID website migration. Current terms and legal inquiries are handled directly through our contact portal.</p>
    <a href="https://digitalmuid.in/contact">Contact for Legal Inquiries</a>
    <a href="https://digitalmuid.in/learn" class="sec">Visit Learning Platform</a>
  </div>
</body>
</html>`);
    }

    // Any other courses on old subdomain -> redirect to consolidated /learn
    if (normalizedPath === '' || normalizedPath === '/' || normalizedPath.startsWith('/courses') || normalizedPath.startsWith('/learn')) {
      return res.redirect(301, 'https://digitalmuid.in/learn');
    }

    // General fallback for old subdomain
    return res.redirect(301, 'https://digitalmuid.in/learn');
  }

  // -------------------------------------------------------------------------
  // B. MAIN DOMAIN MAPPINGS: digitalmuid.in
  // -------------------------------------------------------------------------

  // URL 1: Old Services directory -> /services (Permanent 301)
  if (normalizedPath === '/services-3') {
    const target = '/services' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    return res.redirect(301, target);
  }

  // URL 5: Old Social Media Marketing service page -> /services/modern-marketing (Permanent 301)
  if (normalizedPath === '/services-3/social-media-marketing') {
    const target = '/services/modern-marketing' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    return res.redirect(301, target);
  }

  // URL 6: Old SMM Packages in Lucknow page -> /services/modern-marketing (Permanent 301, retains SMM intent)
  if (normalizedPath === '/smm-packages-in-lucknow') {
    const target = '/services/modern-marketing' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    return res.redirect(301, target);
  }

  // URL 3 (Main domain path hit): Old Meta Ads course page -> /learn/meta-ads-mastery (Permanent 301)
  if (
    normalizedPath === '/courses/complete-meta-ads-mastery-course-why-its-essential-to-start-early-in-your-career' ||
    normalizedPath.includes('complete-meta-ads-mastery-course')
  ) {
    const target = '/learn/meta-ads-mastery' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    return res.redirect(301, target);
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

  // URL 4 (Main domain path hit): Old Terms & Conditions -> 410 Gone
  if (normalizedPath === '/terms-conditions') {
    res.status(410);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>410 Gone — Terms Page Retired | DigitalMUID</title>
  <meta name="robots" content="noindex, follow">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07111F; color: #E2E8F0; padding: 60px 20px; text-align: center; line-height: 1.6; }
    .box { max-width: 600px; margin: 0 auto; background: #0A1A2F; border: 1px solid #1E293B; border-radius: 16px; padding: 40px; }
    h1 { color: #FF6B00; font-size: 28px; margin-bottom: 12px; }
    p { color: #94A3B8; font-size: 15px; margin-bottom: 24px; }
    a { display: inline-block; background: #FF6B00; color: #FFF; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>410 — Content Retired</h1>
    <p>This legacy terms URL has been permanently retired. Current legal and service terms are handled directly via our contact channels.</p>
    <a href="/contact">Contact DigitalMUID</a>
  </div>
</body>
</html>`);
  }

  // Pass through to next handler if no legacy URL matched
  next();
}

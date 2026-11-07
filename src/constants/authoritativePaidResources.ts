/**
 * ==============================================================================
 * AUTHORITATIVE PAID RESOURCES CATALOG
 * Single Source of Truth for Paid Resources Pricing and Access-Control
 * ==============================================================================
 * Guarantees immutable, authoritative classification and pricing across all devices,
 * clean browser sessions, incognito windows, and mobile/tablet/desktop platforms.
 *
 * LocalStorage overrides or missing database columns CANNOT downgrade these resources.
 */

export interface AuthoritativePaidResourceInfo {
  id: string;
  slug: string;
  price: number;
  currency: string;
  title: string;
  filename: string;
  storagePath: string;
  isBundle?: boolean;
}

export const AUTHORITATIVE_PAID_RESOURCES: Record<string, AuthoritativePaidResourceInfo> = {
  // Bundle: All 4 tools included
  "2d50e5e3-711d-4461-a70d-0ed54dd29f17": {
    id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
    slug: "meta-ads-campaign-planner-bundle",
    price: 299,
    currency: "INR",
    title: "Meta Ads Campaign Planner Bundle",
    filename: "meta-ads-campaign-planner-bundle.zip",
    storagePath: "paid/meta-ads-campaign-planner-bundle.zip",
    isBundle: true
  },
  "meta-ads-campaign-planner-bundle": {
    id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
    slug: "meta-ads-campaign-planner-bundle",
    price: 299,
    currency: "INR",
    title: "Meta Ads Campaign Planner Bundle",
    filename: "meta-ads-campaign-planner-bundle.zip",
    storagePath: "paid/meta-ads-campaign-planner-bundle.zip",
    isBundle: true
  },

  // Deliverable 1: The Meta Ads Campaign Planner Workbook
  "27ef2c04-4d4a-4dbe-a702-d4013b2542b9": {
    id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
    slug: "meta-ads-campaign-planner-workbook",
    price: 129,
    currency: "INR",
    title: "The Meta Ads Campaign Planner Workbook",
    filename: "meta-ads-campaign-planner-workbook.pdf",
    storagePath: "paid/meta-ads-campaign-planner-workbook.pdf"
  },
  "meta-ads-campaign-planner-workbook": {
    id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
    slug: "meta-ads-campaign-planner-workbook",
    price: 129,
    currency: "INR",
    title: "The Meta Ads Campaign Planner Workbook",
    filename: "meta-ads-campaign-planner-workbook.pdf",
    storagePath: "paid/meta-ads-campaign-planner-workbook.pdf"
  },

  // Deliverable 2: Interactive Ad Budget & Break-Even Calculator
  "fafe5ffc-3323-4761-9d22-50a2588f6326": {
    id: "fafe5ffc-3323-4761-9d22-50a2588f6326",
    slug: "the-ad-budget-break-even-calculator",
    price: 79,
    currency: "INR",
    title: "Interactive Ad Budget & Break-Even Calculator",
    filename: "the-ad-budget-break-even-calculator.xlsx",
    storagePath: "paid/the-ad-budget-break-even-calculator.xlsx"
  },
  "the-ad-budget-breat-even-calculate": {
    id: "fafe5ffc-3323-4761-9d22-50a2588f6326",
    slug: "the-ad-budget-break-even-calculator",
    price: 79,
    currency: "INR",
    title: "Interactive Ad Budget & Break-Even Calculator",
    filename: "the-ad-budget-break-even-calculator.xlsx",
    storagePath: "paid/the-ad-budget-break-even-calculator.xlsx"
  },
  "the-ad-budget-break-even-calculator": {
    id: "fafe5ffc-3323-4761-9d22-50a2588f6326",
    slug: "the-ad-budget-break-even-calculator",
    price: 79,
    currency: "INR",
    title: "Interactive Ad Budget & Break-Even Calculator",
    filename: "the-ad-budget-break-even-calculator.xlsx",
    storagePath: "paid/the-ad-budget-break-even-calculator.xlsx"
  },

  // Deliverable 3: 10 High-Converting Meta Ads Copy Frameworks
  "004d374c-d872-4bfe-bf54-8083504e9174": {
    id: "004d374c-d872-4bfe-bf54-8083504e9174",
    slug: "10-high-converting-meta-ads-copy-frameworks",
    price: 79,
    currency: "INR",
    title: "10 High-Converting Meta Ads Copy Frameworks",
    filename: "10-high-converting-meta-ads-copy-frameworks.pdf",
    storagePath: "paid/10-high-converting-meta-ads-copy-frameworks.pdf"
  },
  "10-high-converting-meta-ads-copy-frameworks": {
    id: "004d374c-d872-4bfe-bf54-8083504e9174",
    slug: "10-high-converting-meta-ads-copy-frameworks",
    price: 79,
    currency: "INR",
    title: "10 High-Converting Meta Ads Copy Frameworks",
    filename: "10-high-converting-meta-ads-copy-frameworks.pdf",
    storagePath: "paid/10-high-converting-meta-ads-copy-frameworks.pdf"
  },

  // Deliverable 4: Pre-Launch & Tracking Audit Checklist
  "6867ecdd-2797-40f0-bdc8-ead20600ac6c": {
    id: "6867ecdd-2797-40f0-bdc8-ead20600ac6c",
    slug: "pre-launch-tracking-audit-checklist",
    price: 79,
    currency: "INR",
    title: "Pre-Launch & Tracking Audit Checklist",
    filename: "pre-launch-tracking-audit-checklist.pdf",
    storagePath: "paid/pre-launch-tracking-audit-checklist.pdf"
  },
  "pre-launch-tracking-audit-checklist": {
    id: "6867ecdd-2797-40f0-bdc8-ead20600ac6c",
    slug: "pre-launch-tracking-audit-checklist",
    price: 79,
    currency: "INR",
    title: "Pre-Launch & Tracking Audit Checklist",
    filename: "pre-launch-tracking-audit-checklist.pdf",
    storagePath: "paid/pre-launch-tracking-audit-checklist.pdf"
  }
};

/**
 * Checks whether an ID or slug belongs to the authoritative paid resources list.
 */
export function isAuthoritativePaidResource(idOrSlug: string | undefined | null): boolean {
  if (!idOrSlug) return false;
  const clean = String(idOrSlug).trim().toLowerCase();
  return Boolean(
    AUTHORITATIVE_PAID_RESOURCES[clean] ||
    AUTHORITATIVE_PAID_RESOURCES[String(idOrSlug).trim()]
  );
}

/**
 * Returns the authoritative metadata for a paid resource by ID or slug.
 */
export function getAuthoritativePaidResourceInfo(idOrSlug: string | undefined | null): AuthoritativePaidResourceInfo | null {
  if (!idOrSlug) return null;
  const clean = String(idOrSlug).trim().toLowerCase();
  return (
    AUTHORITATIVE_PAID_RESOURCES[clean] ||
    AUTHORITATIVE_PAID_RESOURCES[String(idOrSlug).trim()] ||
    null
  );
}

/**
 * List of all protected paid filenames to intercept direct HTTP access
 */
export const PROTECTED_PAID_FILENAMES = [
  "meta-ads-campaign-planner-workbook.pdf",
  "the-ad-budget-break-even-calculator.xlsx",
  "the-ad-budget-break-even-calculator.pdf",
  "10-high-converting-meta-ads-copy-frameworks.pdf",
  "pre-launch-tracking-audit-checklist.pdf",
  "meta-ads-campaign-planner-bundle.zip"
];

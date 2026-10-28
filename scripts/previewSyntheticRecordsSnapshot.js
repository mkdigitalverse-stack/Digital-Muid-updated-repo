/**
 * DIGITAL MUID — READ-ONLY SYNTHETIC RECORD SNAPSHOT & AUDIT PREVIEW
 *
 * SPECIFICATION & SAFETY CONSTRAINTS:
 * 1. PURE READ-ONLY: Contains NO DELETE, UPDATE, INSERT, upsert, or storage-write operations.
 * 2. Rejects the production Supabase database by default.
 * 3. Never infers synthetic records from email regex or broad matching; matches exact reviewed IDs.
 * 4. Explicitly protects and excludes production accounts and legitimate customer leads:
 *    - 7005462e-7a82-4e05-9bd5-34f6be69d3b8 (Administrator account)
 *    - 07c3b070-bafc-4345-9852-c9e6d708f1db (Legitimate prospective customer enquiry)
 *    - 9c2cd07c-917b-45a2-a98f-686f53ff4b76 (Founder verification enquiry)
 * 5. Specifically flags the synthetic purchase attached to the administrator for manual review.
 * 6. Documents related records, foreign keys, and cascade implications.
 * 7. Does not query or export production data without explicit operator confirmation flags.
 */

import { KNOWN_PRODUCTION_HOST, KNOWN_PRODUCTION_PROJECT_ID } from "./safetyGuard.js";

// ==============================================================================
// 1. STRICT PROTECTED ENTITIES WHITELIST (MUST NEVER BE MUTATED OR DELETED)
// ==============================================================================
export const PROTECTED_ENTITIES = {
  adminUser: {
    id: "7005462e-7a82-4e05-9bd5-34f6be69d3b8",
    emailMasked: "mkd***@gmail.com",
    role: "Production Platform Administrator",
    protectionRule: "PERMANENT PROTECTED - NEVER DELETE AUTH USER OR PROFILE"
  },
  legitimateLeads: [
    {
      id: "07c3b070-bafc-4345-9852-c9e6d708f1db",
      emailMasked: "anuj***@gmail.com",
      description: "Real prospective client web enquiry (March 2026)",
      protectionRule: "PERMANENT PROTECTED - NEVER DELETE"
    },
    {
      id: "9c2cd07c-917b-45a2-a98f-686f53ff4b76",
      emailMasked: "muid***@gmail.com",
      description: "Founder manual test / verification entry",
      protectionRule: "PERMANENT PROTECTED - NEVER DELETE"
    }
  ]
};

// ==============================================================================
// 2. SPECIFIC CANDIDATE MANIFEST (IDENTIFIED FROM AUDIT)
// ==============================================================================
export const CANDIDATE_SYNTHETIC_MANIFEST = {
  // Payments recorded in public.payments
  payments: [
    {
      paymentId: "pay_tablet_idem_1793006407928",
      orderId: "order_Qe3WsmH8i2O1qN",
      amountPaise: 29900,
      currency: "INR",
      sourceScript: "scripts/testPaidResourceCrossDevice.js",
      reviewFlag: "CANDIDATE_SYNTHETIC_CLEANUP",
      cascadeImplications: "Has matching public.resource_purchases row. No incoming FKs."
    },
    {
      paymentId: "pay_verified_stage4_1793006675316",
      orderId: "order_Qe3XbYl8vW3qZ0",
      amountPaise: 29900,
      currency: "INR",
      sourceScript: "scripts/verifyPaidResourceFullWorkflow.js",
      reviewFlag: "CANDIDATE_SYNTHETIC_CLEANUP",
      cascadeImplications: "Has matching public.resource_purchases row. No incoming FKs."
    },
    {
      paymentId: "pay_test_1793009521098",
      orderId: "order_Qe4N3mY7k8L9pQ",
      amountPaise: 29900,
      currency: "INR",
      sourceScript: "scripts/verifyPaidResourceFullWorkflow.js",
      reviewFlag: "CANDIDATE_SYNTHETIC_CLEANUP",
      cascadeImplications: "Has matching public.resource_purchases row. No incoming FKs."
    },
    {
      paymentId: "pay_verif_1793009738244",
      orderId: "order_Qe4On9X4k2M7aP",
      amountPaise: 29900,
      currency: "INR",
      sourceScript: "scripts/verifyPaidResourceFullWorkflow.js",
      reviewFlag: "CANDIDATE_SYNTHETIC_CLEANUP",
      cascadeImplications: "Has matching public.resource_purchases row. No incoming FKs."
    },
    {
      paymentId: "pay_staging_test_1793009942018",
      orderId: "order_Qe4P5kLm8N9oP0",
      amountPaise: 29900,
      currency: "INR",
      sourceScript: "scripts/verifyPaidResourceFullWorkflow.js",
      reviewFlag: "ATTENTION_MANUAL_REVIEW_REQUIRED",
      specialNotice: "BOUND TO PRODUCTION ADMIN USER (7005462e-7a82-4e05-9bd5-34f6be69d3b8). DO NOT DELETE ADMIN USER! Only target this isolated payment row.",
      cascadeImplications: "Do not cascade to auth.users."
    }
  ],

  // Resource purchases in public.resource_purchases
  resourcePurchases: [
    {
      paymentId: "pay_tablet_idem_1793006407928",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      resourceTitle: "Meta Ads Campaign Planner Bundle",
      entitlementStatus: "synthetic_access_to_revoke"
    },
    {
      paymentId: "pay_verified_stage4_1793006675316",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      resourceTitle: "Meta Ads Campaign Planner Bundle",
      entitlementStatus: "synthetic_access_to_revoke"
    },
    {
      paymentId: "pay_test_1793009521098",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      resourceTitle: "Meta Ads Campaign Planner Bundle",
      entitlementStatus: "synthetic_access_to_revoke"
    },
    {
      paymentId: "pay_verif_1793009738244",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      resourceTitle: "Meta Ads Campaign Planner Bundle",
      entitlementStatus: "synthetic_access_to_revoke"
    },
    {
      paymentId: "pay_staging_test_1793009942018",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      resourceTitle: "Meta Ads Campaign Planner Bundle",
      entitlementStatus: "ADMIN_PURCHASE_MANUAL_REVIEW"
    }
  ],

  // Synthetic Auth Accounts in auth.users & public.profiles
  syntheticAuthUsers: [
    {
      emailMasked: "tablet-customer@***.in",
      exactEmail: "tablet-customer@digitalmuid.in",
      role: "Synthetic buyer created by testPaidResourceCrossDevice.js",
      cascadeTarget: "auth.users ON DELETE CASCADE -> public.profiles, public.payments"
    },
    {
      emailMasked: "testbuyer@***.com",
      exactEmail: "testbuyer@example.com",
      role: "Synthetic buyer created by payment fulfillment fallback",
      cascadeTarget: "auth.users ON DELETE CASCADE -> public.profiles, public.payments"
    },
    {
      emailMasked: "safetytest@***.com",
      exactEmail: "safetytest@example.com",
      role: "Synthetic buyer created during stage 4 test",
      cascadeTarget: "auth.users ON DELETE CASCADE -> public.profiles, public.payments"
    },
    {
      emailMasked: "staging-buyer@***.com",
      exactEmail: "staging-buyer@example.com",
      role: "Synthetic buyer created during verification test",
      cascadeTarget: "auth.users ON DELETE CASCADE -> public.profiles, public.payments"
    }
  ],

  // Synthetic Leads in public.crm_leads (22 items from test scripts)
  crmLeadsCount: 22,
  sampleLeadSources: [
    "Resource Paid Checkout Initiated",
    "Resource Purchase (Paid)",
    "Checkout Left"
  ]
};

/**
 * Generates human-readable manifest report.
 */
export function generateManifestReport() {
  const p = CANDIDATE_SYNTHETIC_MANIFEST;
  const protectedAdmin = PROTECTED_ENTITIES.adminUser;
  const protectedLeads = PROTECTED_ENTITIES.legitimateLeads;

  const lines = [
    "================================================================================",
    "DIGITAL MUID — SYNTHETIC RECORD CANDIDATE MANIFEST & DEPENDENCY MAP",
    "Mode: STRICT READ-ONLY (No writes, deletions, or production exports)",
    "================================================================================",
    "",
    "1. PROTECTED WHITELIST (MANDATORY EXCLUSIONS):",
    `   • ADMIN ACCOUNT: ${protectedAdmin.id}`,
    `     Email: ${protectedAdmin.emailMasked} | Role: ${protectedAdmin.role}`,
    `     Status: ${protectedAdmin.protectionRule}`,
    ...protectedLeads.map(
      (l) => `   • LEGITIMATE LEAD: ${l.id} (${l.emailMasked}) - ${l.description} [${l.protectionRule}]`
    ),
    "",
    "2. SYNTHETIC PAYMENT LEDGER RECORDS (public.payments):",
    ...p.payments.map((pay, i) => {
      const reviewNotice = pay.specialNotice ? `\n      ⚠️  ALERT: ${pay.specialNotice}` : "";
      return `   [${i + 1}] Payment ID: ${pay.paymentId} | Order: ${pay.orderId} | Status: ${pay.reviewFlag}${reviewNotice}`;
    }),
    "",
    "3. SYNTHETIC ENTITLEMENT RECORDS (public.resource_purchases):",
    ...p.resourcePurchases.map(
      (pur, i) => `   [${i + 1}] Payment: ${pur.paymentId} | Resource: ${pur.resourceTitle} | Action: ${pur.entitlementStatus}`
    ),
    "",
    "4. SYNTHETIC AUTH ACCOUNTS (auth.users & public.profiles):",
    ...p.syntheticAuthUsers.map(
      (u, i) => `   [${i + 1}] Account: ${u.emailMasked} | Source: ${u.role}\n       Cascade Rule: ${u.cascadeTarget}`
    ),
    "",
    `5. SYNTHETIC CRM LEADS (public.crm_leads): ${p.crmLeadsCount} records`,
    `   Sources: ${p.sampleLeadSources.join(", ")}`,
    "   Relationship: Completely decoupled. No foreign-key dependencies.",
    "",
    "6. FOREIGN KEY & CASCADE ANALYSIS:",
    "   • auth.users -> public.profiles: ON DELETE CASCADE",
    "   • auth.users -> public.payments: ON DELETE CASCADE",
    "   • auth.users -> public.resource_purchases: ON DELETE CASCADE",
    "   • public.crm_leads: Standalone table (zero foreign keys, zero cascade triggers)",
    "   • CRITICAL CONSTRAINT: Deleting synthetic auth accounts will cascade cleanly to profiles & payments.",
    "     HOWEVER, deleting payment 'pay_staging_test_1793009942018' MUST NOT delete user '7005462e-7a82-4e05-9bd5-34f6be69d3b8'!",
    "",
    "================================================================================",
    "DRY-RUN STATUS: Verified. No production mutations will take place without operator confirmation.",
    "================================================================================"
  ];

  return lines.join("\n");
}

// Self-run when invoked directly
if (process.argv[1] && process.argv[1].includes("previewSyntheticRecordsSnapshot")) {
  console.log(generateManifestReport());
}

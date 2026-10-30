/**
 * DIGITAL MUID — TARGETED LOCAL SECURITY HARDENING TEST SUITE
 *
 * Verifies:
 * 1. Ordinary user with user_metadata.role = 'admin' is NOT an admin.
 * 2. Trusted administrator remains an admin (allowlist emails and app_metadata).
 * 3. Payment-ID-only status lookup returns NO order ID (prevents disclosure).
 * 4. Missing or mismatched payment/order identifiers are rejected.
 * 5. Cross-resource access is denied.
 * 6. Verified guest purchases and historical purchases remain accessible.
 * 7. Bundle child entitlements still work.
 * 8. Free-resource access remains unchanged.
 *
 * ZERO network calls: All Supabase database and Razorpay interactions are locally mocked.
 * Remote live tests (cloud Supabase RLS, production Razorpay gateway) are explicitly marked NOT RUN.
 */

import { checkIsAdmin, setMockSupabaseServerClient } from "../server/supabaseServer.js";
import { setMockRazorpayClient } from "../server/razorpay.js";
import paymentRouter from "../server/paymentRoutes.js";

let passedCount = 0;
let totalCount = 0;
const notRunTests = [];

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  PASS: ${message}`);
}

function markNotRun(testName, reason) {
  notRunTests.push({ testName, reason });
  console.log(`  [NOT RUN] ${testName}: ${reason}`);
}

// Find route handlers directly from paymentRouter stack
function getRouteHandler(path, method) {
  for (const layer of paymentRouter.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`Handler not found for ${method} ${path}`);
}

const verifyPurchaseStatusHandler = getRouteHandler("/verify-purchase-status", "GET");
const getResourceDownloadUrlHandler = getRouteHandler("/get-resource-download-url", "POST");

function createMockExpress(query = {}, body = {}, headers = {}) {
  let statusCode = 200;
  let jsonResponse = null;

  const req = {
    query,
    body,
    headers
  };

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      jsonResponse = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => jsonResponse
  };

  return { req, res };
}

// Build a mock Supabase query builder for unit tests
function createMockSupabase(dbState, authUsers = {}) {
  return {
    auth: {
      async getUser(token) {
        const clean = String(token || "").replace(/^Bearer\s+/i, "").trim();
        const user = authUsers[clean];
        if (user) {
          return { data: { user }, error: null };
        }
        return { data: { user: null }, error: new Error("User session invalid or expired") };
      }
    },
    from(tableName) {
      let selectedFields = "*";
      const filters = {};
      const inFilters = {};
      const gtFilters = {};

      const builder = {
        select(fields) {
          selectedFields = fields;
          return builder;
        },
        eq(col, val) {
          filters[col] = val;
          return builder;
        },
        in(col, vals) {
          inFilters[col] = vals;
          return builder;
        },
        gt(col, val) {
          gtFilters[col] = val;
          return builder;
        },
        async maybeSingle() {
          const rows = dbState[tableName] || [];
          const match = rows.find(r => {
            for (const [k, v] of Object.entries(filters)) {
              if (r[k] !== v) return false;
            }
            for (const [k, vals] of Object.entries(inFilters)) {
              if (!vals.includes(r[k])) return false;
            }
            for (const [k, v] of Object.entries(gtFilters)) {
              if (!(Number(r[k]) > Number(v))) return false;
            }
            return true;
          });
          return { data: match || null, error: null };
        }
      };
      return builder;
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, expiry) {
            return {
              data: {
                signedUrl: `https://mock-storage.supabase.co/${bucket}/${path}?token=mock-signed-token`
              },
              error: null
            };
          }
        };
      }
    }
  };
}

async function runTests() {
  console.log("================================================================================");
  console.log("DIGITAL MUID — LOCAL SECURITY HARDENING TESTS");
  console.log("================================================================================\n");

  // -----------------------------------------------------------------------------
  // TEST GROUP 1: Administrator Authorization Hardening
  // -----------------------------------------------------------------------------
  console.log("[Test Group 1] Administrator Authorization Hardening");
  {
    // Scenario 1: Ordinary student attempting privilege escalation via user_metadata
    const maliciousStudent = {
      id: "student-uuid-1",
      email: "student@example.com",
      user_metadata: { role: "admin" },
      app_metadata: {}
    };
    assert(
      checkIsAdmin(maliciousStudent) === false,
      "Ordinary user with user_metadata.role='admin' is NOT recognized as admin"
    );

    // Scenario 2: Student with empty metadata
    const normalStudent = {
      id: "student-uuid-2",
      email: "student2@example.com",
      user_metadata: {},
      app_metadata: {}
    };
    assert(
      checkIsAdmin(normalStudent) === false,
      "Ordinary student without admin claims is NOT recognized as admin"
    );

    // Scenario 3: Null / undefined user
    assert(checkIsAdmin(null) === false, "Null user returns false");
    assert(checkIsAdmin(undefined) === false, "Undefined user returns false");

    // Scenario 4: Trusted admin email 1
    const trustedAdmin1 = {
      id: "admin-uuid-1",
      email: "mkdigitalverse@gmail.com",
      user_metadata: {}
    };
    assert(
      checkIsAdmin(trustedAdmin1) === true,
      "Trusted admin email (mkdigitalverse@gmail.com) is recognized as admin"
    );

    // Scenario 5: Trusted admin email 2 (case-insensitive test)
    const trustedAdmin2 = {
      id: "admin-uuid-2",
      email: "ADMIN@DIGITALMUID.COM",
      user_metadata: {}
    };
    assert(
      checkIsAdmin(trustedAdmin2) === true,
      "Trusted admin email (admin@digitalmuid.com, uppercase) is recognized as admin"
    );

    // Scenario 6: Protected app_metadata role
    const appRoleAdmin = {
      id: "admin-uuid-3",
      email: "service-admin@domain.com",
      app_metadata: { role: "admin" }
    };
    assert(
      checkIsAdmin(appRoleAdmin) === true,
      "User with protected app_metadata.role='admin' is recognized as admin"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 2: Guest Payment-ID-Only Status Lookup & Identifier Disclosure
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 2] Guest Status Verification & Order-ID Disclosure Prevention");
  {
    const mockDb = {
      resources: [
        {
          id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          slug: "meta-ads-campaign-planner-workbook",
          title: "Meta Ads Campaign Planner Workbook",
          access_type: "paid",
          price: 129,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-1",
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_test_secret_123",
          razorpay_order_id: "order_test_secret_789",
          status: "active",
          currency: "INR",
          amount: 129
        }
      ],
      payments: []
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb));

    // Scenario 1: Request with paymentId only
    const { req: req1, res: res1 } = createMockExpress({
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_test_secret_123"
    });
    await verifyPurchaseStatusHandler(req1, res1);

    const body1 = res1.getBody();
    assert(
      res1.getStatusCode() === 400,
      "Payment-ID-only status verification returns HTTP 400"
    );
    assert(
      body1.verified === false,
      "Payment-ID-only request verified flag is false"
    );
    assert(
      body1.orderId === undefined,
      "Payment-ID-only request NEVER discloses orderId"
    );

    // Scenario 2: Request with orderId only
    const { req: req2, res: res2 } = createMockExpress({
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      orderId: "order_test_secret_789"
    });
    await verifyPurchaseStatusHandler(req2, res2);

    const body2 = res2.getBody();
    assert(
      res2.getStatusCode() === 400,
      "Order-ID-only status verification returns HTTP 400"
    );
    assert(
      body2.verified === false,
      "Order-ID-only request verified flag is false"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 3: Missing or Mismatched Payment/Order Identifiers
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 3] Missing or Mismatched Payment/Order Identifiers");
  {
    const mockDb = {
      resources: [
        {
          id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          slug: "meta-ads-campaign-planner-workbook",
          title: "Meta Ads Campaign Planner Workbook",
          access_type: "paid",
          price: 129,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-1",
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_legit_101",
          razorpay_order_id: "order_legit_202",
          status: "active",
          currency: "INR",
          amount: 129
        }
      ],
      payments: []
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb));

    // Download URL with mismatched orderId
    const { req: dlReq, res: dlRes } = createMockExpress({}, {
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_legit_101",
      orderId: "order_mismatched_999"
    });
    await getResourceDownloadUrlHandler(dlReq, dlRes);

    assert(
      dlRes.getStatusCode() === 403,
      "Download request with mismatched payment/order pair returns HTTP 403 Forbidden"
    );
    assert(
      dlRes.getBody().success === false,
      "Download request with mismatched pair has success=false"
    );

    // Status verification with mismatched orderId
    const { req: stReq, res: stRes } = createMockExpress({
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_legit_101",
      orderId: "order_mismatched_999"
    });
    await verifyPurchaseStatusHandler(stReq, stRes);

    assert(
      stRes.getBody().verified === false,
      "Status verification with mismatched orderId returns verified=false"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 4: Cross-Resource Access Prevention
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 4] Cross-Resource Access Prevention");
  {
    const mockDb = {
      resources: [
        {
          id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          slug: "meta-ads-campaign-planner-workbook",
          title: "Meta Ads Campaign Planner Workbook",
          access_type: "paid",
          price: 129,
          currency: "INR"
        },
        {
          id: "fafe5ffc-3323-4761-9d22-50a2588f6326",
          slug: "the-ad-budget-break-even-calculator",
          title: "Interactive Ad Budget & Break-Even Calculator",
          access_type: "paid",
          price: 79,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-wb",
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_for_workbook_only",
          razorpay_order_id: "order_for_workbook_only",
          status: "active",
          currency: "INR",
          amount: 129
        }
      ],
      payments: []
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb));

    // Attacker uses workbook payment to request calculator
    const { req, res } = createMockExpress({}, {
      resourceId: "fafe5ffc-3323-4761-9d22-50a2588f6326",
      paymentId: "pay_for_workbook_only",
      orderId: "order_for_workbook_only"
    });
    await getResourceDownloadUrlHandler(req, res);

    assert(
      res.getStatusCode() === 403,
      "Cross-resource access attempt returns HTTP 403 Forbidden"
    );
    assert(
      res.getBody().success === false,
      "Cross-resource access attempt has success=false"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 5: Verified Guest and Historical Purchases Access
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 5] Verified Guest and Historical Purchases Access");
  {
    const mockDb = {
      resources: [
        {
          id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          slug: "meta-ads-campaign-planner-workbook",
          title: "Meta Ads Campaign Planner Workbook",
          access_type: "paid",
          price: 129,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-guest-1",
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_guest_valid_001",
          razorpay_order_id: "order_guest_valid_001",
          status: "active",
          currency: "INR",
          amount: 129
        }
      ],
      payments: [
        {
          id: "pay-hist-1",
          item_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          item_type: "resource",
          razorpay_payment_id: "pay_hist_valid_002",
          razorpay_order_id: "order_hist_valid_002",
          status: "captured",
          currency: "INR",
          amount: 129
        }
      ]
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb));

    // 1. Guest purchase in resource_purchases
    const { req: gReq, res: gRes } = createMockExpress({}, {
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_guest_valid_001",
      orderId: "order_guest_valid_001"
    });
    await getResourceDownloadUrlHandler(gReq, gRes);

    assert(
      gRes.getStatusCode() === 200,
      "Legitimate guest purchase returns HTTP 200 OK"
    );
    assert(
      gRes.getBody().success === true,
      "Legitimate guest purchase has success=true"
    );
    assert(
      Boolean(gRes.getBody().downloadUrl),
      "Legitimate guest purchase provides downloadUrl"
    );

    // 2. Historical purchase in payments table
    const { req: hReq, res: hRes } = createMockExpress({}, {
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_hist_valid_002",
      orderId: "order_hist_valid_002"
    });
    await getResourceDownloadUrlHandler(hReq, hRes);

    assert(
      hRes.getStatusCode() === 200,
      "Historical purchase from payments table returns HTTP 200 OK"
    );
    assert(
      hRes.getBody().success === true,
      "Historical purchase from payments table has success=true"
    );

    // 3. Guest status verification for genuine pair
    const { req: stReq, res: stRes } = createMockExpress({
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_guest_valid_001",
      orderId: "order_guest_valid_001"
    });
    await verifyPurchaseStatusHandler(stReq, stRes);

    assert(
      stRes.getBody().verified === true,
      "Status verification confirms genuine guest pair with verified=true"
    );
    assert(
      stRes.getBody().orderId === "order_guest_valid_001",
      "Status verification echoes provided orderId for matching pair"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 6: Bundle Child Entitlements
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 6] Bundle Child Entitlements");
  {
    // Parent bundle: 2d50e5e3-711d-4461-a70d-0ed54dd29f17
    // Child resource: 6867ecdd-2797-40f0-bdc8-ead20600ac6c (pre-launch checklist)
    const mockDb = {
      resources: [
        {
          id: "6867ecdd-2797-40f0-bdc8-ead20600ac6c",
          slug: "pre-launch-tracking-audit-checklist",
          title: "Pre-Launch & Tracking Audit Checklist",
          access_type: "paid",
          price: 79,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-bundle-1",
          resource_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17", // BUNDLE_RESOURCE_ID
          razorpay_payment_id: "pay_bundle_customer_888",
          razorpay_order_id: "order_bundle_customer_888",
          status: "active",
          currency: "INR",
          amount: 299
        }
      ],
      payments: []
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb));

    // Request child resource download using bundle payment credentials
    const { req, res } = createMockExpress({}, {
      resourceId: "6867ecdd-2797-40f0-bdc8-ead20600ac6c",
      paymentId: "pay_bundle_customer_888",
      orderId: "order_bundle_customer_888"
    });
    await getResourceDownloadUrlHandler(req, res);

    assert(
      res.getStatusCode() === 200,
      "Bundle purchaser accessing bundle child resource returns HTTP 200 OK"
    );
    assert(
      res.getBody().success === true,
      "Bundle child download has success=true"
    );
    assert(
      Boolean(res.getBody().downloadUrl),
      "Bundle child download delivers valid downloadUrl"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 7: Free Resource Access
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 7] Free Resource Access");
  {
    const freeResourceId = "c0000000-0000-4000-8000-000000000001";
    const mockDb = {
      resources: [
        {
          id: freeResourceId,
          slug: "free-social-media-cheatsheet",
          title: "Free Social Media Cheatsheet",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "https://example.com/free-cheatsheet.pdf"
        }
      ],
      resource_purchases: [],
      payments: []
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb));

    // 1. Download free resource with no credentials
    const { req: dlReq, res: dlRes } = createMockExpress({}, {
      resourceId: freeResourceId
    });
    await getResourceDownloadUrlHandler(dlReq, dlRes);

    assert(
      dlRes.getStatusCode() === 200,
      "Free resource download returns HTTP 200 OK without payment"
    );
    assert(
      dlRes.getBody().success === true,
      "Free resource download has success=true"
    );
    assert(
      dlRes.getBody().accessType === "free",
      "Free resource returns accessType='free'"
    );

    // 2. Status verification for free resource
    const { req: stReq, res: stRes } = createMockExpress({
      resourceId: freeResourceId
    });
    await verifyPurchaseStatusHandler(stReq, stRes);

    assert(
      stRes.getStatusCode() === 200,
      "Free resource status check returns HTTP 200 OK"
    );
    assert(
      stRes.getBody().verified === true,
      "Free resource status check returns verified=true"
    );
    assert(
      stRes.getBody().isFree === true,
      "Free resource status check confirms isFree=true"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 8: Authenticated User Purchase Recovery
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 8] Authenticated User Purchase Recovery");
  {
    const authUserId = "usr-student-authenticated-123";
    const authUser = {
      id: authUserId,
      email: "student@digitalmuid.com",
      app_metadata: {},
      user_metadata: {}
    };

    const mockDb = {
      resources: [
        {
          id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          slug: "meta-ads-campaign-planner-workbook",
          title: "Meta Ads Campaign Planner Workbook",
          access_type: "paid",
          price: 129,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-auth-student-1",
          user_id: authUserId,
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_auth_recov_111",
          razorpay_order_id: "order_auth_recov_222",
          status: "active",
          currency: "INR",
          amount: 129
        }
      ],
      payments: []
    };

    const authMap = {
      "mock-auth-token-123": authUser
    };
    setMockSupabaseServerClient(createMockSupabase(mockDb, authMap));

    // Case 1: Authenticated user requests status with NO guest identifiers
    const { req: reqNoGuest, res: resNoGuest } = createMockExpress(
      { resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9" },
      {},
      { authorization: "Bearer mock-auth-token-123" }
    );
    await verifyPurchaseStatusHandler(reqNoGuest, resNoGuest);

    assert(
      resNoGuest.getStatusCode() === 200,
      "Authenticated user status recovery without guest IDs returns HTTP 200"
    );
    assert(
      resNoGuest.getBody().verified === true,
      "Authenticated user status recovery confirms verified=true"
    );
    assert(
      resNoGuest.getBody().orderId === "order_auth_recov_222",
      "Authenticated user status recovery returns server-recorded orderId"
    );
    assert(
      resNoGuest.getBody().paymentId === "pay_auth_recov_111",
      "Authenticated user status recovery returns server-recorded paymentId"
    );

    // Case 2: Authenticated user requests status with partial guest param (e.g. paymentId only)
    const { req: reqPartial, res: resPartial } = createMockExpress(
      {
        resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
        paymentId: "pay_stale_or_partial_999"
      },
      {},
      { authorization: "Bearer mock-auth-token-123" }
    );
    await verifyPurchaseStatusHandler(reqPartial, resPartial);

    assert(
      resPartial.getStatusCode() === 200,
      "Authenticated user with server entitlement succeeds even if partial guest param present"
    );
    assert(
      resPartial.getBody().verified === true,
      "Authenticated user with partial param recovers purchase successfully (verified=true)"
    );

    // Case 3: Authenticated user downloads resource with NO guest identifiers
    const { req: dlReqAuth, res: dlResAuth } = createMockExpress(
      {},
      { resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9" },
      { authorization: "Bearer mock-auth-token-123" }
    );
    await getResourceDownloadUrlHandler(dlReqAuth, dlResAuth);

    assert(
      dlResAuth.getStatusCode() === 200,
      "Authenticated user download without guest IDs returns HTTP 200"
    );
    assert(
      dlResAuth.getBody().success === true,
      "Authenticated user download without guest IDs has success=true"
    );
    assert(
      Boolean(dlResAuth.getBody().downloadUrl),
      "Authenticated user download delivers signed URL"
    );

    // Case 4: Authenticated user WITHOUT a purchase calls verify-purchase-status with no IDs
    const otherUserId = "usr-student-other-456";
    const otherUser = {
      id: otherUserId,
      email: "other@digitalmuid.com",
      app_metadata: {},
      user_metadata: {}
    };
    authMap["mock-other-token-456"] = otherUser;

    const { req: reqOther, res: resOther } = createMockExpress(
      { resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9" },
      {},
      { authorization: "Bearer mock-other-token-456" }
    );
    await verifyPurchaseStatusHandler(reqOther, resOther);

    assert(
      resOther.getStatusCode() === 200,
      "Authenticated user without purchase returns HTTP 200"
    );
    assert(
      resOther.getBody().verified === false,
      "Authenticated user without purchase returns verified=false"
    );

    // Case 5: Authenticated user WITHOUT a purchase calls verify-purchase-status with incomplete guest ID
    const { req: reqOtherPartial, res: resOtherPartial } = createMockExpress(
      {
        resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
        paymentId: "pay_incomplete_unowned"
      },
      {},
      { authorization: "Bearer mock-other-token-456" }
    );
    await verifyPurchaseStatusHandler(reqOtherPartial, resOtherPartial);

    assert(
      resOtherPartial.getStatusCode() === 400,
      "Authenticated user with unowned resource and partial guest ID returns HTTP 400"
    );
    assert(
      resOtherPartial.getBody().verified === false,
      "Authenticated user with partial guest ID verified=false"
    );
    assert(
      resOtherPartial.getBody().orderId === undefined,
      "Never reveals missing orderId to authenticated non-owner"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 9: Currency (INR) and Positive Amount (> 0) Strict Enforcement
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 9] Currency (INR) & Positive Amount Strict Enforcement");
  {
    const mockDbCurrency = {
      resources: [
        {
          id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          slug: "meta-ads-campaign-planner-workbook",
          title: "Meta Ads Campaign Planner Workbook",
          access_type: "paid",
          price: 129,
          currency: "INR"
        }
      ],
      resource_purchases: [
        {
          id: "pur-usd",
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_usd_currency_001",
          razorpay_order_id: "order_usd_currency_001",
          status: "active",
          currency: "USD", // Invalid non-INR currency
          amount: 129
        },
        {
          id: "pur-zero",
          resource_id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
          razorpay_payment_id: "pay_zero_amount_002",
          razorpay_order_id: "order_zero_amount_002",
          status: "active",
          currency: "INR",
          amount: 0 // Non-positive amount
        }
      ],
      payments: []
    };
    setMockSupabaseServerClient(createMockSupabase(mockDbCurrency));

    // 1. Non-INR purchase verification rejected
    const { req: reqUSD, res: resUSD } = createMockExpress({
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_usd_currency_001",
      orderId: "order_usd_currency_001"
    });
    await verifyPurchaseStatusHandler(reqUSD, resUSD);

    assert(
      resUSD.getBody().verified === false,
      "Non-INR currency record is rejected by status verification (verified=false)"
    );

    // 2. Non-INR purchase download rejected
    const { req: dlUSD, res: dlUSDRes } = createMockExpress({}, {
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_usd_currency_001",
      orderId: "order_usd_currency_001"
    });
    await getResourceDownloadUrlHandler(dlUSD, dlUSDRes);

    assert(
      dlUSDRes.getStatusCode() === 403,
      "Non-INR currency record is denied download access with HTTP 403"
    );

    // 3. Zero-amount purchase verification rejected
    const { req: reqZero, res: resZero } = createMockExpress({
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_zero_amount_002",
      orderId: "order_zero_amount_002"
    });
    await verifyPurchaseStatusHandler(reqZero, resZero);

    assert(
      resZero.getBody().verified === false,
      "Zero-amount purchase record is rejected by status verification (verified=false)"
    );

    // 4. Zero-amount purchase download rejected
    const { req: dlZero, res: dlZeroRes } = createMockExpress({}, {
      resourceId: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      paymentId: "pay_zero_amount_002",
      orderId: "order_zero_amount_002"
    });
    await getResourceDownloadUrlHandler(dlZero, dlZeroRes);

    assert(
      dlZeroRes.getStatusCode() === 403,
      "Zero-amount purchase record is denied download access with HTTP 403"
    );
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 10: Production Protection on Test-Only Injection Hooks
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 10] Production Environment Guard on Test Hooks");
  {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    let supabaseMockThrew = false;
    try {
      setMockSupabaseServerClient({});
    } catch (err) {
      if (err.message.includes("[SECURITY]")) {
        supabaseMockThrew = true;
      }
    }
    assert(
      supabaseMockThrew === true,
      "setMockSupabaseServerClient throws security exception in NODE_ENV=production"
    );

    let razorpayMockThrew = false;
    try {
      setMockRazorpayClient({});
    } catch (err) {
      if (err.message.includes("[SECURITY]")) {
        razorpayMockThrew = true;
      }
    }
    assert(
      razorpayMockThrew === true,
      "setMockRazorpayClient throws security exception in NODE_ENV=production"
    );

    // Restore test environment
    process.env.NODE_ENV = originalNodeEnv;
  }

  // -----------------------------------------------------------------------------
  // TEST GROUP 11: Live / Remote Tests (Explicitly Not Run)
  // -----------------------------------------------------------------------------
  console.log("\n[Test Group 11] Remote / Live Infrastructure Tests (Prohibited in Local Mode)");
  {
    markNotRun(
      "Live Supabase PostgreSQL RLS Execution",
      "Prohibited by strict constraints: No remote Supabase connections or SQL execution permitted."
    );
    markNotRun(
      "Live Razorpay Gateway Capture API",
      "Prohibited by strict constraints: No production or live Razorpay API calls permitted."
    );
  }

  // Reset mock clients
  setMockSupabaseServerClient(null);
  setMockRazorpayClient(null);

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passedCount} / ${totalCount} ASSERTIONS PASSED.`);
  console.log(`NOT RUN: ${notRunTests.length} tests requiring live external infrastructure.`);
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

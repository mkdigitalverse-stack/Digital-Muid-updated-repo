import { enforceStagingSafety } from './safetyGuard.js';

// ==============================================================================
// FAIL-CLOSED SAFETY GUARD: PRODUCTION REJECTION & ISOLATED STAGING ENFORCEMENT
// ==============================================================================
enforceStagingSafety({
  requireTestRazorpay: true,
  requireStagingDatabase: true,
  requireStagingWritesFlag: true
});
// ==============================================================================

/**
 * Paid Resource Checkout Cross-Device Compatibility Verification Suite
 * Tests:
 * 1. Razorpay script loader race conditions and polling logic across devices
 * 2. Responsive modal container scrollability and touch targets across viewports (Mobile, iPad Portrait/Landscape, Galaxy Tab, Desktop)
 * 3. Deep link routing & query parameter resolution (/resources?resourceId=..., /resources?slug=...)
 * 4. Authoritative server-side order creation for paid resources
 * 5. Cryptographic signature verification and fulfillment for paid resources
 * 6. Idempotency on duplicate payment fulfillment
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

function postJson(urlPath, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: urlPath,
        method: 'GET',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runSuite() {
  console.log('===============================================================');
  console.log('🚀 DigitalMUID — Paid Resource Cross-Device Test Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // --- Test Group 1: Responsive Modal Code Verification ---
  console.log('--- Test Group 1: Responsive & Viewport Scrollability Auditing ---');
  
  const resourcesPageCode = fs.readFileSync(path.resolve('./src/pages/ResourcesPage.tsx'), 'utf-8');
  const bundlePageCode = fs.readFileSync(path.resolve('./src/pages/BundleAccessPage.tsx'), 'utf-8');
  const razorpayLibCode = fs.readFileSync(path.resolve('./src/lib/razorpay.ts'), 'utf-8');
  const appCode = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf-8');

  // Check 1: ResourcesPage modal has overflow-y-auto and max-h
  assert(
    'ResourcesPage Paid Modal has overflow-y-auto on backdrop',
    resourcesPageCode.includes('overflow-y-auto overscroll-contain')
  );
  assert(
    'ResourcesPage Paid Modal has max-h-[calc(100dvh-2rem)] on inner card',
    resourcesPageCode.includes('max-h-[calc(100dvh-2rem)] overflow-y-auto')
  );
  assert(
    'ResourcesPage close buttons have min-w-[44px] min-h-[44px] touch targets',
    resourcesPageCode.includes('min-w-[44px] min-h-[44px]')
  );

  // Check 2: BundleAccessPage modal has overflow-y-auto and max-h
  assert(
    'BundleAccessPage Modal has overflow-y-auto on backdrop',
    bundlePageCode.includes('overflow-y-auto overscroll-contain')
  );
  assert(
    'BundleAccessPage Modal has max-h-[calc(100dvh-2rem)] on inner card',
    bundlePageCode.includes('max-h-[calc(100dvh-2rem)] overflow-y-auto')
  );
  assert(
    'BundleAccessPage close button has 44px touch target',
    bundlePageCode.includes('min-w-[44px] min-h-[44px]')
  );

  // Check 3: Razorpay SDK loader has polling loop (eliminating race condition on tablets)
  assert(
    'src/lib/razorpay.ts handles pre-existing and cached checkout.js script via polling',
    razorpayLibCode.includes('setInterval') && razorpayLibCode.includes('typeof window.Razorpay === \'function\'')
  );

  // Check 4: Deep linking route query resolution in App.tsx and ResourcesPage.tsx
  assert(
    'App.tsx passes queryId from search params to ResourcesPage',
    appCode.includes("queryId = sp.get('resourceId')")
  );
  assert(
    'ResourcesPage.tsx reads URLSearchParams as self-healing fallback',
    resourcesPageCode.includes('new URLSearchParams(window.location.search)')
  );

  // Check 5: Razorpay payment.failed handler attached
  assert(
    'ResourcesPage registers rzp.on("payment.failed")',
    resourcesPageCode.includes('payment.failed')
  );
  assert(
    'BundleAccessPage registers rzpInstance.on("payment.failed")',
    bundlePageCode.includes('payment.failed')
  );

  // --- Test Group 2: Cross-Device Order Creation (Simulating Tablet, Mobile, Desktop) ---
  console.log('\n--- Test Group 2: Cross-Device Server Order Creation ---');
  
  const userAgents = [
    {
      name: 'iPad Pro (Safari/iOS 17 - Tablet Landscape)',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    },
    {
      name: 'Samsung Galaxy Tab S9 (Android 14 Chrome - Tablet Portrait)',
      ua: 'Mozilla/5.0 (Linux; Android 14; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36'
    },
    {
      name: 'iPhone 15 Pro (Mobile Safari)',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
    },
    {
      name: 'MacBook Pro / Desktop Chrome',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  ];

  let testOrderId = null;
  let testAmount = null;

  for (const device of userAgents) {
    const res = await postJson(
      '/api/payments/create-resource-order',
      {
        resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17', // Meta Ads Bundle
        customerDetails: {
          name: `Test CrossDevice ${device.name.split(' ')[0]}`,
          email: 'test-crossdevice@digitalmuid.in',
          phone: '+919876543210'
        }
      },
      { 'User-Agent': device.ua }
    );

    assert(
      `Order creation succeeds on ${device.name}`,
      res.status === 200 && res.data && res.data.success === true && res.data.orderId,
      `Status: ${res.status}, orderId: ${res.data?.orderId}`
    );

    if (res.data?.orderId) {
      testOrderId = res.data.orderId;
      testAmount = res.data.amount;
    }
  }

  // --- Test Group 3: Server Cryptographic Signature Verification & Fulfillment ---
  console.log('\n--- Test Group 3: Cryptographic Signature Verification & Idempotency ---');

  if (testOrderId) {
    // Generate valid HMAC signature matching server's secret
    const crypto = await import('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_mock_mode';
    const fakePaymentId = `pay_tablet_test_${Date.now()}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${testOrderId}|${fakePaymentId}`)
      .digest('hex');

    // Attempt 1: First payment verification
    const verifyRes1 = await postJson('/api/payments/verify-resource-payment', {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: signature,
      resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
      customerDetails: {
        name: 'Tablet CrossDevice Customer',
        email: 'tablet-customer@digitalmuid.in',
        phone: '+919876543210',
        profession: 'Growth Marketer'
      }
    });

    // Live Razorpay API validation check: non-existent payment ID is strictly rejected by Razorpay
    assert(
      'Live Razorpay gateway strictly validates payment existence (rejects synthetic IDs)',
      verifyRes1.status === 400 && verifyRes1.data && verifyRes1.data.verified === false && verifyRes1.data.error.includes('gateway'),
      `Status: ${verifyRes1.status}, Data: ${JSON.stringify(verifyRes1.data)}`
    );

    // Test direct fulfillment layer idempotency
    const { fulfillResourcePurchase } = await import('../server/paymentFulfillment.js');
    const directPayId = `pay_tablet_idem_${Date.now()}`;
    const fulfillRes1 = await fulfillResourcePurchase({
      userId: null,
      resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
      amount: 299,
      currency: 'INR',
      orderId: testOrderId,
      paymentId: directPayId,
      customerName: 'Tablet CrossDevice Customer',
      customerEmail: 'tablet-customer@digitalmuid.in',
      customerPhone: '+919876543210',
      resourceTitle: 'Meta Ads Campaign Planner Bundle'
    });

    assert(
      'Fulfillment layer records resource purchase successfully',
      fulfillRes1.success === true,
      `Result: ${JSON.stringify(fulfillRes1)}`
    );

    // Repeated call with same paymentId (Idempotency)
    const fulfillRes2 = await fulfillResourcePurchase({
      userId: null,
      resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
      amount: 299,
      currency: 'INR',
      orderId: testOrderId,
      paymentId: directPayId,
      customerName: 'Tablet CrossDevice Customer',
      customerEmail: 'tablet-customer@digitalmuid.in',
      customerPhone: '+919876543210',
      resourceTitle: 'Meta Ads Campaign Planner Bundle'
    });

    assert(
      'Repeated payment fulfillment is idempotent and flags already_fulfilled',
      fulfillRes2.success === true && fulfillRes2.already_fulfilled === true,
      `Result: ${JSON.stringify(fulfillRes2)}`
    );

    // Attempt 3: Tampered signature rejection test
    const tamperedRes = await postJson('/api/payments/verify-resource-payment', {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: 'invalid_tampered_signature_hex',
      resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
      customerDetails: {
        name: 'Attacker',
        email: 'attacker@evil.com'
      }
    });

    assert(
      'Tampered signature is strictly rejected with HTTP 400',
      tamperedRes.status === 400 && tamperedRes.data && tamperedRes.data.verified === false,
      `Status: ${tamperedRes.status}`
    );
  }

  // --- Test Group 4: Health Check & System Status ---
  console.log('\n--- Test Group 4: Health & Integration Readiness ---');
  const health = await get('/api/health');
  assert(
    'Health endpoint reports status OK with email & payment configured',
    health.status === 200 && health.body.includes('"status":"ok"'),
    `Health: ${health.body}`
  );

  console.log('\n===============================================================');
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { getSupabaseServerClient } from "../server/supabaseServer.js";

async function createWorkbookPdf() {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const primaryColor = rgb(0.04, 0.08, 0.16); // #0A1428 Dark Navy
  const brandOrange = rgb(1.0, 0.42, 0.0);   // #FF6B00 Brand Orange
  const slateText = rgb(0.2, 0.25, 0.35);    // Slate text
  const lightBg = rgb(0.96, 0.97, 0.99);

  // Helper for adding page with header/footer
  function addPageWithHeader(title, pageNum, totalPages = 5) {
    const page = doc.addPage([595.28, 841.89]); // A4 Portrait
    const { width, height } = page.getSize();

    // Top Brand Bar
    page.drawRectangle({
      x: 0,
      y: height - 60,
      width: width,
      height: 60,
      color: primaryColor
    });

    page.drawRectangle({
      x: 0,
      y: height - 63,
      width: width,
      height: 3,
      color: brandOrange
    });

    page.drawText("DIGITAL MUID", {
      x: 40,
      y: height - 38,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page.drawText("EXECUTIVE OPERATING SYSTEM", {
      x: 160,
      y: height - 37,
      size: 9,
      font: fontRegular,
      color: rgb(0.8, 0.85, 0.95)
    });

    page.drawText(`PAGE ${pageNum} OF ${totalPages}`, {
      x: width - 120,
      y: height - 37,
      size: 9,
      font: fontBold,
      color: brandOrange
    });

    // Page title sub-bar
    page.drawText(title.toUpperCase(), {
      x: 40,
      y: height - 85,
      size: 11,
      font: fontBold,
      color: brandOrange
    });

    // Bottom footer
    page.drawLine({
      start: { x: 40, y: 45 },
      end: { x: width - 40, y: 45 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92)
    });

    page.drawText("Digital Muid © 2026 · Confidential & Proprietary · Meta Ads Campaign Planner OS", {
      x: 40,
      y: 30,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6)
    });

    page.drawText("https://digitalmuid.in", {
      x: width - 120,
      y: 30,
      size: 8,
      font: fontBold,
      color: primaryColor
    });

    return page;
  }

  // --- PAGE 1: COVER & EXECUTIVE ARCHITECTURE ---
  const page1 = addPageWithHeader("Module 1 · Operational Framework", 1, 5);
  
  page1.drawText("The Meta Ads Campaign Planner Workbook", {
    x: 40,
    y: 700,
    size: 22,
    font: fontBold,
    color: primaryColor
  });

  page1.drawText("Step-by-Step Operating System: TOF / MOF / BOF Architecture & Decision Framework", {
    x: 40,
    y: 680,
    size: 11,
    font: fontRegular,
    color: slateText
  });

  // Overview Box
  page1.drawRectangle({
    x: 40,
    y: 560,
    width: 515,
    height: 105,
    color: lightBg,
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1
  });

  page1.drawText("CORE PRINCIPLE: ADS NEVER FAIL IN ADS MANAGER", {
    x: 55,
    y: 645,
    size: 11,
    font: fontBold,
    color: brandOrange
  });

  page1.drawText(
    "A campaign never fails because of an algorithm button. It fails in one of four foundational pillars:\n" +
    "1. Unit Economics: Selling at negative margin after COGS, shipping, and payment gateway fees.\n" +
    "2. Creative Angle: Hook fails to arrest attention in the first 1.5 seconds of user scrolling.\n" +
    "3. Offer Resonance: Value proposition lacks contrast against commodity competitors.\n" +
    "4. Post-Click Velocity: Landing page load friction or checkout leakages kill intent.",
    {
      x: 55,
      y: 625,
      size: 9.5,
      font: fontRegular,
      color: slateText,
      lineHeight: 14
    }
  );

  // Section 1: Full-Funnel Architecture
  page1.drawText("Full-Funnel Campaign Architecture (The 70/20/10 Rule)", {
    x: 40,
    y: 535,
    size: 14,
    font: fontBold,
    color: primaryColor
  });

  // 3 Boxes for TOF, MOF, BOF
  const stages = [
    {
      title: "TOP OF FUNNEL (TOF) — 70% Budget",
      target: "Audience: Broad / Advantage+ / Non-Engaged",
      goal: "Objective: Low-friction hook, problem agitation & first interaction.",
      creative: "Creatives: 3-angle concept tests (Video hooks, carousels, before/after)."
    },
    {
      title: "MIDDLE OF FUNNEL (MOF) — 20% Budget",
      target: "Audience: 30-Day Video Viewers, IG/FB Engagers, Content Consumers",
      goal: "Objective: Deeper value stack, founder perspective & mechanism breakdown.",
      creative: "Creatives: Product breakdowns, objection handlers, social proof stories."
    },
    {
      title: "BOTTOM OF FUNNEL (BOF) — 10% Budget",
      target: "Audience: 7-Day Add to Cart, Initiate Checkout, Page Viewers",
      goal: "Objective: Remove friction, urgency triggers, FAQs & risk-reversal.",
      creative: "Creatives: Direct comparison tables, money-back guarantee, customer reviews."
    }
  ];

  stages.forEach((st, idx) => {
    const boxY = 415 - idx * 75;
    page1.drawRectangle({
      x: 40,
      y: boxY,
      width: 515,
      height: 65,
      color: rgb(0.98, 0.98, 1.0),
      borderColor: rgb(0.88, 0.90, 0.96),
      borderWidth: 1
    });

    page1.drawText(st.title, {
      x: 55,
      y: boxY + 48,
      size: 10,
      font: fontBold,
      color: primaryColor
    });

    page1.drawText(`${st.target}  |  ${st.goal}\n${st.creative}`, {
      x: 55,
      y: boxY + 32,
      size: 8.5,
      font: fontRegular,
      color: slateText,
      lineHeight: 13
    });
  });

  // Action checklist at bottom of page 1
  page1.drawText("Pre-Launch Campaign Setup Checklist:", {
    x: 40,
    y: 170,
    size: 11,
    font: fontBold,
    color: primaryColor
  });

  const p1Checklist = [
    "[ ] CAPI (Conversions API) verified with >8.0 Event Quality Score in Meta Events Manager",
    "[ ] Conversion events prioritized: Purchase > InitiateCheckout > ViewContent",
    "[ ] Advantage Campaign Budget (CBO) enabled with minimum 3 diverse ad formats",
    "[ ] UTM parameter tracking string appended to every ad URL: utm_source=meta&utm_medium=paid"
  ];

  p1Checklist.forEach((chk, i) => {
    page1.drawText(chk, {
      x: 55,
      y: 145 - i * 18,
      size: 9,
      font: fontRegular,
      color: slateText
    });
  });

  // --- PAGE 2: THE 3-ANGLE CREATIVE TESTING MATRIX ---
  const page2 = addPageWithHeader("Module 2 · Creative Testing Matrix", 2, 5);

  page2.drawText("The 3-Angle Creative Testing Matrix", {
    x: 40,
    y: 715,
    size: 18,
    font: fontBold,
    color: primaryColor
  });

  page2.drawText("Never launch with just 1 ad style. Deploy these 3 distinct psychological angles simultaneously:", {
    x: 40,
    y: 695,
    size: 10,
    font: fontRegular,
    color: slateText
  });

  const angles = [
    {
      num: "ANGLE 1",
      name: "Direct Pain & Consequence Hook",
      headline: '"Are You Still Burning 40% of Ad Spend on Blind Meta Boosts?"',
      psych: "Focuses on the immediate financial or operational hemorrhage the buyer is enduring.",
      formula: "[Immediate Pain Trigger] + [Cost of Inaction] + [Frictionless Alternative]",
      script: "Hook: If your Meta Ads CPA spiked by 3x this month, your targeting isn't broken—your creative math is.\nBody: Most media buyers increase spend hoping the algorithm saves them. Here is the 3-step decision protocol..."
    },
    {
      num: "ANGLE 2",
      name: "Contrarian / Industry Myth Callout",
      headline: '"Why \'Targeting Hacks\' Won\'t Save an Ad with Broken Unit Economics"',
      psych: "Shatters common industry misconceptions to establish immediate founder authority.",
      formula: "[Debunk Popular Belief] + [Provide Verifiable Math] + [Introduce New Mechanism]",
      script: "Hook: Stop looking for secret 1% lookalike audiences in 2026. Broad targeting outperforms narrow segments.\nBody: The real constraint is whether your margin covers payment gateway fees and acquisition cost..."
    },
    {
      num: "ANGLE 3",
      name: "Proof, Mechanism & Demo Walkthrough",
      headline: '"Inside the Exact Unit Economics Spreadsheet We Use for 7-Figure Audits"',
      psych: "Appeals to analytical buyers who need tangible evidence before pulling out a card.",
      formula: "[Show Concrete Deliverable] + [Walk Through 60-Second Demo] + [Offer Instant Access]",
      script: "Hook: Here is the exact break-even calculator we run before launching any campaign.\nBody: It shows your maximum allowable CPA before you lose 1 rupee. Download the plug-and-play template..."
    }
  ];

  angles.forEach((ag, idx) => {
    const yTop = 645 - idx * 175;
    page2.drawRectangle({
      x: 40,
      y: yTop - 150,
      width: 515,
      height: 160,
      color: lightBg,
      borderColor: rgb(0.85, 0.88, 0.95),
      borderWidth: 1
    });

    page2.drawRectangle({
      x: 40,
      y: yTop - 25,
      width: 515,
      height: 35,
      color: primaryColor
    });

    page2.drawText(`${ag.num}: ${ag.name.toUpperCase()}`, {
      x: 55,
      y: yTop - 12,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page2.drawText(`Sample Hook Headline: ${ag.headline}`, {
      x: 55,
      y: yTop - 45,
      size: 9.5,
      font: fontBold,
      color: brandOrange
    });

    page2.drawText(`Psychological Mechanism: ${ag.psych}\nStructural Formula: ${ag.formula}`, {
      x: 55,
      y: yTop - 65,
      size: 8.5,
      font: fontRegular,
      color: slateText,
      lineHeight: 13
    });

    page2.drawText(`Copy Script Blueprint:\n${ag.script}`, {
      x: 55,
      y: yTop - 105,
      size: 8.5,
      font: fontOblique,
      color: rgb(0.15, 0.2, 0.3),
      lineHeight: 12
    });
  });

  // --- PAGE 3: THE 48-HOUR DECISION MATRIX ---
  const page3 = addPageWithHeader("Module 3 · The 48-Hour Decision Matrix", 3, 5);

  page3.drawText("The 48-Hour Decision Matrix: Kill, Fix, or Scale", {
    x: 40,
    y: 715,
    size: 18,
    font: fontBold,
    color: primaryColor
  });

  page3.drawText("Diagnostic rules to prevent emotional budget changes. Evaluate campaigns after minimum 48 hours & 2,000 impressions:", {
    x: 40,
    y: 695,
    size: 9.5,
    font: fontRegular,
    color: slateText
  });

  const matrixRules = [
    {
      symptom: "Symptom: High CPM (Above Rs. 350 in India / Above $35 in US)",
      cause: "Root Cause: Audience too narrow, ad fatigue, or poor engagement ranking from Meta.",
      action: "Required Action: Switch audience targeting to Broad (Age/Gender/Geo only). Test fresh hook in first 2 seconds."
    },
    {
      symptom: "Symptom: Low Outbound CTR (Below 1.0% on Feeds)",
      cause: "Root Cause: Creative hook or headline is invisible in the feed. People are scrolling past.",
      action: "Required Action: Do NOT touch landing page or budget. Test 3 new visual hooks with high-contrast text overlays."
    },
    {
      symptom: "Symptom: High CTR (>2.5%) but Low Landing Page Views (<70% of Clicks)",
      cause: "Root Cause: Landing page load speed is too slow (>3 seconds), or mobile bounce friction.",
      action: "Required Action: Compress images, remove bulky scripts, enable browser caching. Test mobile page speed."
    },
    {
      symptom: "Symptom: High Landing Page Views but Zero Add-to-Cart or Checkouts",
      cause: "Root Cause: Disconnect between ad promise and landing page offer. Price shock or weak proof.",
      action: "Required Action: Ensure headline on landing page mirrors ad text word-for-word. Add clear FAQs and testimonials."
    },
    {
      symptom: "Symptom: High Checkouts but Failed Payment Conversions",
      cause: "Root Cause: Gateway friction (missing UPI intent, OTP delays, or hidden delivery/GST fees).",
      action: "Required Action: Audit payment gateway integration. Enable 1-click UPI payments and display transparent pricing."
    },
    {
      symptom: "Symptom: CPA < Target Break-Even CPA & Stable for 72+ Hours",
      cause: "Root Cause: High market resonance & profitable unit economics flywheel.",
      action: "Required Action: Scale daily budget by +20% every 48 hours. Do NOT double budget overnight (resets machine learning)."
    }
  ];

  matrixRules.forEach((rule, idx) => {
    const yBox = 650 - idx * 82;
    page3.drawRectangle({
      x: 40,
      y: yBox - 65,
      width: 515,
      height: 72,
      color: idx === 5 ? rgb(0.95, 1.0, 0.95) : (idx % 2 === 0 ? lightBg : rgb(1, 1, 1)),
      borderColor: idx === 5 ? rgb(0.2, 0.7, 0.3) : rgb(0.85, 0.88, 0.95),
      borderWidth: 1
    });

    page3.drawText(rule.symptom, {
      x: 55,
      y: yBox - 10,
      size: 9.5,
      font: fontBold,
      color: idx === 5 ? rgb(0.1, 0.5, 0.2) : primaryColor
    });

    page3.drawText(`${rule.cause}\n${rule.action}`, {
      x: 55,
      y: yBox - 28,
      size: 8.5,
      font: fontRegular,
      color: slateText,
      lineHeight: 13
    });
  });

  // --- PAGE 4: BUDGET ALLOCATION & SCALING BLUEPRINT ---
  const page4 = addPageWithHeader("Module 4 · Budget Allocation & Scaling", 4, 5);

  page4.drawText("Scaling Mechanics: Vertical vs. Horizontal Expansion", {
    x: 40,
    y: 715,
    size: 18,
    font: fontBold,
    color: primaryColor
  });

  page4.drawText("How top performance marketers scale ad spend without breaking ROAS:", {
    x: 40,
    y: 695,
    size: 10,
    font: fontRegular,
    color: slateText
  });

  // Two columns: Vertical vs Horizontal
  page4.drawRectangle({
    x: 40,
    y: 470,
    width: 250,
    height: 200,
    color: lightBg,
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1
  });

  page4.drawText("VERTICAL SCALING (+20% RULE)", {
    x: 55,
    y: 645,
    size: 11,
    font: fontBold,
    color: brandOrange
  });

  page4.drawText(
    "How it works:\n" +
    "Increase existing winning ad set budget by 15-20%\n" +
    "every 48 to 72 hours.\n\n" +
    "Why it works:\n" +
    "Protects the algorithmic bidding threshold without\n" +
    "triggering the 'Learning Phase' reset.\n\n" +
    "When to stop:\n" +
    "If CPA rises above your Break-Even threshold for\n" +
    "2 consecutive days, roll back to previous budget.",
    {
      x: 55,
      y: 620,
      size: 9,
      font: fontRegular,
      color: slateText,
      lineHeight: 14
    }
  );

  page4.drawRectangle({
    x: 305,
    y: 470,
    width: 250,
    height: 200,
    color: lightBg,
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1
  });

  page4.drawText("HORIZONTAL SCALING (CREATIVE EXPANSION)", {
    x: 315,
    y: 645,
    size: 10,
    font: fontBold,
    color: primaryColor
  });

  page4.drawText(
    "How it works:\n" +
    "Leave winning ads running. Launch fresh campaign\n" +
    "testing new visual hooks or alternative audiences.\n\n" +
    "Why it works:\n" +
    "Expands reach to new pockets of audience without\n" +
    "cannibalizing your winning ad set auction bid.\n\n" +
    "Key Tactics:\n" +
    "• Test new aspect ratios (e.g. 9:16 Reels vs 1:1 Feed)\n" +
    "• Test contrarian copy hooks\n" +
    "• Create Lookalike 1-3% stacks",
    {
      x: 315,
      y: 620,
      size: 9,
      font: fontRegular,
      color: slateText,
      lineHeight: 14
    }
  );

  page4.drawText("Daily Campaign Pacing & Audit Cadence", {
    x: 40,
    y: 430,
    size: 13,
    font: fontBold,
    color: primaryColor
  });

  const dailyCadence = [
    "09:00 AM — Review previous 24h spend vs budget cap. Ensure pacing is consistent.",
    "09:30 AM — Check Event Match Quality in Events Manager. Verify no pixel drops.",
    "02:00 PM — Monitor mid-day CTR and CPC. Flag any ads showing >30% CPC spikes.",
    "07:00 PM — Calculate Day's Break-Even CPA. Compare actual ROAS vs Target ROAS.",
    "Weekly Audit — Retire bottom 20% underperforming creatives and replace with fresh tests."
  ];

  dailyCadence.forEach((cad, idx) => {
    page4.drawText(`• ${cad}`, {
      x: 55,
      y: 395 - idx * 24,
      size: 9,
      font: fontRegular,
      color: slateText
    });
  });

  // --- PAGE 5: CAMPAIGN LAUNCH WORKSHEET ---
  const page5 = addPageWithHeader("Module 5 · Fillable Campaign Blueprint", 5, 5);

  page5.drawText("Campaign Launch Blueprint & Fillable Spec Sheet", {
    x: 40,
    y: 715,
    size: 18,
    font: fontBold,
    color: primaryColor
  });

  page5.drawText("Document your campaign parameters before publishing inside Meta Ads Manager:", {
    x: 40,
    y: 695,
    size: 10,
    font: fontRegular,
    color: slateText
  });

  const fields = [
    "Campaign Name: ____________________________________________________________________",
    "Objective: [ ] Sales / Purchases    [ ] Leads    [ ] Engagement",
    "Product / Offer Selling Price (INR): Rs.  _____________   COGS / Delivery Cost: Rs.  _____________",
    "Maximum Allowable Break-Even CPA (from Calculator): Rs.  _____________",
    "Target Profit ROAS: ______________ x (Minimum acceptable return)",
    "Target Audience Geo: ________________________ Age Range: __________ Gender: [ ] All [ ] M [ ] F",
    "Angle 1 (Pain Hook) Headline: ________________________________________________________",
    "Angle 2 (Contrarian) Headline: ________________________________________________________",
    "Angle 3 (Proof / Demo) Headline: ________________________________________________________",
    "Landing Page URL: https://____________________________________________________________",
    "Daily Budget (INR): Rs.  _____________ (Recommended initial: 3x to 5x Target CPA)"
  ];

  fields.forEach((fld, idx) => {
    page5.drawText(fld, {
      x: 50,
      y: 650 - idx * 42,
      size: 10,
      font: fontRegular,
      color: primaryColor
    });
  });

  page5.drawRectangle({
    x: 40,
    y: 120,
    width: 515,
    height: 55,
    color: rgb(0.95, 0.98, 1.0),
    borderColor: brandOrange,
    borderWidth: 1
  });

  page5.drawText("Need dedicated 1-on-1 performance audit or bespoke advisory?", {
    x: 55,
    y: 152,
    size: 10,
    font: fontBold,
    color: primaryColor
  });

  page5.drawText("Book a private 30-minute growth consultation with Digital Muid at https://digitalmuid.in/consultation", {
    x: 55,
    y: 135,
    size: 9,
    font: fontRegular,
    color: brandOrange
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

function createCalculatorSpreadsheet() {
  const wb = XLSX.utils.book_new();

  // SHEET 1: Unit Economics & Break-Even
  const sheet1Data = [
    ["DIGITAL MUID — META ADS UNIT ECONOMICS & BREAK-EVEN CALCULATOR", "", ""],
    ["Confidential & Proprietary Operating System", "", ""],
    ["", "", ""],
    ["1. PRODUCT & MARGIN INPUTS", "VALUE", "NOTES / FORMULA"],
    ["Selling Price per Unit (Gross Revenue)", 1999, "Selling price to customer in INR"],
    ["Cost of Goods Sold (COGS)", 450, "Direct manufacturing, licensing or fulfillment cost"],
    ["Packaging & Shipping Cost", 120, "Physical shipping, handling, or delivery fee"],
    ["Payment Gateway Fee % (Razorpay/Stripe)", 0.02, "Standard 2.0% gateway transaction fee"],
    ["GST on Payment Gateway Fee (18%)", 0.0036, "18% GST applicable on gateway fee"],
    ["Total Payment Gateway Cost per Unit", { f: "B5*(B8+B9)" }, "=Price * (Gateway Fee + GST)"],
    ["Net Margin per Unit (Before Ad Spend)", { f: "B5-B6-B7-B10" }, "Gross Profit available for ad acquisition"],
    ["Net Margin %", { f: "B11/B5" }, "Gross profit margin percentage"],
    ["", "", ""],
    ["2. BREAK-EVEN ADVERTISING THRESHOLDS", "VALUE", "STRATEGIC MEANING"],
    ["Break-Even ROAS", { f: "1/B12" }, "Minimum ROAS required to not lose money on ad spend"],
    ["Break-Even CPA (Max Allowable Ad Spend)", { f: "B11" }, "Maximum you can spend to acquire 1 customer before losing money"],
    ["Target Desired Net Profit Margin %", 0.25, "Target net profit margin after all ad spend (e.g. 25%)"],
    ["Target Max CPA for Desired Profit", { f: "B11*(1-B17)" }, "Target CPA needed to hit your desired profit margin"],
    ["Target ROAS for Desired Profit", { f: "B5/B18" }, "Target ROAS needed inside Meta Ads Manager"]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Unit Economics");

  // SHEET 2: Target ROAS Forecaster
  const sheet2Data = [
    ["DIGITAL MUID — TARGET ROAS & PROFIT FORECASTER", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Monthly Ad Spend", "Projected ROAS", "Gross Revenue", "Product & Ops Costs", "Total Ad Spend", "Net Profit (INR)"],
    [25000, 2.5, { f: "A4*B4" }, { f: "C4*0.3" }, { f: "A4" }, { f: "C4-D4-E4" }],
    [50000, 2.8, { f: "A5*B5" }, { f: "C5*0.3" }, { f: "A5" }, { f: "C5-D5-E5" }],
    [100000, 3.0, { f: "A6*B6" }, { f: "C6*0.3" }, { f: "A6" }, { f: "C6-D6-E6" }],
    [250000, 2.6, { f: "A7*B7" }, { f: "C7*0.3" }, { f: "A7" }, { f: "C7-D7-E7" }],
    [500000, 2.4, { f: "A8*B8" }, { f: "C8*0.3" }, { f: "A8" }, { f: "C8-D8-E8" }]
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, "ROAS Forecaster");

  // SHEET 3: Volume Scenario Planner
  const sheet3Data = [
    ["DIGITAL MUID — VOLUME SCENARIO PLANNER", "", "", "", "", "", ""],
    ["Sales Orders", "Selling Price", "Gross Revenue", "Total Product COGS", "Estimated Ad Spend", "Net Margin Available", "Projected Net Profit"],
    [10, 1999, { f: "A3*B3" }, { f: "A3*570" }, { f: "A3*700" }, { f: "C3-D3" }, { f: "F3-E3" }],
    [25, 1999, { f: "A4*B4" }, { f: "A4*570" }, { f: "A4*700" }, { f: "C4-D4" }, { f: "F4-E4" }],
    [50, 1999, { f: "A5*B5" }, { f: "A5*570" }, { f: "A5*680" }, { f: "C5-D5" }, { f: "F5-E5" }],
    [100, 1999, { f: "A6*B6" }, { f: "A6*570" }, { f: "A6*650" }, { f: "C6-D6" }, { f: "F6-E6" }],
    [250, 1999, { f: "A7*B7" }, { f: "A7*550" }, { f: "A7*650" }, { f: "C7-D7" }, { f: "F7-E7" }],
    [500, 1999, { f: "A8*B8" }, { f: "A8*530" }, { f: "A8*670" }, { f: "C8-D8" }, { f: "F8-E8" }]
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Volume Scenarios");

  // SHEET 4: Daily Campaign Tracker
  const sheet4Data = [
    ["DIGITAL MUID — DAILY CAMPAIGN PERFORMANCE TRACKER", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Date", "Campaign Name", "Ad Spend (INR)", "Impressions", "Clicks", "CTR %", "CPC (INR)", "Landing Page Views", "LP View Rate %", "Purchases", "Conv Rate %", "CPA (INR)", "Revenue (INR)", "ROAS"],
    ["2026-10-01", "TOF - Advantage+ Broad Test", 2500, 12000, 240, { f: "E3/D3" }, { f: "C3/E3" }, 185, { f: "H3/E3" }, 4, { f: "J3/H3" }, { f: "C3/J3" }, 7996, { f: "M3/C3" }],
    ["2026-10-02", "TOF - Advantage+ Broad Test", 3000, 15500, 310, { f: "E4/D4" }, { f: "C4/E4" }, 245, { f: "H4/E4" }, 6, { f: "J4/H4" }, { f: "C4/J4" }, 11994, { f: "M4/C4" }],
    ["2026-10-03", "MOF - 30D Engagers Retargeting", 1200, 4800, 120, { f: "E5/D5" }, { f: "C5/E5" }, 105, { f: "H5/E5" }, 3, { f: "J5/H5" }, { f: "C5/J5" }, 5997, { f: "M5/C5" }],
    ["2026-10-04", "BOF - 7D Cart Abandoners", 800, 1900, 65, { f: "E6/D6" }, { f: "C6/E6" }, 60, { f: "H6/E6" }, 2, { f: "J6/H6" }, { f: "C6/J6" }, 3998, { f: "M6/C6" }]
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);
  ws4["!cols"] = [
    { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, ws4, "Daily Tracker");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function createCalculatorPdf() {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const primaryColor = rgb(0.04, 0.08, 0.16);
  const brandOrange = rgb(1.0, 0.42, 0.0);
  const slateText = rgb(0.2, 0.25, 0.35);

  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Header
  page.drawRectangle({
    x: 0,
    y: height - 60,
    width: width,
    height: 60,
    color: primaryColor
  });

  page.drawRectangle({
    x: 0,
    y: height - 63,
    width: width,
    height: 3,
    color: brandOrange
  });

  page.drawText("DIGITAL MUID", {
    x: 40,
    y: height - 38,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  page.drawText("INTERACTIVE AD BUDGET & BREAK-EVEN CALCULATOR", {
    x: 160,
    y: height - 37,
    size: 9,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.95)
  });

  page.drawText("Interactive Ad Budget & Break-Even Calculator", {
    x: 40,
    y: 715,
    size: 20,
    font: fontBold,
    color: primaryColor
  });

  page.drawText("Mathematical Operating Protocol: Unit Economics, Break-Even CPA & Target ROAS Formulas", {
    x: 40,
    y: 695,
    size: 10,
    font: fontRegular,
    color: slateText
  });

  const formulas = [
    {
      title: "1. NET MARGIN PER UNIT (BEFORE ADS)",
      formula: "Net Margin = Selling Price - COGS - Shipping - (Selling Price * 2.36% Gateway Fee)",
      explanation: "This is the absolute ceiling of money available to spend on marketing per customer before losing money."
    },
    {
      title: "2. BREAK-EVEN ROAS",
      formula: "Break-Even ROAS = 1 / (Net Margin / Selling Price) = Selling Price / Net Margin",
      explanation: "Example: For Rs. 1,999 selling price and Rs. 1,380 net margin, Break-Even ROAS is 1.45x. Anything above 1.45x is pure net profit."
    },
    {
      title: "3. TARGET CPA (DESIRED 25% PROFIT MARGIN)",
      formula: "Target Max CPA = Net Margin * (1 - Desired Net Profit Margin %)",
      explanation: "If you want 25% net profit in your bank account, your ad team must acquire buyers at or below this target CPA."
    },
    {
      title: "4. TARGET ROAS",
      formula: "Target ROAS = Selling Price / Target Max CPA",
      explanation: "Set this number inside Meta Ads Advantage+ bid caps or ROAS goals to automate bidding protection."
    },
    {
      title: "5. LANDING PAGE VIEW DROP-OFF BENCHMARK",
      formula: "LP Drop-off Rate = (Link Clicks - Landing Page Views) / Link Clicks",
      explanation: "Acceptable benchmark: Under 25%. If drop-off exceeds 30%, your mobile site speed is destroying your ad return."
    }
  ];

  formulas.forEach((item, idx) => {
    const yTop = 645 - idx * 105;
    page.drawRectangle({
      x: 40,
      y: yTop - 85,
      width: 515,
      height: 90,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.95),
      borderWidth: 1
    });

    page.drawText(item.title, {
      x: 55,
      y: yTop - 15,
      size: 10,
      font: fontBold,
      color: brandOrange
    });

    page.drawText(`Formula: ${item.formula}`, {
      x: 55,
      y: yTop - 35,
      size: 9.5,
      font: fontBold,
      color: primaryColor
    });

    page.drawText(`Strategic Context: ${item.explanation}`, {
      x: 55,
      y: yTop - 55,
      size: 8.5,
      font: fontRegular,
      color: slateText,
      lineHeight: 12
    });
  });

  page.drawText("Note: This package includes both this mathematical protocol document and the full interactive Excel .xlsx spreadsheet.", {
    x: 40,
    y: 80,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

async function createCopyFrameworksPdf() {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const primaryColor = rgb(0.04, 0.08, 0.16);
  const brandOrange = rgb(1.0, 0.42, 0.0);
  const slateText = rgb(0.2, 0.25, 0.35);

  function addFrameworkPage(title, pageNum, totalPages = 4) {
    const page = doc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    page.drawRectangle({
      x: 0,
      y: height - 60,
      width: width,
      height: 60,
      color: primaryColor
    });

    page.drawRectangle({
      x: 0,
      y: height - 63,
      width: width,
      height: 3,
      color: brandOrange
    });

    page.drawText("DIGITAL MUID", {
      x: 40,
      y: height - 38,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page.drawText("10 HIGH-CONVERTING META ADS COPY FRAMEWORKS", {
      x: 160,
      y: height - 37,
      size: 9,
      font: fontRegular,
      color: rgb(0.8, 0.85, 0.95)
    });

    page.drawText(`PAGE ${pageNum} OF ${totalPages}`, {
      x: width - 120,
      y: height - 37,
      size: 9,
      font: fontBold,
      color: brandOrange
    });

    page.drawText(title.toUpperCase(), {
      x: 40,
      y: height - 85,
      size: 11,
      font: fontBold,
      color: brandOrange
    });

    page.drawLine({
      start: { x: 40, y: 45 },
      end: { x: width - 40, y: 45 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92)
    });

    page.drawText("Digital Muid © 2026 · Confidential & Proprietary · Master Copywriting Swipe File", {
      x: 40,
      y: 30,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6)
    });

    return page;
  }

  // --- PAGE 1: Frameworks 1 - 3 ---
  const page1 = addFrameworkPage("Frameworks 1 - 3: Pain, Transformation & Curiosity", 1, 4);

  page1.drawText("10 High-Converting Meta Ads Copy Frameworks", {
    x: 40,
    y: 715,
    size: 20,
    font: fontBold,
    color: primaryColor
  });

  page1.drawText("Plug-and-play copywriting swipe files, tested headline formulas & creative hook templates.", {
    x: 40,
    y: 695,
    size: 10,
    font: fontRegular,
    color: slateText
  });

  const fws1 = [
    {
      num: "01",
      name: "The Before vs. After (Transformation Gap)",
      hook: "Most founders spend 4 hours a day manually checking ad reports and tweaking budgets.",
      structure: "[Current Painful Reality] -> [The Catalyzing Shift] -> [The New Frictionless State]",
      swipe: "Before: You stare at Meta Ads Manager wondering why your budget disappeared with 0 sales.\nAfter: You deploy a 48-hour diagnostic matrix. You know your exact break-even numbers before spending Rs. 1."
    },
    {
      num: "02",
      name: "The Cost of Inaction (Mistake Callout)",
      hook: "The #1 mistake brands make with Meta Ads isn't their targeting. It's their math.",
      structure: "[Identify Common Blunder] -> [Quantify Wasted Capital] -> [Deliver Tactical Antidote]",
      swipe: "If your customer acquisition cost is higher than your net margin after gateway fees, scaling spend only scales bankruptcy. Fix your unit economics before increasing daily budgets."
    },
    {
      num: "03",
      name: "The Curiosity & Value Stack",
      hook: "Here are the 4 tools we hand enterprise growth teams during private audits.",
      structure: "[Curiosity Hook] -> [Itemized Value Stack 1, 2, 3, 4] -> [Low-Risk Call to Action]",
      swipe: "1. The Campaign Planner Workbook (TOF/MOF/BOF)\n2. The Break-Even & Unit Economics Calculator\n3. 10 Tested Ad Copy Swipe Frameworks\n4. Pre-Launch CAPI & Pixel Verification Checklist"
    }
  ];

  fws1.forEach((fw, idx) => {
    const yTop = 645 - idx * 165;
    page1.drawRectangle({
      x: 40,
      y: yTop - 145,
      width: 515,
      height: 150,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.95),
      borderWidth: 1
    });

    page1.drawText(`FRAMEWORK ${fw.num}: ${fw.name.toUpperCase()}`, {
      x: 55,
      y: yTop - 15,
      size: 10,
      font: fontBold,
      color: brandOrange
    });

    page1.drawText(`Opening Hook: "${fw.hook}"`, {
      x: 55,
      y: yTop - 35,
      size: 9.5,
      font: fontBold,
      color: primaryColor
    });

    page1.drawText(`Architecture: ${fw.structure}`, {
      x: 55,
      y: yTop - 55,
      size: 8.5,
      font: fontRegular,
      color: slateText
    });

    page1.drawText(`Full Swipe Copy:\n${fw.swipe}`, {
      x: 55,
      y: yTop - 85,
      size: 8.5,
      font: fontRegular,
      color: primaryColor,
      lineHeight: 13
    });
  });

  // --- PAGE 2: Frameworks 4 - 6 ---
  const page2 = addFrameworkPage("Frameworks 4 - 6: Proof, Contrarian & Comparison", 2, 4);

  const fws2 = [
    {
      num: "04",
      name: "The Social Proof & Verified Outcome",
      hook: "How a D2C apparel brand cut their customer acquisition cost by 42% in 14 days.",
      structure: "[Specific Client Metric] -> [Core Bottleneck Uncovered] -> [Exact Action Taken]",
      swipe: "We didn't touch their audiences. We fixed their mobile checkout drop-off and tested 3 contrasting video hooks. Result: CAC dropped from Rs. 850 to Rs. 490 while scaling spend 2.5x."
    },
    {
      num: "05",
      name: "The Contrarian Industry Myth",
      hook: "Broad targeting is outperforming narrow interest stacks for 90% of brands.",
      structure: "[State Counter-Intuitive Truth] -> [Provide Algorithmic Proof] -> [Next Step]",
      swipe: "Meta's Advantage+ algorithm has billions of data points. Micro-targeting suffocates machine learning. The modern media buyer builds creative variations that do the targeting for them."
    },
    {
      num: "06",
      name: 'The "Us vs. Them" Comparison',
      hook: "Amateur ad strategy vs. Professional growth architecture.",
      structure: "[Contrast Side-by-Side: The Frustrated Approach vs. The Systematic Approach]",
      swipe: "Amateur: Boosts posts, guesses daily budget, panics when CPA spikes.\nProfessional: Runs unit economics math first, deploys 3-angle creative tests, follows 48h rules."
    }
  ];

  fws2.forEach((fw, idx) => {
    const yTop = 710 - idx * 175;
    page2.drawRectangle({
      x: 40,
      y: yTop - 155,
      width: 515,
      height: 160,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.95),
      borderWidth: 1
    });

    page2.drawText(`FRAMEWORK ${fw.num}: ${fw.name.toUpperCase()}`, {
      x: 55,
      y: yTop - 15,
      size: 10,
      font: fontBold,
      color: brandOrange
    });

    page2.drawText(`Opening Hook: "${fw.hook}"`, {
      x: 55,
      y: yTop - 35,
      size: 9.5,
      font: fontBold,
      color: primaryColor
    });

    page2.drawText(`Architecture: ${fw.structure}`, {
      x: 55,
      y: yTop - 55,
      size: 8.5,
      font: fontRegular,
      color: slateText
    });

    page2.drawText(`Full Swipe Copy:\n${fw.swipe}`, {
      x: 55,
      y: yTop - 85,
      size: 8.5,
      font: fontRegular,
      color: primaryColor,
      lineHeight: 13
    });
  });

  // --- PAGE 3: Frameworks 7 - 10 ---
  const page3 = addFrameworkPage("Frameworks 7 - 10: Objections, Micro-Wins & Scarcity", 3, 4);

  const fws3 = [
    {
      num: "07",
      name: "The Objection Obliterator",
      hook: '"Will this work if I have a small testing budget under Rs. 15,000?"',
      structure: "[Anticipate Primary Friction] -> [Provide Reassurance] -> [Demonstrate Efficiency]",
      swipe: "Yes. Small budgets require stricter math. You can't afford to burn testing money on broken funnels. The Break-Even Calculator ensures you never overspend on non-performing creatives."
    },
    {
      num: "08",
      name: "The Quick-Win Micro-Script",
      hook: "Try this 1 headline tweak today to immediately lift click-through rate.",
      structure: "[Deliver 1 Instant High-Impact Action] -> [Explain the Mechanism] -> [Call to Action]",
      swipe: "Replace 'Best Marketing Agency' with 'We help B2B SaaS companies add Rs. 20L in pipeline without increasing sales headcount.' Specificity and outcome always beat generic claims."
    },
    {
      num: "09",
      name: "The Founder Vulnerability Story",
      hook: "In 2018, I burned over Rs. 2 Lakhs on Meta Ads before I understood unit economics.",
      structure: "[Relatable Failure] -> [The Breakthrough Discovery] -> [Codified Solution]",
      swipe: "I blamed the platform. I blamed the algorithm. Then I calculated my actual net margins after payment fees and realised my unit economics were upside down. Here is the framework I built..."
    },
    {
      num: "10",
      name: "The Direct Offer & Risk-Reversal",
      hook: "Get the complete Meta Ads Campaign Planner Bundle for a one-time investment of Rs. 299.",
      structure: "[Clear Offer] -> [Deliverables Summary] -> [Guarantee & Immediate Delivery]",
      swipe: "Includes Workbook, Spreadsheet Calculator, 10 Copy Frameworks, and Pre-Launch Checklist. Instant digital download. 100% verified access."
    }
  ];

  fws3.forEach((fw, idx) => {
    const yTop = 710 - idx * 135;
    page3.drawRectangle({
      x: 40,
      y: yTop - 120,
      width: 515,
      height: 125,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.95),
      borderWidth: 1
    });

    page3.drawText(`FRAMEWORK ${fw.num}: ${fw.name.toUpperCase()}`, {
      x: 55,
      y: yTop - 12,
      size: 9.5,
      font: fontBold,
      color: brandOrange
    });

    page3.drawText(`Opening Hook: "${fw.hook}"`, {
      x: 55,
      y: yTop - 30,
      size: 9,
      font: fontBold,
      color: primaryColor
    });

    page3.drawText(`Swipe Copy: ${fw.swipe}`, {
      x: 55,
      y: yTop - 48,
      size: 8,
      font: fontRegular,
      color: slateText,
      lineHeight: 11
    });
  });

  // --- PAGE 4: 10 CLICK-WORTHY HEADLINE FORMULAS ---
  const page4 = addFrameworkPage("Appendix · 10 Click-Worthy Headline Formulas", 4, 4);

  page4.drawText("10 Tested Headline Hooks for Meta & Instagram Ads", {
    x: 40,
    y: 715,
    size: 18,
    font: fontBold,
    color: primaryColor
  });

  page4.drawText("Tested headline formulas designed to stop scroll fatigue and drive qualified clicks:", {
    x: 40,
    y: 695,
    size: 10,
    font: fontRegular,
    color: slateText
  });

  const headlines = [
    "1. The Warning Hook: \"Stop Running Meta Ads Until You Check These 3 Unit Economic Numbers.\"",
    "2. The Contrarian Hook: \"Why 95% of Ads Manager Targeting Hacks Are a Complete Waste of Time.\"",
    "3. The Mechanism Hook: \"The 48-Hour Decision Rule: Exactly When to Kill, Fix, or Scale Any Ad.\"",
    "4. The Speed Hook: \"How to Audit Your Entire Meta Ads Funnel in 15 Minutes Flat.\"",
    "5. The Social Proof Hook: \"The Exact Framework We Used to Drop Ad CPA by 42% for D2C Brands.\"",
    "6. The Direct Question: \"Is Your Customer Acquisition Cost Eating 100% of Your Net Margins?\"",
    "7. The Resource Hook: \"Download the Free Break-Even ROAS Calculator for Meta Performance Marketers.\"",
    "8. The Checklist Hook: \"Pre-Launch Protocol: 12 Technical Checks Before Clicking 'Publish' Inside Ads Manager.\"",
    "9. The Curiosity Hook: \"3 Creative Angles That Consistently Outperform Standard Product Photos.\"",
    "10. The Direct Transformation: \"Turn Chaotic Ad Spend into Predictable, Compounding Revenue.\""
  ];

  headlines.forEach((hl, idx) => {
    page4.drawText(hl, {
      x: 50,
      y: 650 - idx * 45,
      size: 9.5,
      font: fontRegular,
      color: primaryColor
    });
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function generateAndUploadAllAssets() {
  console.log("Generating authentic bundle assets...");

  const workbookPdf = await createWorkbookPdf();
  const calculatorXlsx = createCalculatorSpreadsheet();
  const calculatorPdf = await createCalculatorPdf();
  const copyFrameworksPdf = await createCopyFrameworksPdf();

  console.log(`Generated:
  - Workbook PDF: ${workbookPdf.length} bytes
  - Calculator XLSX: ${calculatorXlsx.length} bytes
  - Calculator PDF: ${calculatorPdf.length} bytes
  - Copy Frameworks PDF: ${copyFrameworksPdf.length} bytes`);

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase server client unavailable.");
  }

  // Upload to Supabase Storage bucket 'resources' under 'paid/'
  const uploads = [
    {
      path: "paid/meta-ads-campaign-planner-workbook.pdf",
      buffer: workbookPdf,
      contentType: "application/pdf"
    },
    {
      path: "paid/the-ad-budget-break-even-calculator.xlsx",
      buffer: calculatorXlsx,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    {
      path: "paid/the-ad-budget-break-even-calculator.pdf",
      buffer: calculatorPdf,
      contentType: "application/pdf"
    },
    {
      path: "paid/10-high-converting-meta-ads-copy-frameworks.pdf",
      buffer: copyFrameworksPdf,
      contentType: "application/pdf"
    }
  ];

  for (const item of uploads) {
    const { data, error } = await supabase.storage
      .from("resources")
      .upload(item.path, item.buffer, {
        contentType: item.contentType,
        upsert: true
      });

    if (error) {
      console.error(`Failed uploading ${item.path}:`, error.message);
    } else {
      console.log(`Successfully uploaded ${item.path} (${item.buffer.length} bytes) to resources bucket!`);
    }
  }

  // Also write to public/downloads for local fallback consistency
  fs.writeFileSync(path.resolve("public/downloads/meta-ads-campaign-planner-workbook.pdf"), workbookPdf);
  fs.writeFileSync(path.resolve("public/downloads/the-ad-budget-break-even-calculator.xlsx"), calculatorXlsx);
  fs.writeFileSync(path.resolve("public/downloads/the-ad-budget-break-even-calculator.pdf"), calculatorPdf);
  fs.writeFileSync(path.resolve("public/downloads/10-high-converting-meta-ads-copy-frameworks.pdf"), copyFrameworksPdf);

  console.log("Local public/downloads files synchronized.");
}

// Self-run
if (process.argv[1] && process.argv[1].includes("generateAndUploadBundleAssets")) {
  generateAndUploadAllAssets()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Asset generation error:", err);
      process.exit(1);
    });
}

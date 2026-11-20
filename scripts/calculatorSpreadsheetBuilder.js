import writeExcelFile from "write-excel-file/node";

/**
 * Pure, offline OOXML (.xlsx) workbook builder for the
 * DigitalMuid Meta Ads Unit Economics & Break-Even Calculator.
 *
 * Uses write-excel-file/node (write-only OOXML generator) instead of xlsx@0.18.5.
 * Contains zero network, filesystem, or database side effects.
 */

function formula(expr) {
  return { type: "Formula", value: expr };
}

function toCell(entry) {
  if (entry === null || entry === undefined || entry === "") {
    return null;
  }
  if (typeof entry === "object" && entry.type === "Formula") {
    return entry;
  }
  if (typeof entry === "number") {
    return { type: Number, value: entry };
  }
  return { type: String, value: String(entry) };
}

function toSheetRows(aoa) {
  return aoa.map((row) => row.map(toCell));
}

export const CALCULATOR_WORKBOOK_SPEC = [
  {
    name: "Unit Economics",
    widths: [45, 18, 55],
    rows: [
      ["DIGITAL MUID — META ADS UNIT ECONOMICS & BREAK-EVEN CALCULATOR", "", ""],
      ["Confidential & Proprietary Operating System", "", ""],
      ["", "", ""],
      ["1. PRODUCT & MARGIN INPUTS", "VALUE", "NOTES / FORMULA"],
      ["Selling Price per Unit (Gross Revenue)", 1999, "Selling price to customer in INR"],
      ["Cost of Goods Sold (COGS)", 450, "Direct manufacturing, licensing or fulfillment cost"],
      ["Packaging & Shipping Cost", 120, "Physical shipping, handling, or delivery fee"],
      ["Payment Gateway Fee % (Razorpay/Stripe)", 0.02, "Standard 2.0% gateway transaction fee"],
      ["GST on Payment Gateway Fee (18%)", 0.0036, "18% GST applicable on gateway fee"],
      ["Total Payment Gateway Cost per Unit", formula("B5*(B8+B9)"), "=Price * (Gateway Fee + GST)"],
      ["Net Margin per Unit (Before Ad Spend)", formula("B5-B6-B7-B10"), "Gross Profit available for ad acquisition"],
      ["Net Margin %", formula("B11/B5"), "Gross profit margin percentage"],
      ["", "", ""],
      ["2. BREAK-EVEN ADVERTISING THRESHOLDS", "VALUE", "STRATEGIC MEANING"],
      ["Break-Even ROAS", formula("1/B12"), "Minimum ROAS required to not lose money on ad spend"],
      ["Break-Even CPA (Max Allowable Ad Spend)", formula("B11"), "Maximum you can spend to acquire 1 customer before losing money"],
      ["Target Desired Net Profit Margin %", 0.25, "Target net profit margin after all ad spend (e.g. 25%)"],
      ["Target Max CPA for Desired Profit", formula("B11*(1-B17)"), "Target CPA needed to hit your desired profit margin"],
      ["Target ROAS for Desired Profit", formula("B5/B18"), "Target ROAS needed inside Meta Ads Manager"]
    ]
  },
  {
    name: "ROAS Forecaster",
    widths: [20, 18, 20, 22, 18, 20],
    rows: [
      ["DIGITAL MUID — TARGET ROAS & PROFIT FORECASTER", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["Monthly Ad Spend", "Projected ROAS", "Gross Revenue", "Product & Ops Costs", "Total Ad Spend", "Net Profit (INR)"],
      [25000, 2.5, formula("A4*B4"), formula("C4*0.3"), formula("A4"), formula("C4-D4-E4")],
      [50000, 2.8, formula("A5*B5"), formula("C5*0.3"), formula("A5"), formula("C5-D5-E5")],
      [100000, 3.0, formula("A6*B6"), formula("C6*0.3"), formula("A6"), formula("C6-D6-E6")],
      [250000, 2.6, formula("A7*B7"), formula("C7*0.3"), formula("A7"), formula("C7-D7-E7")],
      [500000, 2.4, formula("A8*B8"), formula("C8*0.3"), formula("A8"), formula("C8-D8-E8")]
    ]
  },
  {
    name: "Volume Scenarios",
    widths: [16, 16, 18, 20, 20, 22, 22],
    rows: [
      ["DIGITAL MUID — VOLUME SCENARIO PLANNER", "", "", "", "", "", ""],
      ["Sales Orders", "Selling Price", "Gross Revenue", "Total Product COGS", "Estimated Ad Spend", "Net Margin Available", "Projected Net Profit"],
      [10, 1999, formula("A3*B3"), formula("A3*570"), formula("A3*700"), formula("C3-D3"), formula("F3-E3")],
      [25, 1999, formula("A4*B4"), formula("A4*570"), formula("A4*700"), formula("C4-D4"), formula("F4-E4")],
      [50, 1999, formula("A5*B5"), formula("A5*570"), formula("A5*680"), formula("C5-D5"), formula("F5-E5")],
      [100, 1999, formula("A6*B6"), formula("A6*570"), formula("A6*650"), formula("C6-D6"), formula("F6-E6")],
      [250, 1999, formula("A7*B7"), formula("A7*550"), formula("A7*650"), formula("C7-D7"), formula("F7-E7")],
      [500, 1999, formula("A8*B8"), formula("A8*530"), formula("A8*670"), formula("C8-D8"), formula("F8-E8")]
    ]
  },
  {
    name: "Daily Tracker",
    widths: [14, 32, 16, 14, 10, 12, 12, 20, 16, 12, 14, 14, 16, 12],
    rows: [
      ["DIGITAL MUID — DAILY CAMPAIGN PERFORMANCE TRACKER", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Date", "Campaign Name", "Ad Spend (INR)", "Impressions", "Clicks", "CTR %", "CPC (INR)", "Landing Page Views", "LP View Rate %", "Purchases", "Conv Rate %", "CPA (INR)", "Revenue (INR)", "ROAS"],
      ["2026-10-01", "TOF - Advantage+ Broad Test", 2500, 12000, 240, formula("E3/D3"), formula("C3/E3"), 185, formula("H3/E3"), 4, formula("J3/H3"), formula("C3/J3"), 7996, formula("M3/C3")],
      ["2026-10-02", "TOF - Advantage+ Broad Test", 3000, 15500, 310, formula("E4/D4"), formula("C4/E4"), 245, formula("H4/E4"), 6, formula("J4/H4"), formula("C4/J4"), 11994, formula("M4/C4")],
      ["2026-10-03", "MOF - 30D Engagers Retargeting", 1200, 4800, 120, formula("E5/D5"), formula("C5/E5"), 105, formula("H5/E5"), 3, formula("J5/H5"), formula("C5/J5"), 5997, formula("M5/C5")],
      ["2026-10-04", "BOF - 7D Cart Abandoners", 800, 1900, 65, formula("E6/D6"), formula("C6/E6"), 60, formula("H6/E6"), 2, formula("J6/H6"), formula("C6/J6"), 3998, formula("M6/C6")]
    ]
  }
];

export async function createCalculatorSpreadsheet() {
  const sheets = CALCULATOR_WORKBOOK_SPEC.map((spec) => ({
    sheet: spec.name,
    columns: spec.widths.map((width) => ({ width })),
    data: toSheetRows(spec.rows)
  }));

  const buffer = await writeExcelFile(sheets).toBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

/**
 * DIGITALMUID V4.3 — XLSX SECURITY REMEDIATION OFFLINE REGRESSION TEST SUITE
 *
 * Strictly offline (zero network, Supabase, Razorpay, or Resend calls).
 * Verifies:
 *   1. Generated .xlsx Buffer is a valid ZIP/OOXML spreadsheet package.
 *   2. All 4 worksheets exist in exact expected order.
 *   3. Exact column widths are encoded in <cols>/<col> on every worksheet.
 *   4. Every string and numeric cell matches the canonical calculator spec.
 *   5. All 81 Excel formulas (7 + 20 + 30 + 24) match exact cell references and
 *      valid OOXML <f> syntax (no leading '=' inside <f>).
 *   6. Zero remaining executable imports of the vulnerable `xlsx` package exist
 *      anywhere in the codebase, package.json, or package-lock.json.
 *   7. scripts/generateAndUploadBundleAssets.js preserves top-level fail-closed
 *      enforceStagingSafety() and awaits createCalculatorSpreadsheet().
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { unzipSync, strFromU8 } from "fflate";
import {
  CALCULATOR_WORKBOOK_SPEC,
  createCalculatorSpreadsheet
} from "../scripts/calculatorSpreadsheetBuilder.js";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

function colIndexToLetters(idx) {
  let n = idx + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml)) !== null) {
    const tParts = [];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRegex.exec(m[1])) !== null) {
      tParts.push(decodeXmlEntities(tm[1]));
    }
    strings.push(tParts.join(""));
  }
  return strings;
}

function parseSheetCells(sheetXml, sharedStrings) {
  const cells = new Map();
  const cellRegex = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cellRegex.exec(sheetXml)) !== null) {
    const attrs = m[1];
    const inner = m[2] || "";
    const refMatch = attrs.match(/\br="([A-Z]+\d+)"/);
    if (!refMatch) continue;
    const ref = refMatch[1];
    const typeMatch = attrs.match(/\bt="([^"]+)"/);
    const cellType = typeMatch ? typeMatch[1] : null;
    const fMatch = inner.match(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/);
    const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
    const isMatch = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

    if (fMatch) {
      cells.set(ref, { kind: "formula", formula: decodeXmlEntities(fMatch[1]) });
    } else if (cellType === "s" && vMatch) {
      const idx = parseInt(vMatch[1], 10);
      cells.set(ref, { kind: "string", value: sharedStrings[idx] });
    } else if (cellType === "inlineStr" && isMatch) {
      cells.set(ref, { kind: "string", value: decodeXmlEntities(isMatch[1]) });
    } else if (vMatch) {
      cells.set(ref, { kind: "number", value: Number(vMatch[1]) });
    }
  }
  return cells;
}

function parseColumnWidths(sheetXml) {
  const widths = [];
  const colRegex = /<col\s+([^>]*?)\/>/g;
  let m;
  while ((m = colRegex.exec(sheetXml)) !== null) {
    const attrs = m[1];
    const min = Number((attrs.match(/\bmin="(\d+)"/) || [])[1]);
    const max = Number((attrs.match(/\bmax="(\d+)"/) || [])[1]);
    const width = Number((attrs.match(/\bwidth="([\d.]+)"/) || [])[1]);
    for (let c = min; c <= max; c++) {
      widths[c - 1] = width;
    }
  }
  return widths;
}

function walkCodeFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCodeFiles(full, out);
    } else if (/\.(js|mjs|cjs|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

console.log("==============================================================================");
console.log("DIGITALMUID V4.3 — XLSX SECURITY REMEDIATION REGRESSION TEST SUITE");
console.log("==============================================================================");

let xlsxBuffer;
let entries;
let sharedStrings = [];

await test("1. createCalculatorSpreadsheet() asynchronously returns a valid ZIP/OOXML Buffer", async () => {
  xlsxBuffer = await createCalculatorSpreadsheet();
  assert(Buffer.isBuffer(xlsxBuffer), "Output must be a Node.js Buffer");
  assert(xlsxBuffer.length > 1000, `Expected non-trivial XLSX buffer, got ${xlsxBuffer.length} bytes`);
  assert.strictEqual(xlsxBuffer[0], 0x50, "ZIP signature byte 0 must be 'P'");
  assert.strictEqual(xlsxBuffer[1], 0x4b, "ZIP signature byte 1 must be 'K'");
  assert.strictEqual(xlsxBuffer[2], 0x03, "ZIP signature byte 2 must be 0x03");
  assert.strictEqual(xlsxBuffer[3], 0x04, "ZIP signature byte 3 must be 0x04");

  entries = unzipSync(new Uint8Array(xlsxBuffer));
  const names = Object.keys(entries);
  assert(names.includes("[Content_Types].xml"), "Missing [Content_Types].xml");
  assert(names.includes("xl/workbook.xml"), "Missing xl/workbook.xml");
  assert(names.includes("xl/worksheets/sheet1.xml"), "Missing sheet1.xml");
  assert(names.includes("xl/worksheets/sheet2.xml"), "Missing sheet2.xml");
  assert(names.includes("xl/worksheets/sheet3.xml"), "Missing sheet3.xml");
  assert(names.includes("xl/worksheets/sheet4.xml"), "Missing sheet4.xml");

  if (entries["xl/sharedStrings.xml"]) {
    sharedStrings = parseSharedStrings(strFromU8(entries["xl/sharedStrings.xml"]));
  }
});

await test("2. Workbook contains exact 4 worksheets in canonical order", async () => {
  const wbXml = strFromU8(entries["xl/workbook.xml"]);
  const sheetNames = [];
  const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"[^>]*\/>/g;
  let m;
  while ((m = sheetRegex.exec(wbXml)) !== null) {
    sheetNames.push(decodeXmlEntities(m[1]));
  }
  assert.deepStrictEqual(sheetNames, [
    "Unit Economics",
    "ROAS Forecaster",
    "Volume Scenarios",
    "Daily Tracker"
  ]);
});

await test("3. Exact column widths are preserved on all 4 worksheets", async () => {
  CALCULATOR_WORKBOOK_SPEC.forEach((spec, idx) => {
    const sheetXml = strFromU8(entries[`xl/worksheets/sheet${idx + 1}.xml`]);
    const widths = parseColumnWidths(sheetXml);
    assert.strictEqual(
      widths.length,
      spec.widths.length,
      `${spec.name}: expected ${spec.widths.length} column width definitions, got ${widths.length}`
    );
    spec.widths.forEach((expectedWidth, colIdx) => {
      assert.strictEqual(
        widths[colIdx],
        expectedWidth,
        `${spec.name} col ${colIdx + 1}: expected width ${expectedWidth}, got ${widths[colIdx]}`
      );
    });
  });
});

await test("4. All string values, numeric values, and all 81 OOXML formulas match canonical spec", async () => {
  const expectedFormulaCounts = [7, 20, 30, 24];
  let totalFormulas = 0;

  CALCULATOR_WORKBOOK_SPEC.forEach((spec, sIdx) => {
    const sheetXml = strFromU8(entries[`xl/worksheets/sheet${sIdx + 1}.xml`]);
    const parsedCells = parseSheetCells(sheetXml, sharedStrings);
    let sheetFormulaCount = 0;

    spec.rows.forEach((row, rIdx) => {
      row.forEach((cellSpec, cIdx) => {
        if (cellSpec === "" || cellSpec === null || cellSpec === undefined) return;
        const ref = `${colIndexToLetters(cIdx)}${rIdx + 1}`;
        const actual = parsedCells.get(ref);
        assert(actual, `${spec.name}!${ref} is missing from generated XML`);

        if (typeof cellSpec === "object" && cellSpec.type === "Formula") {
          sheetFormulaCount++;
          totalFormulas++;
          assert.strictEqual(actual.kind, "formula", `${spec.name}!${ref} must be a formula cell`);
          assert(
            !actual.formula.startsWith("="),
            `${spec.name}!${ref} OOXML <f> must NOT start with '=' (got '${actual.formula}')`
          );
          assert.strictEqual(
            actual.formula,
            cellSpec.value,
            `${spec.name}!${ref} formula mismatch`
          );
        } else if (typeof cellSpec === "number") {
          assert.strictEqual(actual.kind, "number", `${spec.name}!${ref} must be numeric`);
          assert(
            Math.abs(actual.value - cellSpec) < 1e-12,
            `${spec.name}!${ref} numeric mismatch: expected ${cellSpec}, got ${actual.value}`
          );
        } else {
          assert.strictEqual(actual.kind, "string", `${spec.name}!${ref} must be string`);
          assert.strictEqual(
            actual.value,
            String(cellSpec),
            `${spec.name}!${ref} string mismatch`
          );
        }
      });
    });

    assert.strictEqual(
      sheetFormulaCount,
      expectedFormulaCounts[sIdx],
      `${spec.name}: expected ${expectedFormulaCounts[sIdx]} formulas, verified ${sheetFormulaCount}`
    );
  });

  assert.strictEqual(totalFormulas, 81, `Expected 81 total formulas across all 4 sheets, got ${totalFormulas}`);
});

await test("5. Zero remaining executable imports of `xlsx` across codebase and manifests", async () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
  assert(!pkg.dependencies?.xlsx, "package.json dependencies must not include xlsx");
  assert(!pkg.devDependencies?.xlsx, "package.json devDependencies must not include xlsx");
  assert(
    pkg.devDependencies?.["write-excel-file"],
    "package.json devDependencies must include write-excel-file"
  );

  const lock = JSON.parse(fs.readFileSync(path.resolve("package-lock.json"), "utf8"));
  assert.strictEqual(lock.lockfileVersion, 3, "package-lock.json must preserve lockfileVersion 3");
  assert(!lock.packages?.["node_modules/xlsx"], "package-lock.json must not contain node_modules/xlsx");
  assert.strictEqual(
    lock.packages?.["node_modules/write-excel-file"]?.version,
    "4.1.1",
    "package-lock.json must resolve write-excel-file@4.1.1"
  );

  const codeFiles = walkCodeFiles(path.resolve("."));
  const importRegex = /(?:from\s+["']xlsx["']|import\s*\(\s*["']xlsx["']\s*\)|require\s*\(\s*["']xlsx["']\s*\))/;
  const offenders = [];
  for (const f of codeFiles) {
    const rel = path.relative(process.cwd(), f);
    if (rel === "tests/xlsx_remediation_test.js") continue;
    const txt = fs.readFileSync(f, "utf8");
    if (importRegex.test(txt)) {
      offenders.push(rel);
    }
  }
  assert.deepStrictEqual(offenders, [], `Found remaining executable xlsx imports: ${offenders.join(", ")}`);
});

await test("6. scripts/generateAndUploadBundleAssets.js preserves fail-closed enforceStagingSafety() and output paths", async () => {
  const scriptPath = path.resolve("scripts/generateAndUploadBundleAssets.js");
  const src = fs.readFileSync(scriptPath, "utf8");
  assert(src.includes("enforceStagingSafety({"), "enforceStagingSafety call must remain intact");
  assert(src.includes("requireBundleUploadFlag: true"), "requireBundleUploadFlag: true must remain intact");
  assert(src.includes("await createCalculatorSpreadsheet()"), "Must await async createCalculatorSpreadsheet()");
  assert(
    src.includes('path: "paid/the-ad-budget-break-even-calculator.xlsx"'),
    "Storage upload path must remain preserved"
  );
  assert(
    src.includes('path.resolve("public/downloads/the-ad-budget-break-even-calculator.xlsx")'),
    "Local fallback output path must remain preserved"
  );

  // Live fail-closed check: importing/running the script with blank env MUST exit non-zero before any upload
  const res = spawnSync(process.execPath, [scriptPath], {
    env: { PATH: process.env.PATH || "" },
    encoding: "utf8",
    timeout: 10000
  });
  assert(res.status !== 0, "generateAndUploadBundleAssets.js must fail closed with blank env");
});

console.log("==============================================================================");
console.log(`XLSX REMEDIATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==============================================================================");

if (failed > 0) {
  process.exit(1);
}

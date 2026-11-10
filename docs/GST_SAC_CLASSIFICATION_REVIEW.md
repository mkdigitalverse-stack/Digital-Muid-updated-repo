# DIGITALMUID (MK DIGITALVERSE) — GST SAC CLASSIFICATION STATUTORY AUDIT REVIEW

**Entity:** MK Digitalverse (Brand: DigitalMuid)  
**GSTIN:** 09CHHPK9834Q1ZB (Uttar Pradesh, State Code: 09)  
**Principal Place of Business:** Lucknow, Uttar Pradesh, India  
**Applicable Statute:** Central Goods and Services Tax (CGST) Act, 2017 & Integrated Goods and Services Tax (IGST) Act, 2017  
**Document Purpose:** Statutory Analysis and Professional Auditor (CA) Review of Services Accounting Codes (SAC)  

---

## 1. Executive Summary

DigitalMuid operates an ed-tech and consulting platform providing three primary product lines:
1. Executive Live Training & Masterclasses
2. 1-on-1 Strategic Management & Marketing Consultations
3. Downloadable Digital Workbooks, Calculators, Campaign Planners, and Toolkits

This memorandum analyzes the classification of each offering under the Scheme of Classification of Services (Notification No. 11/2017-Central Tax (Rate)) and provides statutory documentation for formal sign-off by the company's statutory tax auditor / Chartered Accountant.

---

## 2. Product Line Mapping & Statutory SAC Analysis

### Product Line 1: Executive Live Training & Masterclasses
* **Commercial Offering:** Digital Growth Masterclass, Cohort-based digital marketing programs.
* **Service Delivery Model:** Live synchronous instruction, interactive sessions, recorded lesson repositories, and cohort community.
* **Assigned SAC:** **`999293`** — *Commercial training and coaching services*
* **Statutory Description:** This service code includes technical and commercial training, coaching centres, and professional development programs delivered online or in-person.
* **Applicable GST Rate:** **18%** (9% CGST + 9% SGST for intra-state Uttar Pradesh; 18% IGST for inter-state supply under Section 7 of the IGST Act).
* **Audit Consensus:** Strong alignment with established judicial precedent for non-degree vocational and commercial training platforms.

---

### Product Line 2: Strategic Growth Consultations
* **Commercial Offering:** 1-on-1 Business Growth Strategy Consultations with founder / senior strategists.
* **Service Delivery Model:** Dedicated video conference advisory sessions, bespoke marketing audits, business growth roadmaps.
* **Assigned SAC:** **`998311`** — *Management consulting and advisory services*
* **Statutory Description:** Advisory, guidance, and operational assistance services provided to businesses for strategy, marketing, and business planning.
* **Applicable GST Rate:** **18%** (9% CGST + 9% SGST for intra-state; 18% IGST for inter-state).
* **Audit Consensus:** Unambiguous classification under Management Consulting.

---

### Product Line 3: Digital Resources, Workbooks & Interactive Toolkits
* **Commercial Offering:** Meta Ads Campaign Planner Workbook, Ad Budget & Break-Even Calculator, Conversion Ad Copy Swipe File, Campaign Audit Checklist.
* **Service Delivery Model:** Automated instant digital delivery via secure HMAC-authenticated download links upon Razorpay payment capture.

#### Classification Analysis: SAC 998313 vs SAC 998431

There is dual-nature nuance in classifying downloadable digital assets under GST:

1. **Option A: SAC `998313` — *Information technology (IT) consulting and support services (IT software and digital tools)*:**
   - **Rationale:** The deliverables include interactive Excel/Google Sheets budgeting engines with algorithmic calculations, dynamic break-even formulas, and automated sheet models. In technological character, these function as self-contained digital software tools rather than static reading material.
   - **Precedent:** Software utilities and interactive digital calculation assets delivered electronically often fall under IT Services (SAC 998313).

2. **Option B: SAC `998431` — *On-line text based information such as books, newspapers, periodicals, directories and the like*:**
   - **Rationale:** To the extent that the Campaign Planner Workbook and Copy Swipe Files are comprehensive instructional literature, guides, and textual reference manuals, they resemble electronic publications.
   - **Precedent:** Electronic books and downloadable e-guides are classified under SAC 998431.

3. **Option C: SAC `998439` — *Other on-line content services n.e.c.*:**
   - **Rationale:** Catch-all category for digital educational and marketing assets delivered online that do not strictly fit books or customized software.

---

## 3. Financial & Tax Neutrality Guarantee

| Classification Code | Description | CGST | SGST | IGST | Effective Tax Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SAC 999293** | Commercial Training & Coaching | 9% | 9% | 18% | **18%** |
| **SAC 998311** | Management Consulting Services | 9% | 9% | 18% | **18%** |
| **SAC 998313** | IT Digital Tools & Interactive Assets | 9% | 9% | 18% | **18%** |
| **SAC 998431** | On-line Text & E-Learning Workbooks | 9% | 9% | 18% | **18%** |
| **SAC 998439** | Other On-line Content Services | 9% | 9% | 18% | **18%** |

**Tax Neutrality Assessment:**
* Regardless of whether digital workbooks and calculators are classified under SAC `998313`, `998431`, or `998439`, the **applicable tax rate remains strictly 18%**.
* There is **zero tax revenue loss**, zero under-collection risk, and zero interest or penalty exposure under Section 50 of the CGST Act.
* Input Tax Credit (ITC) eligibility for registered B2B clients remains unimpaired across all four codes.

---

## 4. Software Engine Flexibility & Recommendation

DigitalMuid's billing engine (`server/invoiceService.js`) has been engineered to support dynamic SAC code configuration:
- By default, digital interactive assets are tagged with SAC `998313`.
- The engine supports explicit item-level overrides (e.g. `raw.sacCode = "998431"` or `raw.sacCode = "998439"`) without requiring database schema changes or downtime.
- Formal recommendation: The company's Chartered Accountant should provide written confirmation on preferred tax reporting convention for monthly GSTR-1 filings.

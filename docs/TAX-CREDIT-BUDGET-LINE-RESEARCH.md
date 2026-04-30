# Canadian Screen-Based Media Tax Credits: Part A Budget Line Requirements

**Research Date:** March 2025  
**Purpose:** Identify line-level budget data StoryOS must capture to support Part A budget-based eligibility calculations for Canadian film and television tax credit programs.

**Sources:** Official government and agency documentation only (CAVCO, CRA, Ontario Creates, Creative BC, BC Ministry of Finance, SODEC, Revenu Québec).

---

## 1. Executive Summary

Part A (pre-production) applications require a **locked budget** or budget summary. Tax credit calculations are driven by **labour vs. non-labour** classification, **residency** (Canadian/Ontario/BC/Quebec), **location** (province, regional zone, GTA vs. outside GTA), **production phase** (script, principal photography, post-production), and **activity type** (e.g. DAVE: digital animation, visual effects, post-production). Assistance (grants, subsidies, forgivable loans) reduces eligible amounts in all programs.

StoryOS must extend the **BudgetLine** model to capture these dimensions at the line level so Part A eligibility estimates can be computed from the budget before actuals exist.

---

## 2. Program-by-Program Matrix

### Federal Programs

| Program | Calculation Base | Line-Level Fields Required | Special Constraints |
|---------|------------------|---------------------------|---------------------|
| **CPTC** (Canadian Film or Video Production Tax Credit) | 25% of qualified labour expenditure; labour capped at 60% of net production cost | Labour vs. non-labour; Canadian resident (citizen/PR); Services in Canada; Production phase (PCT to end of post-production) | Only labour to Canadian citizens/PRs for services in Canada qualifies. Producer/key creative remuneration excluded from Canadian expenditure tests. 75% of post-production costs must be for services in Canada. |
| **PSTC** (Film or Video Production Services Tax Credit) | 16% of qualified Canadian labour expenditure | Labour vs. non-labour; Canadian resident; Services in Canada; Production phase (final script to end of post-production) | Labour only. Non-labour component of invoices (materials, profit margin, employer deductions) excluded. Post-production: only functions listed in s.125.5(2)(b) of ITA. |

### Ontario Programs

| Program | Calculation Base | Line-Level Fields Required | Special Constraints |
|---------|------------------|---------------------------|---------------------|
| **OFTTC** (Ontario Film and Television Tax Credit) | 35% of eligible Ontario labour (45% with regional bonus) | Labour vs. non-labour; Ontario resident (at end of calendar year prior to PCT); Production phase (PCT to end); Location (GTA vs. outside GTA for regional bonus) | Labour only. Net of assistance. Regional bonus: 85%+ location days outside GTA, or 100% outside GTA. Key animation days for animation. |
| **OPSTC** (Ontario Production Services Tax Credit) | 21.5% of qualifying Ontario production expenditures | Labour vs. non-labour; Ontario labour ≥25% of QPE; Production phase | QPE capped at 4× Ontario labour. Labour portion of service contracts. |
| **OCASE** (Ontario Computer Animation and Special Effects Tax Credit) | 18% of eligible Ontario labour | Labour vs. non-labour; Ontario resident; Activity type (computer animation, VFX); Production phase | Only computer animation and VFX activities in Ontario. Remote work eligible if Ontario resident, Ontario PE. Min $25K Ontario labour per production. |

### British Columbia Programs

| Program | Calculation Base | Line-Level Fields Required | Special Constraints |
|---------|------------------|---------------------------|---------------------|
| **FIBC** (Film Incentive BC) | 40% base + 12.5% regional + 6% distant + 16% DAVE | Labour vs. non-labour; BC resident/BC-based; Location (regional/distant zone); Activity type (DAVE: digital animation, VFX, post-production) | Canadian-controlled corp only. Regional/Distant: physical office, 50%+ time in that location. DAVE: labour directly attributable to digital animation, VFX, or post-production. |
| **BC PSTC** | 36% base + 2% major + 6% regional + 6% distant + 16% DAVE | Same as FIBC | Foreign-owned eligible. Same regional/distant/DAVE rules. Animation: regional/distant restored 2025+ with key animation start date and 50% physical office rule. |

### Quebec

| Program | Calculation Base | Line-Level Fields Required | Special Constraints |
|---------|------------------|---------------------------|---------------------|
| **Quebec PSTC** (SODEC/Revenu Québec) | 25% base + 16% VFX/animation on qualified labour | Labour vs. non-labour; Quebec labour; Activity type (VFX/animation); Production phase (screenplay to post-production) | Only 65% of service contract cost eligible for VFX/animation component. Min $250K budget. |

### Alberta, Manitoba, Newfoundland and Labrador

*Note: Web search did not return sufficient official documentation for these jurisdictions within the research scope. Recommend direct consultation of provincial film agencies (e.g. Alberta Media Fund, Film Training Manitoba, Newfoundland and Labrador Film Development Corporation) for authoritative line-level requirements.*

---

## 3. Recurring Line-Level Dimensions (Consolidated)

Across all programs, the following dimensions recur:

| Dimension | Purpose | Programs Using |
|-----------|---------|----------------|
| **Labour vs. non-labour** | Only labour qualifies for most credits; some programs (Quebec PSTC) include qualified properties | All |
| **Residency** | Canadian / Ontario / BC / Quebec resident at payment time | CPTC, PSTC, OFTTC, OPSTC, OCASE, FIBC, BC PSTC, Quebec |
| **Province / location** | Where services performed; drives provincial credits and regional bonuses | OFTTC, OPSTC, OCASE, FIBC, BC PSTC, Quebec |
| **Regional zone** | GTA vs. outside GTA (ON); regional/distant location (BC) | OFTTC, FIBC, BC PSTC |
| **Production phase** | Script development, principal photography, post-production; PCT defines eligible window | CPTC, PSTC, OFTTC, OPSTC, OCASE |
| **Activity type** | DAVE (digital animation, VFX, post-production); general production | FIBC, BC PSTC, OCASE, Quebec |
| **Party / vendor / person** | Who received payment; arm's length vs. related party; loan-out corps | All (audit); OFTTC alternative means has related-party budget minimum |
| **Assistance** | Grants, subsidies, forgivable loans reduce eligible base | CPTC, PSTC, OFTTC, OPSTC, OCASE |
| **Eligible portion** | Partial eligibility (e.g. 65% of VFX contract in Quebec) | Quebec |

---

## 4. Recommended BudgetLine Data Model for StoryOS

The current `BudgetLine` model has: `description`, `quantity`, `unitCost`, `amount`, `currency`, `fringeRate`, `notes`. It links to `BudgetAccount` (which has `accountType`: ABOVE_THE_LINE, BELOW_THE_LINE_PRODUCTION, BELOW_THE_LINE_POST, OTHER).

To support Part A calculations, extend as follows:

### 4.1 New Fields on BudgetLine (or Linked Entity)

| Field | Type | Purpose |
|-------|------|---------|
| `labourAmount` | Decimal? | Portion of `amount` that is labour (for split lines). If null, infer from `isLabour` or account. |
| `isLabour` | Boolean | True if line is labour expenditure (salaries, wages, remuneration). |
| `productionPhaseId` | FK? | Link to ProductionPhase (script, prep, principal photography, post-production). |
| `activityType` | Enum? | e.g. GENERAL, DIGITAL_ANIMATION, VISUAL_EFFECTS, POST_PRODUCTION (for DAVE/OCASE). |
| `provinceCode` | String? | Province where services performed (ON, BC, AB, QC, etc.). |
| `regionalZone` | Enum? | e.g. GTA, ONTARIO_OUTSIDE_GTA, BC_REGIONAL, BC_DISTANT, BC_MAJOR_CENTRE. |
| `residencyJurisdiction` | Enum? | e.g. CANADA, ONTARIO, BC, QUEBEC (jurisdiction of resident status for credit). |
| `assistanceAmount` | Decimal? | Amount of this line that is assistance (reduces eligible base). |
| `eligiblePortion` | Decimal | 0.0–1.0; default 1.0. For partial eligibility (e.g. Quebec 65% VFX). |
| `personId` | FK? | Link to Person (for labour lines, the individual). |
| `vendorId` | FK? | Link to Vendor (for service contract lines). |
| `locationId` | FK? | Link to Location (physical place of service). |
| `isRelatedParty` | Boolean? | Arm's length vs. related party. |
| `isDAVE` | Boolean? | Shorthand: labour directly attributable to digital animation, VFX, or post-production. |

### 4.2 Alternative: BudgetLineEligibility (Separate Table)

To avoid bloating BudgetLine and to support multiple credit programs per line:

```
BudgetLineEligibility
  budgetLineId
  programCode (CPTC, PSTC, OFTTC, OPSTC, OCASE, FIBC, BC_PSTC, QUEBEC_PSTC)
  eligibleAmount
  labourAmount
  assistanceAmount
  eligiblePortion
  provinceCode
  regionalZone
  activityType
  ...
```

This allows one BudgetLine to have different eligibility annotations per program (e.g. same line may qualify for PSTC but not CPTC).

---

## 5. Field Classification

### 5.1 Mandatory for Calculation

These must be present (or inferable) for Part A calculations to run:

| Field | Reason |
|-------|--------|
| `amount` | Base dollar value (already exists). |
| `isLabour` or `labourAmount` | All programs distinguish labour from non-labour. |
| `productionPhaseId` or phase | CPTC/PSTC/OFTTC require labour within eligible window (PCT to post-production). |
| `provinceCode` | Provincial credits require province of service. |
| `residencyJurisdiction` or `personId` (with Person.residency) | Labour must be to residents of the correct jurisdiction. |

### 5.2 Optional During Data Entry

Users may leave these blank; system can infer or prompt later:

| Field | Notes |
|-------|-------|
| `activityType` / `isDAVE` | Can often be inferred from BudgetAccount (e.g. post-production account). |
| `regionalZone` | Can be inferred from `locationId` or `provinceCode` + location. |
| `assistanceAmount` | May be tracked at finance-source level rather than line level. |
| `eligiblePortion` | Default 1.0; only Quebec VFX and similar need <1. |
| `personId` / `vendorId` | Needed for audit; optional for budget estimate. |
| `isRelatedParty` | Audit/review; OFTTC alternative means uses for budget minimum. |

### 5.3 Auto-Mapped from GL but User-Editable

If StoryOS integrates with a GL or cost report:

| Field | Auto-Mapping Logic | User Override |
|-------|--------------------|---------------|
| `isLabour` | Map from account type / cost category (e.g. payroll, talent, crew vs. materials, equipment) | User can correct misclassified lines. |
| `productionPhaseId` | Map from account or department (e.g. "Post" accounts → post-production) | User can reassign. |
| `activityType` | Map from account name/code (e.g. "VFX", "Animation") | User can correct. |
| `provinceCode` | Map from vendor address, location, or default (e.g. production province) | User can override. |
| `regionalZone` | Map from location or province | User can override. |
| `residencyJurisdiction` | Map from Person.residency if personId set | User can override. |

---

## 6. Special Constraints by Program (Summary)

| Program | Key Constraint |
|---------|----------------|
| CPTC | Labour to Canadian citizens/PRs only; services in Canada; 60% cap; 75% post-production in Canada. |
| PSTC | Labour only; Canadian resident; services in Canada; post-production functions per ITA. |
| OFTTC | Ontario resident (prior calendar year); labour net of assistance; regional bonus = 85%+ days outside GTA. |
| OPSTC | Ontario labour ≥25% of QPE; QPE ≤ 4× Ontario labour. |
| OCASE | Computer animation and VFX only; Ontario labour; min $25K. |
| FIBC | BC resident/BC-based; regional/distant = 50%+ time in physical office in zone. |
| BC PSTC | Same as FIBC; foreign-owned eligible. |
| Quebec PSTC | 65% of VFX/animation service contract eligible for enhanced rate. |

---

## 7. Implementation Recommendations

1. **Phase 1 (Minimum):** Add to `BudgetLine`: `isLabour`, `productionPhaseId`, `provinceCode`, `residencyJurisdiction`. These support CPTC, PSTC, OFTTC, FIBC, BC PSTC at a basic level.

2. **Phase 2:** Add `activityType` (or `isDAVE`), `regionalZone`, `assistanceAmount`, `eligiblePortion` for OCASE, regional/distant bonuses, Quebec.

3. **Phase 3:** Add `personId`, `vendorId`, `locationId`, `isRelatedParty` for audit readiness and finer-grained calculations.

4. **Consider** a separate `BudgetLineEligibility` table if multiple programs need different annotations per line.

5. **Leverage** existing `BudgetAccount.accountType` (ABOVE_THE_LINE, BELOW_THE_LINE_PRODUCTION, BELOW_THE_LINE_POST) as a default for `productionPhaseId` mapping.

6. **Leverage** existing `ExpenseFact` pattern (labourFlag, serviceFlag, eligiblePortion, productionPhaseId, locationId, personId, vendorId) as a design reference for the budget-side eligibility layer.

---

## 8. References (Official Sources)

- [CAVCO CPTC Application Guidelines](https://www.canada.ca/en/canadian-heritage/services/funding/cavco-tax-credits/canadian-film-video-production/application-guidelines.html)
- [CRA Guide to Form T1131 (CPTC)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4164/canadian-film-video-production-tax-credit-guide-form-t1131.html)
- [CAVCO PSTC Application Guidelines](https://www.canada.ca/en/canadian-heritage/services/funding/cavco-tax-credits/film-video-production-services/application-guidelines.html)
- [Ontario Creates OFTTC Guidelines](https://www.ontariocreates.ca/tax-incentives/ofttc/ofttc-guidelines)
- [Ontario Creates OPSTC Guidelines](https://www.ontariocreates.ca/tax-incentives/opstc/opstc-guidelines)
- [Ontario Creates OCASE Guidelines](https://www.ontariocreates.ca/tax-incentives/ocase/ocase-guidelines)
- [Creative BC FIBC](https://creativebc.com/motion-picture-tax-credits/film-incentive-bc/)
- [BC Production Services Tax Credit](https://www2.gov.bc.ca/gov/content/taxes/income-taxes/corporate/credits/production-services)
- [SODEC Quebec PSTC](https://sodec.gouv.qc.ca/english/credit-film-production-services/)
- [Revenu Québec Film Production Services](https://www.revenuquebec.ca/en/online-services/forms-and-publications/current-details/co-1029-8-36-sp-t/)

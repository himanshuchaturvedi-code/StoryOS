# BudgetLine Redesign: Architectural Critique

**Date:** March 2025  
**Purpose:** Investigate and critique the proposed BudgetLine model before implementation. No code changes—analysis only.

---

## 1. Proposed Design Summary

| Field | Purpose |
|-------|---------|
| accountId | BudgetAccount (GL account) |
| description | Line description |
| amount | Dollar value |
| labourAmount | Optional; if null, inferred from account mapping |
| personId | Optional; party when individual |
| vendorId | Optional; party when corporation/vendor |
| expenseType | Labour classification; defaults from GL, user-editable |
| locationId | Where services performed |
| phaseId | Production phase (script, principal photography, post-production) |
| notes | Free text |

**Constraints:**
- Exactly one of personId or vendorId must be present
- Multiple BudgetLines per GL account allowed
- Residency NOT on BudgetLine—derived from Person/Vendor
- Program-specific rules (e.g. Quebec 65% VFX) in calculators, not schema

---

## 2. Answers to Analysis Questions

### Q1. Is this BudgetLine structure sufficient for Canadian tax credit calculations?

**Mostly yes, with gaps.**

**Sufficient:**
- `labourAmount` + account fallback supports labour vs. non-labour (all programs)
- `personId`/`vendorId` → residency via Person/Vendor (CPTC, PSTC, OFTTC, FIBC, BC PSTC, Quebec)
- `locationId` → province, regional zone via Location (provincial credits, regional bonuses)
- `phaseId` → production phase (PCT window, post-production rules)

**Gaps:**
1. **Activity type (DAVE/OCASE):** FIBC, BC PSTC, OCASE, and Quebec require distinguishing digital animation, VFX, and post-production from general production. The proposal has no `activityType` or equivalent. This can be inferred from `BudgetAccount` (e.g. account code/name) or `phaseId` (e.g. VFX phase), but that inference is fragile. **Recommendation:** Add `activityType` enum (GENERAL, DIGITAL_ANIMATION, VISUAL_EFFECTS, POST_PRODUCTION) or allow calculators to infer from account + phase. If inference is reliable, omit; otherwise add.

2. **Assistance:** All programs reduce eligible base by assistance (grants, subsidies, forgivable loans). The proposal does not capture assistance at the line level. Assistance is often tracked at `FinanceSource` level. If a grant is tied to specific line items, line-level `assistanceAmount` may be needed. **Recommendation:** Document that assistance is handled at finance-source level; add `assistanceAmount` on BudgetLine only if line-specific grants are required.

3. **Related party:** OFTTC alternative-means has a higher budget minimum when the production is made available under an agreement with a related party. `Vendor.isRelatedParty` is in the supporting data; the proposal does not require it on BudgetLine. Since it comes from Vendor, that is acceptable—as long as Vendor has `isRelatedParty`.

---

### Q2. Are any critical fields missing for Part A eligibility?

| Dimension | Proposed | Status |
|-----------|----------|--------|
| Labour vs. non-labour | labourAmount, expenseType, account fallback | ✓ |
| Residency | Via Person/Vendor | ✓ |
| Work location (province, zone) | locationId → Location | ✓ |
| Production phase | phaseId | ✓ |
| Activity type (DAVE) | Not present | ⚠️ See Q1 |
| Party (who is paid) | personId or vendorId | ✓ |
| Assistance | Not present | ⚠️ May be finance-source only |
| Currency | Not in proposal | ⚠️ See below |

**Currency:** Current BudgetLine has `currency` (default CAD). Multi-currency productions need it for conversion. **Recommendation:** Retain `currency` unless all budgets are single-currency.

**quantity / unitCost:** Current schema has these for formula-driven lines (amount = quantity × unitCost). The proposal omits them. If StoryOS needs to support rate × days or similar, keep them. **Recommendation:** Retain as optional for formula support.

---

### Q3. Are any fields misplaced (should live on another entity)?

| Field | Proposed Location | Alternative | Recommendation |
|-------|--------------------|-------------|----------------|
| Residency | Person / Vendor | BudgetLine | ✓ Correct—residency is a property of the party |
| Regional zone | Location | BudgetLine | ✓ Correct—Location.zoneCode / regionalZone |
| Production phase | BudgetLine.phaseId | BudgetAccount | Phase can default from account (e.g. BELOW_THE_LINE_POST → post-production) but line-level override is needed when one account spans phases (e.g. "Director" across prep + shoot) |
| Activity type | Not in proposal | BudgetAccount or BudgetLine | If inferable from account, keep on account; otherwise add to BudgetLine for override |
| isRelatedParty | Vendor | BudgetLine | ✓ Correct—Vendor.isRelatedParty |

**Phase resolution:** `phaseId` references `ProductionPhase`, which is project-scoped. BudgetLine → BudgetVersion → Budget → Project. Ensure `phaseId` is validated to reference a ProductionPhase for the same project. This is an application-level constraint (Prisma cannot enforce it via FK alone).

---

### Q4. Does this design conflict with the existing StoryOS schema?

**Compatibility check:**

| Existing | Proposed | Conflict? |
|----------|----------|-----------|
| BudgetLine.budgetAccountId | accountId | Rename only—use budgetAccountId for consistency |
| BudgetLine.budgetVersionId | Not mentioned | Must remain—BudgetLine is version-scoped |
| BudgetLine.quantity, unitCost | Dropped | See Q2—consider retaining |
| BudgetLine.currency | Dropped | Retain |
| BudgetLine.fringeRate | Dropped | Research doc references Phase 5; retain if calculators use it |
| ExpenseFact (ActualLine) | N/A | ExpenseFact has personId, vendorId, locationId, productionPhaseId, labourFlag, serviceFlag, eligiblePortion. Proposed BudgetLine mirrors this—good alignment. ExpenseFact has no XOR on person/vendor; both optional |
| Person | residencyCountry, residencyProvince | Person has address (country, provinceState) and ParticipantResidencyStatus (temporal). No explicit residencyCountry/residencyProvince. ParticipantResidencyStatus has country, provinceState, effectiveFrom, effectiveTo |
| Vendor | province, country, isRelatedParty | Vendor has country, provinceState, city, isCanadianOwned. **Missing: isRelatedParty** |
| Location | province, regionalZone, city | Location has provinceState, zoneCode, city. **zoneCode exists; "regionalZone" may map to zoneCode or need a new field** |

**Conflicts / gaps:**

1. **Person residency:** Residency is in `ParticipantResidencyStatus` (project-scoped, temporal), not on Person. Calculators must resolve residency as-of the service date for the project. No schema change needed if the design assumes "residency from Person/Vendor" means "from ParticipantResidencyStatus for Person" and "from Vendor.country/provinceState for Vendor."

2. **Vendor.isRelatedParty:** Not in schema. **Add to Vendor** if OFTTC alternative-means or other programs need it.

3. **Location.regionalZone:** Schema has `zoneCode` (string). Ontario uses GTA vs. outside GTA; BC uses regional/distant. These are province-specific. Options: (a) use zoneCode with a convention (e.g. "ON-GTA", "BC-REGIONAL"), or (b) add regionalZone enum. **Recommendation:** Define zoneCode semantics per province; add regionalZone only if zoneCode is insufficient.

4. **personId XOR vendorId:** Proposal says "exactly one must be present." ExpenseFact allows both null. Some budget lines (contingency, reserves, rounding) may have no party. **Recommendation:** Relax to "at most one of personId or vendorId" (mutually exclusive when present). Allow both null for aggregate/placeholder lines, with a warning in UI when both are null and the line is used in eligibility calculations.

---

### Q5. What schema migration strategy would be safest?

**Recommended approach: additive migration with deprecation**

1. **Phase 1—Add new fields (non-breaking):**
   - Add `labourAmount`, `personId`, `vendorId`, `locationId`, `productionPhaseId`, `expenseType` (enum) as nullable.
   - Add FKs and indexes.
   - Keep existing `quantity`, `unitCost`, `currency`, `fringeRate`.

2. **Phase 2—Backfill:**
   - Default `expenseType` from BudgetAccount.accountType (e.g. BELOW_THE_LINE_PRODUCTION → LABOUR).
   - Default `productionPhaseId` from account where possible.
   - No backfill for personId, vendorId, locationId—require user input or leave null.

3. **Phase 3—Enforce constraints (optional):**
   - Add DB check or app validation: `(personId IS NULL) <> (vendorId IS NULL)` if you adopt XOR.
   - Or: allow both null but validate when line is used for eligibility.

4. **Phase 4—Deprecate (if desired):**
   - Mark `quantity`, `unitCost` as deprecated if no longer used.
   - Do not drop until all consumers are updated.

**Avoid:**
- Dropping columns in the same migration as adding new ones.
- Making new fields non-nullable before backfill.
- Changing FK targets (e.g. accountId) in a way that breaks existing data.

**Data migration:** Existing BudgetLines have no personId, vendorId, locationId, phaseId. Post-migration they will be null. Part A calculations will need to handle "incomplete" lines (e.g. exclude, or use account-based inference).

---

### Q6. What UI implications should we address before implementation?

1. **Inline editing:** The current budget UI has inline Description and Amount per leaf account. The redesign implies multiple rows per account, each with party, location, phase. The UI must support:
   - Adding multiple lines per account
   - Selecting Person or Vendor (mutually exclusive)
   - Selecting Location
   - Selecting Production Phase
   - Optionally editing labourAmount, expenseType

2. **Party selector:** Person vs. Vendor is a choice. UI needs:
   - Toggle or dropdown: "Individual" vs. "Vendor"
   - Person picker (search by name) when Individual
   - Vendor picker when Vendor
   - Clear indication that residency comes from the selected party

3. **Location selector:** Location picker filtered by project (ProjectLocation) or organization. Display province and zone for quick verification.

4. **Phase selector:** Dropdown of ProductionPhases for the project. Ensure phases exist before budget entry.

5. **labourAmount:** If amount is 100% labour, labourAmount can default to amount. For split lines (e.g. equipment rental with labour component), allow override. Consider: when labourAmount is null, show "Inferred from account" and allow override.

6. **Validation feedback:** When personId and vendorId are both null, show a warning if the line is in an account used for labour-based credits. When locationId or phaseId is null, show similar warnings for affected programs.

7. **Bulk operations:** For many lines (e.g. 800+ accounts), bulk set phase from account, or bulk set location from a default. Avoid requiring manual entry for every line.

8. **Templates:** Budget templates (Telefilm, etc.) define accounts but not line-level party/location/phase. New lines created from templates will need these fields filled in. Consider template-level defaults (e.g. default phase per account type).

---

## 3. Refined Design Recommendations

### 3.1 Field Additions (beyond proposal)

| Field | Recommendation |
|-------|----------------|
| activityType | Add if DAVE/OCASE inference from account is unreliable. Enum: GENERAL, DIGITAL_ANIMATION, VISUAL_EFFECTS, POST_PRODUCTION. Optional, default from account. |
| currency | Retain (existing) |
| quantity, unitCost | Retain as optional (existing) |
| fringeRate | Retain if Phase 5 calculators use it (existing) |

### 3.2 Constraint Refinements

| Constraint | Recommendation |
|------------|----------------|
| personId XOR vendorId | Use "at most one" (mutually exclusive when present). Allow both null for contingency/aggregate lines. Add validation warning when both null and line is labour-eligible. |
| locationId | Required when personId or vendorId is set and line is used for location-dependent credits. Optional otherwise. |
| phaseId | Optional with account-based default. User can override. |

### 3.3 Supporting Entity Changes

| Entity | Change |
|--------|--------|
| Vendor | Add `isRelatedParty Boolean?` for OFTTC alternative-means and audit |
| Location | Clarify zoneCode semantics; add regionalZone if zoneCode is insufficient |
| Person | No change; use ParticipantResidencyStatus for temporal residency |

### 3.4 expenseType Definition

The proposal leaves `expenseType` undefined. **Recommendation:** Define as enum, e.g.:

- `LABOUR` — salaries, wages, remuneration to individuals or labour portion of vendor invoices
- `NON_LABOUR` — materials, equipment, rights, other
- `MIXED` — line has both; use labourAmount for labour portion

Default from BudgetAccount: ABOVE_THE_LINE, BELOW_THE_LINE_PRODUCTION, BELOW_THE_LINE_POST → typically LABOUR; OTHER → infer from account name or default NON_LABOUR.

---

## 4. Summary

| Aspect | Verdict |
|--------|---------|
| Sufficiency for Part A | Mostly sufficient; add activityType if DAVE/OCASE inference is weak |
| Critical missing fields | activityType (conditional), currency (retain), assistance (finance-source or line-level TBD) |
| Misplaced fields | None identified |
| Schema conflicts | Vendor needs isRelatedParty; Location zoneCode vs regionalZone; relax personId/vendorId to "at most one" |
| Migration strategy | Additive, backfill, then optional constraints |
| UI implications | Multi-line per account, party/location/phase selectors, validation warnings, bulk operations |

**Overall:** The proposed design aligns well with tax credit requirements and the ExpenseFact pattern. The main refinements are: (1) clarify expenseType, (2) add activityType if needed, (3) add Vendor.isRelatedParty, (4) relax personId/vendorId to allow both null for edge cases, and (5) retain currency, quantity, unitCost, fringeRate unless explicitly deprecated.

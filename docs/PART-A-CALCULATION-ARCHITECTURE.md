# Part A Calculation Architecture

**Date:** March 2025
**Revised:** March 2025 — added §12 (service contract classification, evaluation source resolution, locked budget annotation)
**Status:** Design — not yet implemented
**Depends on:** BudgetLine redesign (see BUDGETLINE-REDESIGN-CRITIQUE.md)

---

## 1. Problem Statement

StoryOS calculates tax credit eligibility from **actuals** using the ExpenseFact → ActualLine → ActivityDay pipeline. Part A (pre-production) applications require eligibility estimates from **budget data** before actuals exist. The system must support budget-based calculations that are structurally parallel to actual-based calculations, without duplicating calculator logic.

### Current Architecture (Part B / Actuals)

```
ProgramSubmission
  └─ evaluationDate, budgetVersionId
  └─ ProgramRequirement[]
       └─ Calculator.evaluate(input, prisma, context)
            └─ CalculatorContext
                 ├─ getExpenseFacts()     → ExpenseFact + ActualLine
                 ├─ getActivityDays()     → ActivityDay + Location + Person
                 ├─ getResidencyAsOf()    → ParticipantResidencyStatus
                 ├─ getVendorEligibilityAsOf()
                 ├─ getBudgetLines()      → BudgetLine + BudgetAccount  ← unused by calculators
                 └─ ...
```

**The gap:** `getBudgetLines()` returns raw financial data (amount, description). No calculator consumes it for eligibility logic. The expenditure-based calculators (`LabourExpenditureCalculator`, `ExpenditureThresholdCalculator`) operate exclusively on `ExpenseFact`.

---

## 2. Core Architectural Decision: The SpendRecord Abstraction

### Decision

Introduce a **`SpendRecord`** interface — a source-agnostic representation of an eligible spend line. Both ExpenseFact (actuals) and enriched BudgetLine (budget) project into this common shape. Calculators operate on `SpendRecord[]` instead of `ExpenseFact[]`.

### Why not a database table (BudgetLineFact)?

For actuals, the split between ActualLine (financial) and ExpenseFact (eligibility annotation) exists because ActualLine is imported from external systems (GL, accounts payable) that don't carry eligibility metadata. The annotation is a separate editorial step.

For budgets, the user enters both financial and eligibility data within StoryOS itself. There is no external import boundary. Putting both on BudgetLine is appropriate — the annotation fields *are* part of the budget line definition. A separate BudgetLineFact table would:
- Double the write surface for every budget edit
- Create sync hazards (BudgetLine changes, BudgetLineFact stale)
- Add joins to every read path
- Not provide meaningful normalization benefit (it's still 1:1)

The correct abstraction is at the **read layer** (runtime projection), not the **storage layer** (separate table).

### SpendRecord Shape

```
SpendRecord {
  sourceId:            string          // BudgetLine.id or ExpenseFact.id
  sourceType:          'BUDGET' | 'ACTUAL'
  amount:              Decimal         // Total line amount
  labourAmount:        Decimal | null  // Explicit labour portion (MIXED lines)
  isLabour:            boolean         // Resolved: true if labour expenditure
  isService:           boolean         // From stored isServiceContract flag (see §12.1)
  eligiblePortion:     Decimal         // Default 1.0; set by projection for actuals
  effectivePersonId:   string | null   // Person for residency tests (see §4 loan-out)
  vendorId:            string | null   // Vendor for vendor eligibility tests
  locationId:          string | null   // Where services performed
  productionPhaseId:   string | null   // When in production lifecycle
  budgetAccountId:     string | null   // GL account reference
  activityType:        string | null   // GENERAL | DIGITAL_ANIMATION | VISUAL_EFFECTS | POST_PRODUCTION
  account: {                           // Eagerly loaded
    code:        string
    name:        string
    accountType: string | null
  }
  location: {                          // Eagerly loaded
    country:       string
    provinceState: string | null
    zoneCode:      string | null
  } | null
}
```

### Projection Rules

**From BudgetLine (Part A):**

| SpendRecord field | Source |
|---|---|
| amount | budgetLine.amount |
| labourAmount | budgetLine.labourAmount |
| isLabour | Resolve from expenseType: LABOUR→true, NON_LABOUR→false, MIXED→true, null→infer from account |
| isService | budgetLine.isServiceContract ?? false |
| eligiblePortion | 1.0 (program-specific reductions applied by calculator, not stored on BudgetLine) |
| effectivePersonId | budgetLine.personId ?? vendor.principalPersonId ?? null |
| vendorId | budgetLine.vendorId |
| locationId | budgetLine.locationId |
| productionPhaseId | budgetLine.productionPhaseId |
| activityType | budgetLine.activityType ?? infer from account code/phase |
| account | eagerly loaded from budgetAccountId |
| location | eagerly loaded from locationId |

**From ExpenseFact + ActualLine (Part B):**

| SpendRecord field | Source |
|---|---|
| amount | actualLine.amount |
| labourAmount | null (not tracked separately on actuals) |
| isLabour | expenseFact.labourFlag |
| isService | expenseFact.serviceFlag |
| eligiblePortion | expenseFact.eligiblePortion |
| effectivePersonId | expenseFact.personId ?? vendor.principalPersonId ?? null |
| vendorId | expenseFact.vendorId |
| locationId | expenseFact.locationId |
| productionPhaseId | expenseFact.productionPhaseId |
| activityType | null (inferred by calculator from account/phase) |
| account | eagerly loaded from budgetAccountId |
| location | eagerly loaded from locationId |

---

## 3. CalculatorContext Changes

### Evaluation Source Resolution (see also §12.2)

The evaluation source (BUDGET vs. ACTUAL) is resolved **once** per evaluation run by `EvaluationService`, not per-method-call inside CalculatorContext. The resolved mode is set on `CalculatorInput` and is immutable for the lifetime of the context.

```
CalculatorInput {
  ...existing fields...
  + evaluationSource: 'BUDGET' | 'ACTUAL'   // resolved by EvaluationService
}
```

Resolution logic lives in `EvaluationService.resolveEvaluationSource()`:

```
resolveEvaluationSource(submission):
  if submission.budgetVersionId IS NOT NULL → 'BUDGET'
  else → 'ACTUAL'
```

Phase 2 will add explicit `evaluationSource` on ProgramSubmission and a 'BLENDED' option (see §7 and §12.2).

### New Method: `getSpendRecords()`

Replaces per-source methods for expenditure-based calculators. Reads `this.input.evaluationSource` to determine data path — no mode inference at this layer.

```
async getSpendRecords(filters?): SpendRecord[]
```

**BUDGET mode:**
1. Load all BudgetLines for budgetVersionId with includes: { account, location, vendor: { include: { principalPerson: true } } }
2. Project each BudgetLine into SpendRecord (loan-out resolution via vendor.principalPersonId)
3. Apply filters (isLabour, isService, accountTypes, etc.)

**ACTUAL mode:**
1. Load all ExpenseFacts for project with includes: { actualLine, vendor: { include: { principalPerson: true } }, location }
2. Project each ExpenseFact into SpendRecord
3. Apply filters

### New Method: `getResidencyBatch()`

The current `getResidencyAsOf(personId)` fires one query per person — an N+1 problem that becomes severe for budgets with hundreds of labour lines. Add a batch method:

```
async getResidencyBatch(personIds: string[]): Map<string, ParticipantResidencyStatus>

  1. Query ParticipantResidencyStatus WHERE personId IN (...) with asOf(evaluationDate)
  2. Return Map keyed by personId
  3. Cache the map for the evaluation run
```

Existing `getResidencyAsOf()` delegates to the batch cache after first call.

### Updated Method: `getBudgetLines()`

Enhanced to include all new relations:

```
async getBudgetLines():
  include: {
    account: true,
    person: true,
    vendor: { include: { principalPerson: true } },
    location: true,
    productionPhase: true,
  }
```

This is used internally by `getSpendRecords()` in BUDGET mode. Direct access remains available for budget-specific calculators that need raw data.

---

## 4. Loan-Out Corporation Handling

### The Problem

Above-the-line talent commonly provides services through personal service corporations (loan-outs). The production pays the corporation, but tax credit residency tests apply to the individual behind it. CPTC: labour paid "to or on behalf of" a Canadian resident qualifies.

### Schema Design

Add to Vendor:

```
Vendor
  + principalPersonId  FK? → Person   // The individual behind a loan-out corporation
  + isRelatedParty     Boolean?        // Arm's length vs. related party
```

`principalPersonId` is null for regular vendors (equipment rental, catering, etc.) and set only for loan-out/personal service corporations where the individual providing services is known.

### Resolution Logic (in SpendRecord projection)

```
effectivePersonId =
  budgetLine.personId            // Direct person reference (individual payment)
  ?? vendor?.principalPersonId   // Loan-out: resolve through vendor
  ?? null                        // Regular vendor or no party assigned
```

### Calculator Impact

Calculators that resolve residency (LabourExpenditureCalculator, ResidencyTestCalculator) use `effectivePersonId` from SpendRecord. They do not need to know whether the person was referenced directly or resolved through a loan-out. The projection handles the indirection.

For vendor eligibility tests (VendorEligibilityCalculator), `vendorId` is still used directly — the loan-out corporation itself may need to be eligible (e.g., BC-based for FIBC).

---

## 5. Workflow Design: Budget Entry → Annotation → Calculation

### Principle: Three Separate Workflows, Three Separate Concerns

| Workflow | Who | When | What changes |
|---|---|---|---|
| **Budget Entry** | Production accountant | Pre-production start | Financial fields: description, amount, quantity, unitCost, currency, fringeRate |
| **Eligibility Annotation** | Production accountant or coordinator | Before Part A application | Eligibility fields: personId/vendorId, locationId, productionPhaseId, expenseType, activityType, labourAmount |
| **Part A Calculation** | System (triggered by user) | When annotation is sufficiently complete | Read-only evaluation producing RequirementAssessment results |

These should never be collapsed into a single UI. A production accountant building a budget is solving a financial planning problem. Eligibility annotation is a compliance/tax problem, often done weeks later.

### Workflow 1: Budget Entry (existing, unchanged)

The current inline editing UI remains as-is:
- Hierarchical account tree with collapsible sections
- Leaf accounts have inline Description + Amount
- Save on blur
- Dynamic totals roll up

No new fields are exposed during budget entry. The new nullable columns (personId, vendorId, locationId, etc.) remain null. This preserves the existing workflow for all users who don't need tax credit calculations.

### Workflow 2: Eligibility Annotation (new)

A separate view, accessed from the budget version:

**Entry point:** Budget → Version → "Eligibility" tab (or sidebar mode)

**Layout:** Same account tree structure, but each line shows:
- Description, Amount (read-only in this view)
- Party: [Individual ▾] / [Vendor ▾] — mutually exclusive toggle
- Location: [Select location ▾] — filtered to ProjectLocations
- Phase: [Select phase ▾] — from project's ProductionPhases
- Expense type: [Labour ▾] / [Non-labour] / [Mixed] — defaults from account
- Activity type: [General ▾] / [DAVE] / [VFX] / [Post-production] — defaults from account/phase
- Service contract: [Yes / No] — defaults from VendorType heuristic (see §12.1)
- Labour amount: (visible only when expense type = MIXED)

**Smart defaults (applied on first open):**
- expenseType: inferred from account code patterns (not accountType — the accountType granularity is too coarse; see critique document)
- activityType: inferred from account code + phase (e.g., account containing "VFX" → VISUAL_EFFECTS)
- productionPhaseId: inferred from account hierarchy (e.g., accounts under "Post-Production" section)
- locationId: default to project's primary location (from ProjectLocation.isPrimary)

**Bulk operations (critical for usability):**
- "Set all lines in this account to [Phase: Post-Production]"
- "Set all lines to [Location: Toronto Studio]"
- "Mark all lines in section as [Expense type: Labour]"

**Completeness tracking:**
- Per-program annotation completeness score
- Example: "CPTC ready: 72% of lines annotated | OFTTC ready: 65%"
- The score = (lines with required fields populated for that program) / (total lines with amount > 0)
- Required fields vary by program:
  - CPTC: personId or vendorId, locationId, expenseType → isLabour resolution
  - OFTTC: same + productionPhaseId, locationId with Ontario province
  - FIBC DAVE: same + activityType for DAVE-eligible accounts
- Lines with both personId and vendorId null are flagged as "party unassigned" but not blocked (pooled labour is legitimate)

### Workflow 3: Part A Calculation (new)

**Entry point:** Budget → Version → "Part A Estimate" tab, or from a ProgramSubmission in DRAFT status

**Preconditions check:**
1. BudgetVersion must be LOCKED (Part A applications use locked budgets). Financial fields are immutable; annotation fields remain editable (see §12.3).
2. At least one ProjectProgram must be enrolled with ACTIVE status
3. Annotation completeness for the target program should be above a configurable threshold (e.g., 80%)

**Execution flow:**
1. User selects programs to evaluate (from active ProjectPrograms)
2. System shows annotation completeness per program; warns below threshold
3. User clicks "Run Estimate"
4. EvaluationService runs all calculators for each program using CalculatorContext in BUDGET mode
5. Results stored in RequirementAssessment (same as Part B — no separate storage)

**Results display:**
- Per-program summary: total eligible spend, estimated credit amount, pass/fail per requirement
- Drill-down by requirement: which lines contributed, which were excluded, why
- Line-level detail in computedValue JSON: per-line eligibility breakdown

**Estimate vs. final:** Part A results should be clearly labeled as "estimates." Budget data is inherently approximate. The UI should distinguish Part A estimates from Part B final calculations.

---

## 6. Required Schema Changes

### 6.1 BudgetLine Additions

```
model BudgetLine {
  // existing fields retained
  id              String   @id @default(uuid())
  budgetVersionId String
  budgetAccountId String
  organizationId  String
  description     String?
  quantity        Decimal? @db.Decimal(14, 4)
  unitCost        Decimal? @db.Decimal(14, 4)
  amount          Decimal  @db.Decimal(14, 2)
  currency        String   @default("CAD")
  fringeRate      Decimal? @db.Decimal(5, 4)
  notes           String?

  // new eligibility annotation fields
  personId          String?
  vendorId          String?
  locationId        String?
  productionPhaseId String?
  labourAmount      Decimal?          @db.Decimal(14, 2)
  expenseType       ExpenseType?
  activityType      ActivityType?
  isServiceContract Boolean?
  sortOrder         Int               @default(0)

  // relations
  version         BudgetVersion   @relation(...)
  account         BudgetAccount   @relation(...)
  person          Person?         @relation(...)
  vendor          Vendor?         @relation(...)
  location        Location?       @relation(...)
  productionPhase ProductionPhase? @relation(...)
}
```

### 6.2 New Enums

```
enum ExpenseType {
  LABOUR
  NON_LABOUR
  MIXED
}

enum ActivityType {
  GENERAL
  DIGITAL_ANIMATION
  VISUAL_EFFECTS
  POST_PRODUCTION
}
```

### 6.3 Vendor Additions

```
model Vendor {
  // existing fields...

  + principalPersonId  String?       // Loan-out: the individual behind the corp
  + isRelatedParty     Boolean?      // Arm's length vs. related party

  + principalPerson    Person?  @relation("VendorPrincipal", fields: [principalPersonId], references: [id])
}
```

### 6.4 Constraints

**Database-level CHECK constraints** (applied via raw SQL migration):

```sql
-- At most one of personId / vendorId
ALTER TABLE budget_lines
  ADD CONSTRAINT chk_party_exclusive
  CHECK (NOT (person_id IS NOT NULL AND vendor_id IS NOT NULL));

-- labourAmount required when expenseType = MIXED
ALTER TABLE budget_lines
  ADD CONSTRAINT chk_labour_amount_for_mixed
  CHECK (expense_type != 'MIXED' OR labour_amount IS NOT NULL);

-- labourAmount cannot exceed amount
ALTER TABLE budget_lines
  ADD CONSTRAINT chk_labour_amount_ceiling
  CHECK (labour_amount IS NULL OR labour_amount <= amount);
```

### 6.5 Indexes

```sql
-- Support Part A calculator queries
CREATE INDEX idx_budget_lines_version_expense
  ON budget_lines (budget_version_id, expense_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_budget_lines_person
  ON budget_lines (person_id)
  WHERE person_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_budget_lines_vendor
  ON budget_lines (vendor_id)
  WHERE vendor_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_budget_lines_location
  ON budget_lines (location_id)
  WHERE location_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_budget_lines_phase
  ON budget_lines (production_phase_id)
  WHERE production_phase_id IS NOT NULL AND deleted_at IS NULL;
```

### 6.6 Inverse Relations

Add BudgetLine[] to Person, Vendor, Location, ProductionPhase:

```
model Person {
  + budgetLines  BudgetLine[]
}

model Vendor {
  + budgetLines  BudgetLine[]
}

model Location {
  + budgetLines  BudgetLine[]
}

model ProductionPhase {
  + budgetLines  BudgetLine[]
}
```

---

## 7. Part A → Part B Transition

### Lifecycle Phases

| Phase | Data available | Calculation source | Use case |
|---|---|---|---|
| **Part A only** | Budget lines (annotated) | BudgetLine via SpendRecord | Pre-production application, financing |
| **Transition** | Budget + partial actuals | Blended (see below) | Mid-production interim reporting |
| **Part B only** | Complete actuals | ExpenseFact via SpendRecord | Final application, audit |

### How Transition Works

The trigger is **not a manual switch.** The system detects the available data and adapts:

```
getSpendRecords() mode resolution:

  actualsExist  = COUNT(ExpenseFact WHERE projectId = X) > 0
  budgetExists  = budgetVersionId IS NOT NULL

  if budgetExists AND NOT actualsExist → BUDGET mode (Part A)
  if NOT budgetExists AND actualsExist → ACTUAL mode (Part B)
  if budgetExists AND actualsExist     → depends on caller intent (see below)
```

### The Blended Mode Question

During production, both budget and actuals co-exist. Calculators should NOT blindly combine both — that double-counts. Three options:

**Option A: Actuals-only once any actuals exist**
- Simplest. Once a single ActualLine appears, all calculations use actuals.
- Problem: incomplete actuals produce worse estimates than the budget.

**Option B: Per-account blending**
- For accounts WITH actuals → use ExpenseFact (actual amounts)
- For accounts WITHOUT actuals → use BudgetLine (estimate amounts)
- More accurate during transition, but complex to implement.

**Option C: Explicit mode selection**
- User chooses "Evaluate from budget" or "Evaluate from actuals" per submission.
- Clear, auditable, no implicit behavior.

### Recommendation: Option C with Option B as Phase 2

**Phase 1:** `CalculatorInput` gets a new field: `evaluationSource: 'BUDGET' | 'ACTUAL'`. The user (or the submission configuration) specifies which source to use. ProgramSubmission already has `budgetVersionId` — if set, the submission uses budget data.

**Phase 2 (future):** Add `evaluationSource: 'BLENDED'` that implements per-account blending. This requires tracking which BudgetAccounts have associated ActualLines and merging the two SpendRecord sets with deduplication by account.

### ProgramSubmission Changes

ProgramSubmission already carries:
- `budgetVersionId String?` — which budget version to use (Part A)
- `evaluationDate DateTime` — as-of date for temporal lookups

No new fields are needed for Phase 1. The presence of `budgetVersionId` implies budget-based evaluation. If `budgetVersionId` is null, the system uses actuals.

For Phase 2 blended mode, add:
```
model ProgramSubmission {
  + evaluationSource  EvaluationSource?  // BUDGET | ACTUAL | BLENDED
}
```

### What Happens to Part A Results After Actuals Arrive?

Part A assessments (RequirementAssessment rows) are **not deleted or overwritten.** They remain as historical records of the estimate. When a new Part B submission is created and evaluated, it produces its own RequirementAssessment rows. The two submissions coexist under the same ProjectProgram.

The UI can show the comparison:
- "Part A Estimate (Budget v3, Jan 2025): $2.1M eligible labour"
- "Part B Final (Actuals, Dec 2025): $1.8M eligible labour"

---

## 8. Calculator Refactoring Strategy

### Which Calculators Need Changes?

| Calculator | Current data source | Needs SpendRecord? | Notes |
|---|---|---|---|
| LabourExpenditureCalculator | ExpenseFact (labourFlag) | **Yes** | Core Part A calculator: sums qualifying labour |
| ExpenditureThresholdCalculator | ExpenseFact (labourFlag, serviceFlag, accountTypes) | **Yes** | Tests min/max expenditure thresholds |
| RegionalSpendCalculator | ActivityDay (location days) | **No** | Day-based; budget has no day-level data. Part A can only estimate from BudgetLine locationId. Consider a budget-specific regional spend estimator in Phase 2. |
| ResidencyTestCalculator | ProjectParticipant (person + roles) | **No** | Tests key creative / participant residency, not spend. Works the same for Part A and Part B. |
| KeyCreativeCalculator | ProjectParticipant (roles + residency) | **No** | Point-based test. No dependency on spend data. |
| CanadianControlCalculator | CorporateOwnership, ProjectOwnership | **No** | Structural test. No dependency on spend data. |
| ActivityDayMinimumCalculator | ActivityDay | **No** | Day-based. Not available from budget data. |
| RightsControlCalculator | RightsControlFact | **No** | Structural test. |
| DocumentationCalculator | Document | **No** | Document check. |
| FormatEligibilityCalculator | ProjectFormat | **No** | Format test. |
| VendorEligibilityCalculator | VendorEligibility | **No** | Vendor status check. |
| CustomCalculator | Manual | **No** | Manual assessment. |

**Only 2 of 12 calculators need SpendRecord refactoring.** The rest operate on structural/participant data that exists independently of budget vs. actual.

### Refactoring Approach

1. Add `getSpendRecords()` and `getResidencyBatch()` to CalculatorContext.
2. Refactor `LabourExpenditureCalculator` to use `getSpendRecords({ isLabour: true })` instead of `getExpenseFacts({ labourFlag: true })`. Use `effectivePersonId` for residency resolution via `getResidencyBatch()`.
3. Refactor `ExpenditureThresholdCalculator` to use `getSpendRecords()` with appropriate filters.
4. Keep `getExpenseFacts()` and `getActivityDays()` available for calculators that don't need the abstraction.
5. For `RegionalSpendCalculator`: Part A cannot provide day-level data from a budget. Two options:
   - Skip regional spend assessment for Part A (mark NOT_EVALUATED)
   - Add a budget-specific heuristic: if ≥ N% of budget lines by amount have locationId in qualifying zone, estimate regional eligibility. This is inherently approximate and should be labeled as such.

### Calculator Output Enhancement

For Part A, calculators should include source metadata in `computedValue`:

```json
{
  "evaluationSource": "BUDGET",
  "budgetVersionId": "...",
  "totalLabour": "850000.00",
  "qualifyingLabour": "720000.00",
  "ratio": "0.8471",
  "lineBreakdown": [
    { "budgetLineId": "...", "accountCode": "B01", "amount": "120000.00", "eligible": true, "reason": "Canadian resident" },
    { "budgetLineId": "...", "accountCode": "B02", "amount": "80000.00", "eligible": false, "reason": "No person assigned" }
  ],
  "warnings": [
    "47 lines have no party assigned — excluded from qualifying labour",
    "12 lines have no location — province-based eligibility not evaluated"
  ]
}
```

The `warnings` array surfaces annotation gaps to the user through the assessment results UI. This closes the feedback loop between Workflow 2 (annotation) and Workflow 3 (calculation).

---

## 9. Migration Plan

### Phase 1: Schema (non-breaking)

1. Add nullable columns to BudgetLine: personId, vendorId, locationId, productionPhaseId, labourAmount, expenseType, activityType, sortOrder
2. Add FK constraints and partial indexes
3. Add principalPersonId, isRelatedParty to Vendor
4. Add ExpenseType, ActivityType enums
5. Add inverse relations (BudgetLine[] on Person, Vendor, Location, ProductionPhase)
6. Add CHECK constraints via raw SQL

All existing data is unaffected. New columns are null. No backfill required.

### Phase 2: CalculatorContext + SpendRecord

1. Define SpendRecord interface in packages/types
2. Add projection functions: budgetLineToSpendRecord(), expenseFactToSpendRecord()
3. Add getSpendRecords(), getResidencyBatch() to CalculatorContext
4. Refactor LabourExpenditureCalculator, ExpenditureThresholdCalculator
5. Add unit tests with both budget and actual source data

### Phase 3: API + DTO

1. Extend CreateBudgetLineDto / UpdateBudgetLineDto with new optional fields
2. Add validation: party exclusivity, labourAmount constraints
3. Add BudgetLine annotation endpoints (or extend existing PATCH)
4. Add annotation completeness endpoint: GET /budgets/:id/versions/:vid/annotation-completeness?programs=CPTC,OFTTC

### Phase 4: UI

1. Add "Eligibility" tab to budget version view
2. Implement annotation form with smart defaults
3. Implement bulk operations
4. Implement completeness indicators
5. Add "Part A Estimate" tab with results display

### Phase 5: Blended Mode (future)

1. Add EvaluationSource enum and field to ProgramSubmission
2. Implement per-account blending in getSpendRecords()
3. UI for comparing Part A estimate vs. Part B final

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Locked budget versions have null eligibility fields | Part A calculations return empty results for old budgets | Annotation fields are editable on locked versions (see §12.3). Financial integrity is preserved; annotation is metadata, not financial data. |
| Loan-out resolution produces incorrect residency | Qualifying labour miscalculated | Audit trail: SpendRecord.effectivePersonId traceable to source (direct vs. loan-out); UI shows resolved person for verification |
| Smart defaults apply wrong classification | Over/under-counting eligible spend | Defaults are always user-editable; completeness check warns when defaults haven't been reviewed; audit log tracks whether value was defaulted or manually set |
| N+1 residency queries at budget scale | Slow Part A calculations for large budgets | getResidencyBatch() batch-loads all residencies in one query; cached for the evaluation run |
| Annotation fatigue: 400+ lines to annotate | Users skip annotation, reducing estimate quality | Bulk operations, smart defaults, per-account inheritance, completeness threshold (not 100% — e.g. 80% is "ready") |
| Regional spend not calculable from budget | OFTTC regional bonus, FIBC regional/distant cannot be evaluated | Mark as NOT_EVALUATED with explanation; surface in UI as "requires activity day data" |

---

## 11. Summary of Answers

**Q1: Should Part A calculators read directly from BudgetLine?**
No. They should read from `SpendRecord`, a source-agnostic abstraction. CalculatorContext projects BudgetLine into SpendRecord for Part A evaluations.

**Q2: Should StoryOS introduce a BudgetLineFact table?**
No. Unlike actuals (where financial data is imported from external systems), budget data is entered within StoryOS. Eligibility fields belong directly on BudgetLine. The abstraction layer is at runtime (SpendRecord projection), not in storage.

**Q3: How should loan-out corporations be handled?**
Add `Vendor.principalPersonId` FK to Person. The SpendRecord projection resolves `effectivePersonId` through the chain: `budgetLine.personId ?? vendor.principalPersonId ?? null`. Calculators use effectivePersonId for residency tests without knowing the resolution path.

**Q4: How should eligibility annotation be layered onto budgets?**
As a separate workflow, accessed via a distinct UI tab. Budget entry (financial data) remains unchanged. Annotation (eligibility metadata) is done afterward, with smart defaults, bulk operations, and per-program completeness tracking.

**Q5: What is the recommended UI workflow?**
Three workflows: (1) Budget entry — existing inline editing, unchanged. (2) Eligibility annotation — new tab with party/location/phase/type selectors, smart defaults, bulk ops, completeness indicators. (3) Part A calculation — trigger evaluation, view results per program with line-level drill-down.

**Q6: What schema changes are required?**
BudgetLine: +personId, +vendorId, +locationId, +productionPhaseId, +labourAmount, +expenseType, +activityType, +isServiceContract, +sortOrder (all nullable). Vendor: +principalPersonId, +isRelatedParty. New enums: ExpenseType, ActivityType. CHECK constraints for party exclusivity and labourAmount invariants.

**Q7: How should the system transition from Part A to Part B?**
Phase 1: Explicit mode selection. budgetVersionId on ProgramSubmission determines source (set = budget, null = actuals). Part A and Part B assessments coexist as separate submissions under the same ProjectProgram. Phase 2 (future): Blended mode for mid-production with per-account source selection.

---


## 12. Design Refinements (March 2025 Revision)

Three design issues identified during review. Each is analyzed against the existing codebase and resolved below.

### 12.1 Service Contract Classification

**Problem:** The original SpendRecord projection used `vendorId != null AND isLabour = true` to infer `isService`. This is too weak. A vendor can supply equipment rental, catering, payroll services, or consulting labour. Vendor presence alone does not identify a service contract in the tax credit sense.

The existing VendorType enum has 13 values (PRODUCTION_SERVICE, POST_PRODUCTION, VFX, ANIMATION, SOUND, MUSIC, EQUIPMENT_RENTAL, STUDIO_RENTAL, CATERING, TRANSPORTATION, INSURANCE, LEGAL, OTHER). While some types strongly correlate with service contracts (PRODUCTION_SERVICE, POST_PRODUCTION, VFX, ANIMATION), the classification is engagement-specific, not vendor-specific. The same VFX vendor could supply a labour service contract on one line and a software license on another.


**Decision: Stored column on BudgetLine.**

Add `isServiceContract Boolean?` to BudgetLine. This is preferred over a derived flag because:

1. **The classification is per-engagement, not per-vendor.** A single vendor may have service-contract and non-service-contract lines. Deriving from VendorType or account metadata would require an override mechanism anyway.
2. **ExpenseFact already has `serviceFlag`.** BudgetLine.isServiceContract mirrors this for structural consistency.
3. **It is simple, explicit, and auditable.** No inference logic to debug when calculations produce unexpected results.
4. **The alternative (account-level metadata + override) adds complexity without benefit.** BudgetAccount has no service-contract metadata today. Adding it would require a new field on BudgetAccount, a default-resolution function, AND an override mechanism on BudgetLine. The stored column is one field instead of three.

**Default logic during annotation:**

When a user assigns a vendorId to a BudgetLine, `isServiceContract` defaults based on:

```
VendorType → default isServiceContract:
  PRODUCTION_SERVICE    → true
  POST_PRODUCTION       → true
  VFX                   → true
  ANIMATION             → true
  SOUND                 → true
  MUSIC                 → true    (if labour component)
  EQUIPMENT_RENTAL      → false
  STUDIO_RENTAL         → false
  CATERING              → false
  TRANSPORTATION        → false
  INSURANCE             → false
  LEGAL                 → false   (unless labour consulting)
  OTHER                 → null    (user must decide)
```

This default is applied in the UI/service layer, not as a database default. The user can always override.

**SpendRecord projection (updated):**

```
isService = budgetLine.isServiceContract ?? false    // from BudgetLine (Part A)
isService = expenseFact.serviceFlag                  // from ExpenseFact (Part B)
```

**Why this matters for calculations:**

- **Quebec PSTC:** Only 65% of VFX/animation service contract cost qualifies for the enhanced rate. The calculator needs `isService = true` AND `activityType IN (VISUAL_EFFECTS, ANIMATION)` to apply the 65% rule.
- **OPSTC:** The labour portion of service contracts counts toward qualifying production expenditure; the non-labour portion (profit margin, materials) does not. The calculator needs `isService = true` to extract `labourAmount` from the total.
- **CPTC:** Non-labour components of invoices (materials, profit margin, employer deductions) are excluded from qualified labour expenditure. `isService = true` signals the calculator to use `labourAmount` rather than `amount`.

### 12.2 Evaluation Source Resolution

**Problem:** The original design described mode resolution (BUDGET vs. ACTUAL) inline within `getSpendRecords()`. This embeds a policy decision inside a data-access method, making it hard to test, override, or extend to BLENDED mode.

**Decision: Centralize in EvaluationService, pass resolved mode via CalculatorInput.**

The resolution happens exactly once per evaluation run, in `EvaluationService.runEvaluation()`, before the CalculatorContext is constructed:

```
EvaluationService.runEvaluation():
  1. Load submission (already done)
  2. resolveEvaluationSource(submission) → 'BUDGET' | 'ACTUAL'
  3. Set on CalculatorInput: { ...contextInput, evaluationSource }
  4. Construct CalculatorContext with the resolved input
  5. Run calculators
```

**Why EvaluationService and not CalculatorContext:**

EvaluationService is the correct location because:
- It owns the ProgramSubmission lifecycle and already reads `budgetVersionId` from the submission.
- The resolution is a business rule ("which data source to use"), not a data-access concern.
- CalculatorContext receives the decision as an immutable input, making its behavior deterministic and testable.
- When ProgramSubmission gains an explicit `evaluationSource` field (Phase 2), the resolver simply reads that field. No change to CalculatorContext.

**Phase 1 resolver (current):**

```
resolveEvaluationSource(submission):
  if submission.budgetVersionId IS NOT NULL → 'BUDGET'
  else → 'ACTUAL'
```

**Phase 2 resolver (future, when ProgramSubmission.evaluationSource is added):**

```
resolveEvaluationSource(submission):
  if submission.evaluationSource IS NOT NULL → submission.evaluationSource
  else if submission.budgetVersionId IS NOT NULL → 'BUDGET'
  else → 'ACTUAL'
```

**Phase 2 schema addition (deferred):**

```
enum EvaluationSource {
  BUDGET
  ACTUAL
  BLENDED
}

model ProgramSubmission {
  + evaluationSource  EvaluationSource?
}
```

**CalculatorContext contract:**

`getSpendRecords()` reads `this.input.evaluationSource` and dispatches to the appropriate loader. It does not infer, detect, or decide the source. This is a strict separation of concerns.

### 12.3 Locked Budgets and Eligibility Annotation

**Problem:** The current locking model is binary. `BudgetVersionsService.assertVersionDraft()` blocks ALL writes on LOCKED versions. But the Part A workflow requires:
1. Lock the budget (financial data is final)
2. Complete eligibility annotation (after lock, potentially weeks later)
3. Run Part A calculations

Under the current model, step 2 is impossible after step 1.

**Compatibility analysis with existing code:**

The locking gate is a single method:

```
assertVersionDraft(budgetId, versionId):
  if version.status === 'LOCKED' → throw ForbiddenException
```

This is called by `create()`, `update()`, and `remove()` in BudgetLinesService. It is a clean, single enforcement point. Modifying it is safe because no other code path checks the lock.

The version cloning logic in `BudgetVersionsService.create()` currently copies only financial fields:

```
data: {
  description, quantity, unitCost, amount, currency, fringeRate, notes
}
```

After the redesign, cloning must also copy annotation fields so annotation work is preserved across versions.

**Decision: Separate API endpoints with field-level access control.**

Rather than modifying `assertVersionDraft()` to be field-aware (which complicates a clean guard), introduce a distinct annotation path:

**Financial writes** (existing pattern, unchanged):
- `POST   .../lines` — create line → requires DRAFT
- `PATCH  .../lines/:id` — update financial fields → requires DRAFT
- `DELETE .../lines/:id` — remove line → requires DRAFT

**Annotation writes** (new):
- `PATCH  .../lines/:id/annotate` — update annotation fields → works on DRAFT or LOCKED

This is cleaner than a single endpoint with field-level checks because:
1. The locking contract is explicit: financial endpoints check DRAFT, annotation endpoint does not.
2. Permissions can differ: `BUDGET_LINE_UPDATE` for financial writes, `BUDGET_LINE_ANNOTATE` for annotation writes.
3. The DTOs are separate, so validation rules don't intermix.
4. No risk of accidentally allowing financial field changes through the annotation path.

**Field classification:**

| Category | Fields | Editable when LOCKED? |
|---|---|---|
| Financial | amount, quantity, unitCost, description, currency, fringeRate | No |
| Annotation | personId, vendorId, locationId, productionPhaseId, expenseType, activityType, labourAmount, isServiceContract | Yes |
| Structural | budgetVersionId, budgetAccountId, organizationId, sortOrder | No (sortOrder is structural because it affects display, not eligibility. Can be reconsidered.) |
| Metadata | notes | Yes (non-financial, useful for annotation context) |

**labourAmount classification rationale:**

`labourAmount` is classified as an annotation field even though it represents a dollar value. This is correct because:
- It does not change the total spend (that's `amount`, which remains locked).
- It is a classification of the spend, not the spend itself.
- Production accountants determine the labour split during eligibility annotation, not during budget entry.
- Locked `amount` = "this line costs $100,000." Editable `labourAmount` = "of that $100,000, $75,000 is labour." The financial commitment is unchanged.
- `labourAmount` must always satisfy `labourAmount <= amount`. Since `amount` is locked, this invariant is stable.

**Annotation service method:**

```
BudgetLinesService:

  async annotate(budgetId, versionId, lineId, dto: AnnotateBudgetLineDto):
    // Does NOT call assertVersionDraft — annotation is allowed on LOCKED versions
    await this.assertVersionBelongsToBudget(budgetId, versionId)
    await this.assertLineExists(versionId, lineId)
    // Validate party exclusivity, labourAmount <= amount, etc.
    return this.prisma.budgetLine.update(...)
```

**Audit logging:**

StoryOS does not currently have a dedicated audit log table. Prisma's `@updatedAt` captures the last modification timestamp but not the change details.

For annotation changes on locked versions, audit logging is required because:
- The locked budget is attached to a ProgramSubmission.
- Annotation changes affect Part A calculation results.
- Auditors (CAVCO, Ontario Creates, Creative BC) may need to see when annotations were modified.

**Recommended approach:** Add a lightweight `BudgetLineAnnotationLog` table:

```
model BudgetLineAnnotationLog {
  id             String   @id @default(uuid())
  budgetLineId   String
  organizationId String
  changedById    String

  fieldName      String          // e.g. "personId", "expenseType"
  oldValue       Json?           // Previous value — Json preserves type (UUIDs, enums, nulls)
  newValue       Json?           // New value
  changedAt      DateTime        @default(now())

  budgetLine     BudgetLine @relation(fields: [budgetLineId], references: [id])

  @@index([budgetLineId])
  @@index([organizationId])
  @@index([changedAt])
  @@map("budget_line_annotation_logs")
}
```

This is populated by the `annotate()` service method by diffing the DTO against the current values. Only changed fields produce log entries. This is scoped to annotation changes only — financial field changes on DRAFT versions use the existing `updatedAt` tracking.

**Version cloning update:**

The existing clone logic must be extended to copy annotation fields:

```
cloned line data: {
  // financial (existing)
  description, quantity, unitCost, amount, currency, fringeRate, notes,
  // annotation (new)
  personId, vendorId, locationId, productionPhaseId,
  labourAmount, expenseType, activityType, isServiceContract, sortOrder,
}
```

This preserves annotation work when a locked-and-annotated v1 is cloned into a new v2.

### 12.4 Updated Schema Summary (incorporating all §12 changes)

**BudgetLine additions** (complete list, all nullable):

| Field | Type | Category |
|---|---|---|
| personId | FK → Person | Annotation |
| vendorId | FK → Vendor | Annotation |
| locationId | FK → Location | Annotation |
| productionPhaseId | FK → ProductionPhase | Annotation |
| labourAmount | Decimal(14,2) | Annotation |
| expenseType | ExpenseType enum | Annotation |
| activityType | ActivityType enum | Annotation |
| isServiceContract | Boolean | Annotation |
| sortOrder | Int (default 0) | Structural |

**Vendor additions:**

| Field | Type |
|---|---|
| principalPersonId | FK? → Person |
| isRelatedParty | Boolean? |

**New enums:**

| Enum | Values |
|---|---|
| ExpenseType | LABOUR, NON_LABOUR, MIXED |
| ActivityType | GENERAL, DIGITAL_ANIMATION, VISUAL_EFFECTS, POST_PRODUCTION |

**New tables:**

| Table | Purpose |
|---|---|
| BudgetLineAnnotationLog | Audit trail for annotation changes on locked versions |

**New permissions:**

| Permission | Purpose |
|---|---|
| BUDGET_LINE_ANNOTATE | Allows annotation writes on DRAFT and LOCKED versions |

**CHECK constraints** (unchanged from §6.4, plus):

```sql
-- isServiceContract requires vendorId
ALTER TABLE budget_lines
  ADD CONSTRAINT chk_service_contract_requires_vendor
  CHECK (is_service_contract IS NOT TRUE OR vendor_id IS NOT NULL);
```

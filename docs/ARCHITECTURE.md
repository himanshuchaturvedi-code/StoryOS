# StoryOS — System Architecture

**System model:** Shared project-level planning and Part B actuals are parallel inputs; application submissions choose which source(s) feed calculators and persist results as assessments.

**Audience:** Engineers onboarding and session context  
**Scope:** Data layers, calculation model, extension points. Not UI, workflow, or product process.

---

## 1. System Overview

Three layers, bottom to top:

| Layer | Role |
|-------|------|
| **Planning** | Project-level facts entered once (Part A inputs). Program-agnostic. |
| **Application** | Per-program submissions and assessments. Reads planning + (when applicable) actuals. |
| **Actuals** | Evidence-grade Part B data: person×date activity, GL lines, annotated spend facts. |

```
Planning (project)  ──►  Application (submission × program)  ──►  RequirementAssessment
        │                              ▲
        │                              │ evaluationSource picks source
Actuals (project)  ───────────────────┘
```

---

## 2. Data Model Structure

### Planning (project-level)

**Activity Plan** is the planning input outside the budget stack for **planned day counts** by incentive region × phase; other domains are format, people, structure, finance, and budget (with annotations).

#### Identity

| Area | Entities / notes |
|------|------------------|
| Format | Project format fields (type, runtime, episodes). |
| Schedule | `ProductionPhase` (+ milestones as modeled). |

#### People

| Area | Entities / notes |
|------|------------------|
| People | `ProjectParticipant`, roles; `ParticipantResidencyStatus` (person-level, temporal). |

#### Financial

| Area | Entities / notes |
|------|------------------|
| Budget | `Budget`, `BudgetVersion` (lock), `BudgetLine` + per-line annotation (person/vendor, location, phase, expense/labour fields → SpendRecord projection). |
| Finance | Finance plans / sources (forms; not all calculators consume today). |
| Commerce | `Vendor` registry; **see Application** for per-program eligibility. |
| Documents | Files at project/org level; **which categories matter** is per-program (config + `SubmissionEvidence`). |

#### Structure

| Area | Entities / notes |
|------|------------------|
| Ownership / control | `ProjectOwnership`, corporate ownership chain; `RightsControlFact`. |
| Places | Org `Location` + `ProjectLocation` (province, canonical incentive region, primary). |

#### Activity

| Area | Entities / notes |
|------|------------------|
| **Activity Plan** | `ActivityPlan`: planned days by `locationId` × `productionPhaseId`. `locationId` points to a canonical incentive-region `Location`. **Only non-budget planning input** for region × phase day totals. |

Planning and actuals are **parallel** project-level models: both persist independently; a submission’s `evaluationSource` (and blend rules) selects which data feeds calculators for that run—they do not merge into one underlying row type.

### Application (per program / submission)

| Area | Entities / notes |
|------|------------------|
| Enrollment | `ProjectProgram` (project ↔ program version). |
| Submission | `ProgramSubmission`: `evaluationSource`, `evaluationDate`, `budgetVersionId` (when BUDGET/BLENDED), links to evidence. |
| Blending | `SubmissionAccountSource` — per budget account, BUDGET vs ACTUAL when `evaluationSource = BLENDED`. |
| Eligibility | `VendorEligibility` (`vendorId` × `programCode` × status). |
| Results | `RequirementAssessment` (calculator output per requirement). |
| Rules | `ProgramRequirement` + `configuration` JSON (thresholds, filters, which calculators run). |

### Actuals (Part B, project-level)

| Area | Entities / notes |
|------|------------------|
| Activity | `ActivityDay` — person × date × location × role × phase (distinct dates for day-count rules). |
| Ledger | `ActualLine` (e.g. GL import). |
| Annotated spend | `ExpenseFact` tied to actual lines (eligibility annotation parallel to budget lines). |

**Vendor split:** Vendor *identity* is planning; *eligibility for a program* is application data.

---

## 3. Core Principles

1. **Enter once, program-agnostic:** Budget, participants, residency, ownership, rights, locations, phases, format, finance, documents (files) are shared. No duplicate project facts per CPTC vs OFTTC.

2. **Application = interpretation:** Programs differ by `ProgramRequirement.configuration` and which calculators run — not by copying planning rows. Example: same `SpendRecords`, different `LabourExpenditureConfig.numeratorMode` (`residency` vs `location`).

3. **Actuals supersede for evaluation:** Part B does not “merge into” planning rows; planning and actuals are **parallel** models on the project. Each `ProgramSubmission` chooses **data source** via `evaluationSource` (and `SubmissionAccountSource` in BLENDED). Planning remains the historical Part A baseline and for plan-vs-actual comparisons (e.g. Activity Plan vs grouped `ActivityDay` counts).

4. **Minimal per-program storage:** Overrides live on submission or small join tables (`VendorEligibility`, `SubmissionEvidence`, account-level blend) — not parallel budgets per program.

5. **Incentive regions are explicit:** Region-sensitive rules use `Location.incentiveRegionCode`, not inferred geography or `zoneCode`. `INCENTIVE_REGIONS` in `@storyos/types` is the controlled reference list; canonical region locations are provisioned per organization and used by both `ActivityPlan` and `ActivityDay`.

---

## 4. Calculation Architecture

- **`CalculatorContext`:** Single access layer for calculators — the only supported way they read project state for a run (evaluation date, budget version when needed, residency batch, spend projection, activity summary, etc.). Implementations may vary by file name, but the contract is one context object per submission evaluation.

- **Spend projection:**  
  - **BUDGET:** `BudgetLine` (+ annotations) → `SpendRecord` (e.g. `budgetLineToSpendRecord`).  
  - **ACTUAL:** `ExpenseFact` / actual line pipeline → `SpendRecord`.  
  - **BLENDED:** Per-account resolution (budget vs actual) then combined set.

- **`evaluationSource`:**  
  - `BUDGET` — spend from locked budget version; activity-day-style rules from **Activity Plan**.  
  - `ACTUAL` — spend from actuals; activity from `ActivityDay` (distinct dates, grouping).  
  - `BLENDED` — spend mix per `SubmissionAccountSource`; activity currently follows the actuals activity path (`ActivityDay`) unless explicitly extended later.

- **Activity summary:**  
  - `CalculatorContext.getActivityDaySummary()` is the shared source for activity-based calculators.
  - In `BUDGET` mode it reads `ActivityPlan`.
  - In `ACTUAL` and `BLENDED` modes it reads `ActivityDay`, grouped by `locationId × productionPhaseId`, counting distinct `activityDate` values per group.
  - `CalculatorContext.getActivityRegionSummary()` reduces day summaries to `{ regionCode, totalDays }` using `location.incentiveRegionCode`.

- **Region-sensitive calculators:**  
  - `RegionalSpendCalculator` consumes region-level activity summaries through `regionCodes`.
  - `ActivityDayMinimumCalculator` uses `getActivityDaySummary()` with optional `regionCodes` filters.
  - `LabourExpenditureCalculator` location-mode filters use `incentiveRegionCode` through `regionCodes`.
  - Deprecated `zoneCodes` calculator paths have been removed from runtime calculation logic.

- **Calculators:** Stateless (or pure) functions: input = context + single `ProgramRequirement` config → pass/fail/metrics. Program packs define which requirement categories run.

- **Outputs:** Persisted as `RequirementAssessment` per requirement × submission run.

---

## 5. Missing / Extension Points

| Item | Status |
|------|--------|
| **Activity Plan** | Implemented planning entity: `(projectId, organizationId, locationId, productionPhaseId, plannedDays, notes?)`. Unique per `(projectId, locationId, productionPhaseId)`. Feeds day-based calculators in BUDGET mode. Coexists with `ActivityDay`; plan-vs-actual = plan totals vs grouped actual distinct dates. |
| **Incentive regions** | Implemented via `INCENTIVE_REGIONS` reference data and `Location.incentiveRegionCode`. Canonical locations are provisioned per organization. `zoneCode` remains as a deprecated DB field only; calculation logic uses explicit `regionCodes`. |
| **Unified activity summary** | Implemented in `CalculatorContext`: `getActivityDaySummary()` returns per-location × phase summaries with `location.incentiveRegionCode`; `getActivityRegionSummary()` returns `{ regionCode, totalDays }[]` for region-based calculators. |
| **Activity region integrity** | Database triggers prevent `ActivityPlan` / `ActivityDay` from referencing a `Location` with null `incentiveRegionCode`, and prevent removing `incentiveRegionCode` from a location used by active activity rows. |
| **Readiness** | Optional computed layer (no required new tables): projected completeness vs `ProgramRequirement` list for enrolled programs. |

---

## 6. What Is NOT Included

- **UI / screens / components** — not specified here.  
- **User workflow, onboarding copy, readiness UX** — see separate product docs if needed.  
- **Legal / program rule text** — encoded in seeded configs and calculators, not this file.

---

## Related references (implementation detail)

- `packages/types/src/program-config/` — requirement config shapes.  
- `packages/types/src/incentive-regions/` — canonical incentive region reference data.  
- Part A calculation design (if present): `docs/PART-A-CALCULATION-ARCHITECTURE.md`.  
- Prisma schema: `packages/database` — source of truth for table names.

---

## 7. Incentive Engine (FINAL STATE)

The incentive engine has migrated from bespoke per-province functions to a unified, declarative architecture.

- **Unified estimator engine:** A single `runEstimate` kernel executes the estimation logic for all programs.
- **ProgramEstimateSpec system:** All program rates, base filters, caps, and bonuses are config-driven via `ProgramEstimateSpec`.
- **Legacy removal:** All legacy per-province estimators (`calcAB`, `calcBC`, etc.) have been completely removed from the codebase.
- **Spec-first routing:** The system uses a single, spec-driven execution path (`estimateByProgramCode`) for all estimations, eliminating parallel calculation logic.

---

## 8. Grinding Engine

The grinding engine evaluates program combinations and handles credit-to-credit deductions via a directed acyclic graph (DAG).

- **Topological sort:** Program evaluation order is determined by a DAG-based topological sort to ensure dependencies (grinds) are calculated before the programs they affect.
- **Tier order:** Programs are evaluated in order of tier: Regional (0) → Provincial (1) → Federal (2).
- **Grind direction:** Grinding strictly flows upwards: provincial programs reduce the eligible base of federal programs. Federal programs do not grind provincial programs.
- **PriorAssistanceLedger:** A ledger tracks accumulated assistance (total, labour, non-labour) from earlier programs in the topo-sort, ensuring correct assistance flow to later programs.
- **Two-phase deduction:**
  1. **Direct assistance:** Deductions from external sources (e.g., grants, deferrals) are applied first based on the program's specific `grindType`.
  2. **Credit-to-credit grinding:** Ledger-accumulated assistance from previously evaluated tax credits is then deducted from the remaining eligible base.

---

## 9. Assistance Model

The system uses a formal model for tracking and classifying external funding sources.

- **AssistanceContext:** Aggregates and classifies all external funding sources for a project to determine total, labour, and general assistance prior to estimation.
- **FinanceSource classification:** Existing `FinanceSource` records are mapped and classified as either assistance (e.g., GRANT, DEFERRAL) or non-assistance.
- **Attribution:** Currently, all assistance defaults to 'general' attribution. This is a coarse mechanism pending the introduction of granular geographic/origin tagging on funding sources.
- **CMF default:** The Canada Media Fund (CMF) is treated as a funding source, not a tax credit program. It defaults to non-assistance, with a specific configuration exception (`cmfTopUpIsAssistance`) for PSTC where CMF top-ups are reclassified as assistance.

---

## 10. Program Configuration System

Program definitions and interaction rules are strictly separated from the estimation math.

- **PROGRAM_CONFIGS:** The central registry defining interaction rules: tier evaluation order, grind edges (who grinds whom), and mutual exclusions.
- **PROGRAM_SPECS:** The central registry defining estimation rules: base types (labour vs. total), filtering criteria, base rates, bonuses, and caps.
- **Separation of concerns:** `PROGRAM_CONFIGS` exclusively drives the scenario engine and grinding topology, while `PROGRAM_SPECS` exclusively drives the `runEstimate` kernel.

---

## 11. Current Limitations / Known Gaps

- **No document generation system yet:** Output is currently limited to API data and calculation traces.
- **No structured ScenarioTrace:** Scenario explanations are still built using templated strings rather than being generated from a structured `ScenarioTrace` object.
- **Assistance attribution is coarse:** Funding sources lack geographic origin tagging, forcing conservative grinding assumptions (e.g., AB FTTC only deducting labour assistance because it cannot distinguish in-province vs. out-of-province grants).
- **No multi-program document support:** Architecture for combined agency forms is not yet designed.
- **SpendRecord abstraction pending:** The estimator kernel still uses the legacy `EstimatorLine` type instead of the planned source-agnostic `SpendRecord`.

---

## 12. Upcoming Capability: Agency Document Generation

StoryOS will expand beyond estimation to generate agency-compliant submission documents.

- **Initial Scope:** CPTC Part A will be the first supported document.
- **Requirements:** This capability will introduce two new layers to the architecture:
  - A **mapping layer** to translate StoryOS project and estimation data into specific agency form fields.
  - A **rendering layer** to output the populated forms (initially as PDFs).
- **Evolution:** This foundation will evolve into a generalized, multi-program document generation engine over time.
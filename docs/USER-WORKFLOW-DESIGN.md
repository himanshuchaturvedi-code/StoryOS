# User Workflow Design: From New Project to Part A Application

**Date:** March 2026
**Status:** Product design — no implementation
**Builds on:** ARCHITECTURE.md (system model), UX-ASSESSMENT-PART-A-VS-PART-B.md (problem statement)
**Scope:** Workflow orchestration and user journey only. No UI components, no data model changes.

---

## 1. Entry Point: What Happens When a User Creates a Project

Today, creating a project produces a blank shell with 15+ tabs. The user has no signal about what to do first, what matters, or when they're done.

**Proposed entry flow:**

```
Create Project
  ├─ Title (required)
  ├─ Format type (required — dropdown, 3 seconds)
  └─ "Which programs are you targeting?" (optional multi-select)
       e.g. ☑ CPTC  ☑ OFTTC  ☐ FIBC  ☐ BC PSTC
```

This is not enrollment (that's a formal step later). It's **intent declaration** — a signal that lets the system tailor what it shows. If the user skips it, the system shows a generic planning workflow. If they select programs, the readiness model activates immediately.

After creation, the user lands on the **project home** — not a blank dashboard, but the readiness view (see §4).

---

## 2. The Part A Preparation Sequence

These are the minimum steps to go from empty project to a runnable Part A estimate. Ordered by natural dependency (you need locations before you can annotate budget lines with locations, etc.).

### Phase 1: Project Identity (5 minutes)

| Step | What | Why it's early | Depends on |
|------|------|---------------|------------|
| **1a. Format** | Type, runtime, episodes | FormatEligibilityCalculator needs this. Quick to set. | Nothing |
| **1b. Phases** | Define production phases (at minimum: Principal Photography) | Activity Plan and budget annotation reference phases. | Nothing |
| **1c. Locations** | Add project locations (at minimum: primary shoot location) | Activity Plan and budget annotation reference locations. | Nothing |

These three are **prerequisite data** — small inputs that unlock the rest. They can be entered in any order, but all three are needed before budget annotation or activity planning can reference them.

### Phase 2: People & Structure (15-30 minutes)

| Step | What | Why | Depends on |
|------|------|-----|------------|
| **2a. Key participants** | Add persons to project; assign key creative roles (Director, Writer, etc.) | KeyCreativeCalculator and ResidencyTestCalculator need participant + role data. | Persons exist in org directory |
| **2b. Residency** | Enter residency records for key creatives | Residency test evaluates at the person level. Without this, labour qualification cannot be computed. | 2a (persons assigned) |
| **2c. Ownership** | Document entity ownership chain (who owns the production, what %) | CanadianControlCalculator needs ownership facts. | Nothing (can be done in parallel with 2a-2b) |
| **2d. Rights & control** | Assert who holds creative/financial control | RightsControlCalculator needs this. | Nothing (parallel) |

This phase is about the **structural tests** — Canadian control, key creative, residency. These are facts about *who* is involved, not about *money*.

### Phase 3: Budget (30-120 minutes depending on complexity)

| Step | What | Why | Depends on |
|------|------|-----|------------|
| **3a. Budget entry** | Create budget, build or import chart-of-accounts, enter line amounts | The financial foundation. Everything expenditure-based reads from here. | Budget template (optional) |
| **3b. Lock version** | Lock the budget version (financial data becomes immutable) | Part A applications use locked budgets. Annotation happens on locked versions. | 3a complete |
| **3c. Annotate** | Per-line: assign person/vendor, location, phase, expense type, labour amount | This is where budget data becomes eligible for calculation. Without annotation, SpendRecords have null person/location/phase and calculators exclude them. | 3b locked; 1b (phases), 1c (locations), 2a (persons/vendors) exist |

Budget annotation is the **highest-effort step** in the entire workflow. Smart defaults, bulk operations, and completeness tracking exist specifically to make this tractable.

### Phase 4: Activity Plan (5-10 minutes)

| Step | What | Why | Depends on |
|------|------|-----|------------|
| **4a. Planned shoot days** | Enter planned days by location × phase (e.g., "30 PP days at Toronto Studio") | ActivityDayMinimumCalculator and RegionalSpendCalculator need day counts. Without this, day-based requirements return NOT_EVALUATED. | 1b (phases), 1c (locations) |

This is lightweight — a small table. It's separated from the budget because it represents a different dimension (time, not money).

### Phase 5: Evaluate (2 minutes)

| Step | What | Why | Depends on |
|------|------|-----|------------|
| **5a. Enroll in programs** | Formally link project to target program versions | Creates the container for submissions and assessments. | Programs identified (from creation or now) |
| **5b. Create submission** | Set evaluationSource=BUDGET, select budget version | Points the calculators at the right data snapshot. | 5a; 3b (locked version exists) |
| **5c. Run estimate** | Trigger calculators | Produces RequirementAssessment results per program requirement. | 5b; all planning data as complete as possible |
| **5d. Review results** | See pass/fail per requirement, warnings about gaps, line-level breakdowns | The payoff. Producer sees "CPTC: 9/12 passing, 3 need attention." | 5c |

---

## 3. How the System Guides the User

### 3.1 Principle: Show what matters now, not everything that exists

The system should never present all 15+ tabs as equally important. Instead, the user sees their **current focus** — determined by two signals:

1. **What programs they're targeting** (declared at creation or later)
2. **What data is already present** (the readiness model computes this)

### 3.2 Three navigation modes

Rather than hiding/showing tabs dynamically (which is disorienting), the system offers three **lenses** into the same project:

**Lens 1: Readiness (default home)**
"What do I still need to do?"
Organized by gap, not by data domain. Details in §4.

**Lens 2: Planning domains**
The familiar set of data areas (budget, participants, locations, etc.) — but presented as a flat list the user can access on demand, not as a mandatory sequence. This is for the experienced user who knows exactly where they need to go.

**Lens 3: Application status**
Per-program view: enrollment, submissions, results, documents. This is the **output** side — what comes out of the planning data.

The key insight: **Lens 1 is the orchestrator.** It tells the user which domain to visit next. The user clicks through to that domain (Lens 2), does the work, comes back to Lens 1 to see their progress update.

### 3.3 The user never needs to know the data model

The readiness view speaks in **producer language**, not in system terms:

| System concept | What the user sees |
|---------------|-------------------|
| ParticipantResidencyStatus records are missing for 2 ProjectParticipants with KEY_CREATIVE roles | "2 key creatives don't have residency on file — Director, Lead Actor" |
| BudgetLine annotation coverage is 64% for CPTC requirements | "Budget annotation: 64% ready for CPTC — 147 lines still need person or location" |
| No Activity Plan entries exist | "No shoot day estimates entered — OFTTC requires Ontario day minimums" |
| ProjectOwnership rows sum to < 50% Canadian | "Canadian ownership: 40% documented — CPTC requires majority Canadian control" |
| FormatType is null | "Format not set — all programs require this" |

Each gap is:
- **Described** in plain language
- **Attributed** to the program(s) that need it
- **Linked** to the domain where the user can fix it

### 3.4 No mandatory sequence, but a natural one

The phases in §2 represent a natural dependency order, but the system does not enforce it. A producer can:
- Enter ownership before budget (fine — they're independent)
- Skip activity plan entirely (fine — day-based calculators return NOT_EVALUATED with an explanation)
- Start budget annotation before all participants are added (fine — they can annotate known lines and come back)

The readiness model simply reflects the current state. It never blocks; it informs.

---

## 4. How the Readiness Model Drives the UX

### 4.1 What the user sees first (project home)

When a user opens a project, the home view is organized around **what's actionable**:

```
My Feature Film — CPTC + OFTTC Part A

Overall readiness: ████████░░ 72%

Critical gaps (blocking estimate):
  ✗ Budget not locked — lock a version to run Part A estimate
  ✗ 2 key creatives missing residency

Attention needed (affects accuracy):
  ⚠ Budget annotation: 64% complete for CPTC
  ⚠ Activity plan: no shoot day estimates
  ⚠ Rights & control: no facts documented

Ready:
  ✓ Format: Feature Film, 95 min
  ✓ Canadian control: 62% documented
  ✓ 4 of 6 key creatives have residency
  ✓ 3 locations linked (primary: Toronto Studio)

[Run Part A Estimate] (disabled until critical gaps resolved)
```

### 4.2 How readiness is computed (per program)

The readiness model is a **function**, not stored data. It takes:
- **Input:** Project state (all planning layer data) + Program requirements (from ProgramRequirement configuration)
- **Output:** Per-requirement readiness status + overall score

For each `ProgramRequirement` on an enrolled program:

| RequirementCategory | Readiness check | Status levels |
|---------------------|----------------|---------------|
| FORMAT_ELIGIBILITY | Is FormatType set? Is it in `allowedFormats`? | Ready / Not set / Ineligible format |
| KEY_CREATIVE_TEST | Are positions from `config.positions` filled? Do those persons have residency? | Ready / N of M roles filled / N missing residency |
| RESIDENCY_TEST | Are scoped participants identified? Do they have residency? | Ready / N missing residency |
| CANADIAN_CONTROL | Do ownership rows exist? Does Canadian % meet threshold? | Ready / Below threshold / No ownership data |
| RIGHTS_CONTROL | Do RightsControlFacts exist for `requiredControlTypes`? | Ready / N of M documented |
| LABOUR_EXPENDITURE | Is a budget version locked? What % of labour lines are annotated (have person/vendor + location)? | Ready / N% annotated / No locked budget |
| EXPENDITURE_THRESHOLD | Same as labour — needs annotated budget | Ready / N% annotated / No locked budget |
| ACTIVITY_DAY_MINIMUM | Do Activity Plan entries exist matching `locationFilter`/`phaseFilter`? Do planned days meet `minDays`? | Ready / Below minimum / No plan |
| REGIONAL_SPEND | Do Activity Plan entries exist in qualifying `zoneCodes`? | Ready / No qualifying zone data / No plan |
| VENDOR_ELIGIBILITY | Are vendors on budget lines checked for program eligibility? | Ready / N vendors unchecked |
| DOCUMENTATION | Are required document categories uploaded? | Ready / N of M categories present |
| CUSTOM | Manual — always shows "Requires manual assessment" | Attention needed |

**Severity mapping:**
- **Critical (blocks estimate):** No locked budget, format not set, evaluation cannot run
- **Attention (affects accuracy):** Incomplete annotation, missing residency, no activity plan
- **Ready:** Requirement has sufficient data to produce a meaningful result

### 4.3 How gaps are surfaced

Each gap has three properties:

1. **What's wrong** — plain language description
2. **Who needs it** — which program(s) require this data
3. **Where to fix it** — direct link to the relevant domain

When a gap applies to multiple programs, it's shown once with both program badges:

```
⚠ Activity plan: no shoot day estimates
  → needed by OFTTC (Ontario day minimum), FIBC (BC day minimum)
  [Enter activity plan →]
```

When a gap is program-specific (e.g., vendor eligibility for FIBC only):

```
⚠ 2 vendors used in budget not checked for FIBC eligibility
  → needed by FIBC only
  [Review vendor eligibility →]
```

### 4.4 Progressive disclosure

The readiness view starts collapsed — just the summary bar and critical gaps. The user expands sections as needed:

- **First visit:** Critical gaps are prominent. The user addresses those first.
- **Second visit:** Critical gaps resolved; attention items promoted to focus.
- **Third visit:** All green or mostly green; "Run Part A Estimate" button is enabled.

The system never says "fill in all 15 sections." It says "here are the 3 things that matter right now."

---

## 5. Validation: Two User Profiles

### 5.1 First-time user (no experience with tax credits)

**Scenario:** A junior producer at a small company. First CPTC application. Doesn't know what CAVCO requires.

**Journey:**

| Step | What they do | What the system does |
|------|-------------|---------------------|
| Create project | Enters title "My First Feature," picks Feature Film, checks CPTC | System creates project, enrolls in CPTC (lightweight — just intent), shows readiness home |
| See readiness | Sees 0% ready with a prioritized list | Critical: "Format runtime not set", "No budget", "No participants". System tells them what to do first, not what CAVCO requires. |
| Set format | Enters 95 min runtime | Readiness updates: Format → Ready. One item resolved. |
| Add locations | Adds "Toronto Studio" as primary location | Readiness: Locations → Ready. Still need budget, participants, etc. |
| Add phases | Adds Principal Photography, Post-Production | Readiness: Phases → Ready. |
| Add participants | Adds Director (from org directory), assigns key creative role | Readiness: "Key creative test: 1 of 6 positions filled. 5 more roles recommended for CPTC." User now understands CPTC has a 6-role point test — they didn't need to know that in advance. |
| Add residency for Director | Enters CITIZEN, CA, CA-ON | Readiness: "1 of 1 assigned key creatives has residency." |
| Enter budget | Imports from template, enters line amounts | Readiness: "Budget: draft version exists. Lock it to begin annotation." |
| Lock budget | Clicks lock | Readiness: "Budget annotation: 0% complete. 312 lines need person/location/expense type for CPTC." |
| Annotate budget | Uses bulk operations: "Set all below-the-line to Location: Toronto Studio" | Readiness: "Budget annotation: 43% complete." Progressive. |
| Enter activity plan | "30 PP days at Toronto Studio" | Readiness: Activity plan → Ready for CPTC. |
| Continue annotating | Works through remaining lines | Readiness climbs from 43% → 71% → 88% |
| Run estimate | Clicks "Run Part A Estimate" | Results: CPTC requirements, 8 of 12 passing. 4 need attention. Drill into each. |
| Address gaps | Goes back to fix: add 2 more key creatives with residency, document ownership | Re-run: 11 of 12 passing. |

**What makes this work for a novice:**
- They never needed to know what CPTC requires. The readiness model told them.
- They never saw Activity Days, Expense Facts, or Blended Mode. Those don't exist in their world yet.
- The sequence was natural: identity → people → money → shoot days → evaluate.
- Every action produced visible progress (readiness %).

### 5.2 Experienced producer (wants speed)

**Scenario:** A line producer at a mid-size company. Has done 10+ CPTC/OFTTC applications. Knows exactly what's needed. Wants to get to a Part A estimate in one sitting.

**Journey:**

| Step | What they do | What the system does |
|------|-------------|---------------------|
| Create project | Title, format, checks CPTC + OFTTC | Readiness home appears |
| Skip readiness | Goes directly to domain list (Lens 2) | All domains accessible. No gates. |
| Bulk setup | Adds 3 locations, 5 phases, 8 key creatives with roles + residency, ownership chain — all from existing org directory | Readiness updates in background |
| Import budget | Uploads from Movie Magic or imports from Telefilm template, enters amounts | Fast because they know the format |
| Lock + annotate | Locks version, uses smart defaults to pre-fill 60% of annotations, manually adjusts the rest | Annotation completeness visible in real-time |
| Activity plan | 30 ON PP, 10 BC PP, 15 ON Post — 3 rows, done | |
| Run both estimates | Creates CPTC + OFTTC submissions, runs both | Sees results side-by-side |
| Tweak | Adjusts 5 budget annotations based on results, re-runs | Final results ready for review |

**What makes this work for an expert:**
- No wizard, no forced sequence. Direct access to every domain.
- Readiness is informational, not gating. They can run an estimate at any completeness level.
- Bulk operations and smart defaults handle volume.
- Side-by-side CPTC + OFTTC results from the same data — no duplicate entry.
- Total time: 1-2 hours for a full Part A preparation (vs half a day with Excel + manual forms).

### 5.3 Where both journeys converge

Despite different paths, both users:
1. Enter the same planning data once
2. See the same readiness model (novice reads it closely; expert glances at it)
3. Arrive at the same endpoint: per-program results with line-level drill-down
4. Never touch Part B concepts (ActivityDay, ActualLine, ExpenseFact)

The system accommodates both by making guidance **available but not mandatory**. The readiness model is always visible but never blocks. The domain list is always accessible but not the default view.

---

## 6. Edge Cases and Failure Modes

### 6.1 User changes budget after running estimate

**Scenario:** Producer runs estimate, sees results, then changes budget amounts.

**Behavior:** The estimate results are tied to a specific `ProgramSubmission` pointing at a `budgetVersionId`. If the budget version is locked, financial fields can't change (only annotations). If the user creates a new version, they create a new submission. Old results remain as history.

**UX:** After annotation changes on a locked version, the readiness model shows: "Budget annotations changed since last estimate. Re-run to see updated results."

### 6.2 User enrolled in programs with conflicting requirements

**Scenario:** CPTC requires Canadian-resident labour ≥ 75%. A provincial program requires provincial-resident labour ≥ 25%. Same budget data.

**Behavior:** Each program's readiness is computed independently. The readiness home shows them separately. No conflict — same data, different calculator interpretation.

### 6.3 User has incomplete data and wants to run estimate anyway

**Scenario:** Budget is only 40% annotated. User wants to see directional results.

**Behavior:** The system allows it. The estimate runs, but results include explicit warnings: "187 lines have no party assigned — excluded from qualifying labour." The readiness model shows this as "attention" not "critical." The user can iterate: annotate more → re-run → see improvement.

**Why this matters:** Blocking the user until data is 100% complete kills adoption. Early estimates with honest warnings build trust and motivate completion.

### 6.4 User starts with no org data (no persons, locations, vendors)

**Scenario:** Brand new organization. No directory data.

**Behavior:** The readiness model surfaces this: "No persons in directory — add key creatives to begin." The user is guided to add persons first, then return to the project. Org-level setup (persons, locations, vendors) is a prerequisite to project-level planning, but the system makes this clear rather than failing silently.

### 6.5 Mobile user enters partial data, web user completes it

**Scenario:** Producer creates project on mobile, enters format + ownership + activity plan (lightweight inputs). Later, the production accountant opens it on web and enters the full budget + annotations.

**Behavior:** Identical data model, same API. The readiness model updates seamlessly regardless of which client entered the data. Mobile entered the lightweight pieces; web entered the heavy ones. Both users see the same readiness state.

---

## 7. Summary: The Workflow Model

```
                    ┌─────────────────────┐
                    │   Create Project     │
                    │  (title + format +   │
                    │   target programs)   │
                    └─────────┬───────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      PROJECT HOME             │
              │   ┌─────────────────────┐     │
              │   │  Readiness Model    │     │
              │   │  (per-program)      │     │
              │   │                     │     │
              │   │  Critical gaps      │──── │ ──→ Navigate to domain
              │   │  Attention items    │     │     (fix the gap, return)
              │   │  Ready items        │     │
              │   └─────────────────────┘     │
              │                               │
              │   [Run Part A Estimate]       │
              └───────────────┬───────────────┘
                              │
               (user fills planning data
                in whatever order they choose,
                guided by readiness gaps)
                              │
                              ▼
              ┌───────────────────────────────┐
              │    Planning Domains            │
              │    (enter in any order)        │
              │                               │
              │    Identity: Format, Phases    │
              │    Places: Locations           │
              │    People: Participants,       │
              │            Residency           │
              │    Structure: Ownership,       │
              │               Rights           │
              │    Money: Budget → Lock →      │
              │           Annotate             │
              │    Schedule: Activity Plan     │
              │    Finance: Plans + Sources    │
              │    Documents                   │
              └───────────────┬───────────────┘
                              │
               (readiness % increases
                as data is entered)
                              │
                              ▼
              ┌───────────────────────────────┐
              │    Run Estimate                │
              │    (per enrolled program)      │
              │                               │
              │    Results:                    │
              │      Per-requirement pass/fail │
              │      Warnings for gaps         │
              │      Line-level drill-down     │
              │                               │
              │    Iterate:                    │
              │      Fix gaps → re-run         │
              └───────────────────────────────┘
```

### The three rules

1. **Readiness drives navigation.** The user sees what matters, not everything that exists.
2. **No gates, only signals.** The system informs but never blocks. Incomplete estimates are allowed with honest warnings.
3. **Enter once, evaluate many.** Planning data is project-level. Program-specific interpretation happens at evaluation time. The user never enters the same fact twice for different programs.

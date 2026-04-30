# StoryOS UX Assessment: Planning vs Actuals

**Date:** March 2026
**Status:** Product analysis — no implementation
**Scope:** System-level UX architecture across Part A (planning/estimates) and Part B (actuals/evidence)

---

## 1. Current State Classification

Every user-facing page classified by its natural lifecycle position.

### Clearly Part A (Planning / Estimates)

| Page | What it does | Notes |
|------|-------------|-------|
| **Budget** (entry tab) | Chart-of-accounts tree, line amounts, versions, lock | Pure financial planning. No actuals dependency. |
| **Budget → Eligibility** tab | Annotate lines with person/vendor/location/phase/expense type | Exists in UI. This is Part A compliance prep layered onto planning data. |
| **Budget → Part A Estimate** tab | Run calculator in BUDGET mode, compare Part A vs Part B | Explicitly labeled. Runs SpendRecord projection from BudgetLine. |
| **Finance** | Finance plans + sources (ESTIMATED / COMMITTED / RECEIVED) | Forward-looking: "where is the money coming from?" |
| **Format** | Runtime, episode count, format type | Set once during development; consumed by FormatEligibilityCalculator. |
| **Metadata** | Logline, synopsis, genre, production year | Project identity. Set during planning, rarely changed. |
| **Stages** | Project stage transitions (DEVELOPMENT → PRE_PRODUCTION → …) | Lifecycle marker. Drives what data is expected. |
| **Phases** | Production phase definitions (prep, principal photography, post) | Planning: "when will each phase run?" |
| **Milestones** | Due dates for key deliverables | Schedule planning. `actualDate` exists in schema but is not exposed in UI. |

### Clearly Part B (Actuals / Evidence)

| Page | What it does | Notes |
|------|-------------|-------|
| **Activity Days** | Person × date × location × role × phase rows | Audit-grade evidence of who worked where/when. |
| **Expense Facts** | Eligibility annotations over ActualLines (GL imports) | 1:1 with ActualLine. "Derive from Actuals" button. |
| **Budget → Actuals** reconciliation | Budget vs Actual variance by account | Requires both budget and imported actuals to be meaningful. |
| **Documents** | Upload scripts, budgets, certificates, contracts | Evidence repository. CAVCO_PART_A / CAVCO_PART_B categories exist in schema. |

### Mixed / Ambiguous

| Page | What it does | Problem |
|------|-------------|---------|
| **Participants** | Link persons to project + assign roles | Needed for Part A (key creative test) AND Part B (activity day attribution). No lifecycle distinction. |
| **Residency** (both UIs) | Person residency history: type, country, province, dates | Consumed by both Part A (budget-based residency test) and Part B (activity-based). UI doesn't distinguish use context. |
| **Ownership** | Entity ownership %, producer flag, effective dates | Structural test (CanadianControlCalculator). Relevant at both stages but entered once. |
| **Rights & Control** | Control type, holder, assertion, dates | Same: structural test consumed at both stages. |
| **Locations** (org + project links) | Location library; link to project with primary flag | Planning input (where will we shoot?) AND actuals input (where did we shoot?). Same records serve both. |
| **Vendors** | Vendor registry + per-program eligibility | Planning (who will we hire?) AND actuals (who did we pay?). |
| **Programs** (project enrollment) | Enroll in programs; create submissions; run evaluations | The submission itself can be BUDGET or ACTUAL mode, but the enrollment UI doesn't surface this distinction clearly. |
| **Persons** (org directory) | Person registry with contact, citizenship | Reference data consumed by both stages. |

### Not Lifecycle-Aware

| Page | What it does |
|------|-------------|
| **Dashboard** | Welcome + link to projects |
| **Projects list / new** | Create and browse projects |
| **Settings** | Org config, members, invitations |
| **Budget Templates** | Account tree templates (Telefilm, etc.) |
| **Programs** (settings browse) | Read-only program catalog |

---

## 2. Key Issues (Expanded)

### 2.1 No planning layer for activity-based data

**The gap:** Several tax credit requirements depend on *activity* data (shoot days by location, regional day counts, labour distribution by province). The system has only one way to capture this: **ActivityDay** — a row-per-person-per-date model designed for audit evidence.

During Part A (planning), producers know:
- "We plan 30 shoot days in Ontario and 10 in BC"
- "Roughly 60% of labour will be Ontario-resident"

They do **not** know (and should not need to provide):
- Which specific person worked which specific day at which specific location

The system has no place to capture **aggregate planning estimates** for activity-based dimensions. Producers must either skip these inputs (leaving calculators without data) or fabricate granular rows to satisfy the model.

**Affected calculators:**
- `ActivityDayMinimumCalculator` — needs day counts; budget has none
- `RegionalSpendCalculator` — needs location-attributed days; budget lines have locationId but no day concept
- The PART-A-CALCULATION-ARCHITECTURE.md already flags this: "RegionalSpendCalculator: Day-based; budget has no day-level data… Part A can only estimate from BudgetLine locationId"

### 2.2 UI does not adapt to project lifecycle

The project sidebar shows the same 15+ tabs regardless of whether the project is in DEVELOPMENT, PRE_PRODUCTION, PRODUCTION, or POST_PRODUCTION. A project in DEVELOPMENT has no activity days, no actuals, no expense facts — yet those tabs are visible and inviting clicks that lead to empty states.

This creates two problems:
- **Cognitive overload:** Users see capabilities they don't need yet
- **False expectations:** Users may think they need to fill in everything before they can run a Part A estimate

### 2.3 Planning and evidence share the same entry points

Locations, participants, residency, ownership, and vendors serve double duty. A producer setting up a project for a Part A application and a production accountant entering audit evidence use the same screens.

This means:
- **No "planning completeness" indicator.** The system cannot answer: "Is this project ready for a Part A submission?" because it doesn't distinguish planning inputs from evidence inputs.
- **No "evidence completeness" indicator.** Similarly for Part B.
- **Mental model mismatch.** A producer thinks "I need to set up my project for a CAVCO application." The system thinks "here are 15 tabs of data entry."

### 2.4 Activity Days is the wrong abstraction for Part A

The ActivityDay model captures:
- `personId` (required)
- `roleTypeId` (required)
- `locationId` (required)
- `activityDate` (required, specific date)
- `hoursWorked` (optional)

For a Part A planning context, the producer wants to say: "30 principal photography days in Toronto." The system requires them to specify *which person*, *which role*, *which exact date*, for each of those 30 days. This is:
- **Premature:** Cast may not be finalized
- **Tedious:** Potentially thousands of rows for a mid-size production
- **Inaccurate:** Planning-stage dates are estimates, not commitments

### 2.5 Budget annotation is the right idea, applied to one dimension only

The Eligibility tab on the budget page is well-designed: it layers compliance metadata onto financial planning data without requiring actuals. But it only covers the **expenditure** dimension. The system has no equivalent "annotation" layer for:
- Activity/shoot day planning
- Labour distribution estimates
- Regional day allocation

### 2.6 Data entry scalability

At Part B scale, a 60-day shoot with 80 crew members produces ~4,800 ActivityDay rows. The current UI is a flat table with a single-row add form using raw UUID inputs (no person picker, no role picker). This does not scale.

---

## 3. Structural Gaps

### 3.1 Missing: Activity Plan (aggregate planning for day-based data)

| What exists | What's missing |
|------------|----------------|
| ActivityDay: person × date × location × role | A way to say "N days at location X in phase Y" without specifying person or date |
| BudgetLine with locationId | Day counts — budget lines are dollars, not days |
| ProductionPhase with start/end dates | Phase-to-location day allocation |

**Conceptual shape of what's needed:** Something that captures *planned* shoot days by location and phase, without requiring person-level granularity. This would feed `ActivityDayMinimumCalculator` and `RegionalSpendCalculator` in BUDGET mode.

### 3.2 Missing: Planning completeness model

The system has `annotation-completeness` (what % of budget lines have eligibility fields populated). It does not have a broader **planning readiness** model that checks:

| Dimension | Part A readiness question |
|-----------|--------------------------|
| Budget | Is a version locked with sufficient annotation? |
| Participants | Are key creative roles assigned with residency records? |
| Ownership | Is Canadian control documented? |
| Format | Is format set? |
| Locations | Are project locations linked? |
| Activity plan | Are shoot day estimates entered? |
| Rights | Are rights/control facts documented? |
| Finance | Is the finance plan roughed in? |

A dashboard or checklist that answers "what do I still need for a Part A submission to program X?" does not exist.

### 3.3 Missing: Lifecycle-aware navigation

The sidebar/tabs do not adapt to project stage. A simple improvement: organize or filter tabs by relevance to the current stage.

| Stage | Primary tabs | Secondary / hidden |
|-------|-------------|-------------------|
| DEVELOPMENT | Metadata, Format, Finance | Budget, Participants (skeleton) |
| PRE_PRODUCTION | Budget, Eligibility, Participants, Locations, Ownership, Rights, Programs → Part A | Activity Days (hidden or minimal) |
| PRODUCTION | Activity Days, Expense Facts, Budget vs Actuals | Part A Estimate (read-only, historical) |
| POST_PRODUCTION | Expense Facts, Programs → Part B, Documents, Final reconciliation | |

### 3.4 Missing: Bulk / pattern-based entry for Part B

Even for Part B (actuals), the system lacks:
- **Bulk activity day entry:** "Copy last week's schedule" or "Person X worked M-F at Location Y"
- **Schedule import:** Parse a call sheet or production schedule
- **Template days:** Define a recurring pattern (daily schedule) and generate rows

### 3.5 Missing: Part A → Part B data flow

When a project transitions from planning to production:
- Planned shoot days by location (Activity Plan) should seed the activity day entry workflow
- Budget line annotations should carry forward to expense fact defaults
- The system should surface the delta: "You planned 30 ON days; you've logged 22 so far"

Currently, Part A and Part B data exist in separate models with no connective tissue.

### 3.6 Gap: Residency and Participants serve two masters without acknowledgment

Residency records are consumed by:
1. **Part A calculators** — to test key creative residency from budget data
2. **Part B calculators** — to test residency at the date of service from activity data

The residency UI doesn't distinguish these use cases. Nor does it prompt the user: "You've enrolled in CPTC but 3 key creatives have no residency record."

---

## 4. Risks

### 4.1 Part A adoption failure

If producers cannot efficiently prepare a Part A submission, they will fall back to Excel and manual CAVCO forms — the exact workflow StoryOS aims to replace. The system currently requires too much granular input before it can produce a Part A estimate. **This is the highest-priority risk.**

### 4.2 Data quality at scale

Without bulk entry, pattern-based input, or schedule import, Part B activity day data will be:
- Incomplete (users give up after entering a fraction of days)
- Inaccurate (batch-entered weeks after the fact)
- Inconsistent (different projects use different levels of detail)

Calculators consuming incomplete data will produce unreliable results, eroding trust.

### 4.3 User confusion at lifecycle boundaries

When a project enters PRODUCTION, users will encounter:
- Part A estimates (from budget) that are now historical
- Part B inputs (activity days, expense facts) that are new and empty
- No guidance on what to do next or how the two relate

Without clear transition UX, users will not understand that Part A estimates are superseded by Part B actuals, or that the system can show the comparison.

### 4.4 Calculator coverage gaps compound silently

Two calculators cannot run in BUDGET mode: `ActivityDayMinimumCalculator` and `RegionalSpendCalculator`. If the system marks these as NOT_EVALUATED without clear user-facing explanation, producers may submit Part A applications not realizing these requirements were skipped. The results look "green" when they're actually incomplete.

### 4.5 Annotation fatigue

Large budgets (500-800+ lines) require per-line eligibility annotation. Even with smart defaults and bulk operations (designed but not fully built), the volume is daunting. If annotation completeness stalls at 60%, Part A estimates are unreliable, and the system's value proposition weakens.

### 4.6 Duplicate entry when Part A planning data is not reused

If planned shoot day estimates, labour distribution assumptions, and location allocations live only in the producer's head (or in Excel), then:
- Part A estimates are based on incomplete system data
- Part B data entry starts from zero instead of from the plan
- The plan-vs-actual comparison that makes StoryOS valuable cannot be generated

---

## 5. Recommendations (Conceptual — Not Implementation)

### 5.1 Introduce an "Activity Plan" concept

**What:** A lightweight planning model that captures aggregate shoot day estimates by location and phase. Not person-level. Not date-level.

**Shape (conceptual):**

| Field | Example |
|-------|---------|
| Location | Toronto Studio |
| Phase | Principal Photography |
| Planned days | 30 |
| Notes | Weather contingency: +5 |

**Why:** Feeds `ActivityDayMinimumCalculator` and `RegionalSpendCalculator` in BUDGET mode. Gives producers a natural place to record what they already know during planning. Creates the bridge for plan-vs-actual tracking once ActivityDay rows arrive in Part B.

**Relationship to ActivityDay:** Activity Plan is the planning estimate. ActivityDay is the actuals evidence. They are not the same model. The system can compare them: "You planned 30 ON days; 22 logged so far."

### 5.2 Build a "Submission Readiness" dashboard

**What:** Per-program checklist that tells the user exactly what's missing before a Part A or Part B submission can be run.

**Conceptual structure:**

```
CPTC — Part A Readiness: 78%
  ✓ Budget version locked
  ✓ Format set (Feature Film)
  ✓ Canadian control documented (62% ownership)
  ⚠ Key creative residency: 4 of 6 roles have residency records
  ⚠ Budget annotation: 71% of lines annotated
  ✗ Activity plan: No shoot day estimates entered
  ✓ Rights & control: 2 facts documented
```

**Why:** Eliminates the "what do I do next?" problem. Converts the 15-tab sidebar into a guided workflow. Per-program because different programs require different data (OFTTC needs Ontario location data; FIBC needs BC; CPTC needs Canadian residency).

### 5.3 Lifecycle-aware project navigation

**What:** Reorganize the project view around what the user needs *now*, not a flat list of every capability.

**Two possible patterns:**

**A) Stage-filtered tabs:** Show/emphasize tabs relevant to the current stage. Activity Days is dimmed or collapsed during PRE_PRODUCTION. Budget annotation is highlighted.

**B) Workflow view:** Replace the tab bar with a two-column layout:
- Left: "Part A (Planning)" — budget, annotation, activity plan, participants, ownership, format, readiness checklist
- Right: "Part B (Actuals)" — activity days, expense facts, actuals reconciliation, Part B submission

This makes the mental model explicit in the UI.

### 5.4 Part B bulk entry patterns

**For Activity Days:**
- **Week view:** Grid of person × date for a given location. Click to fill. Copy previous week.
- **Schedule import:** Upload a CSV or parse a call sheet.
- **Pattern generator:** "Person X, Role Y, Location Z, Mon-Fri for 4 weeks starting [date]" → generates 20 rows.
- **Clone day:** Duplicate yesterday's roster, adjust.

**For Expense Facts:**
- "Derive from Actuals" already exists — this is the right pattern. Extend with bulk annotation of derived facts.

### 5.5 Explicit Part A → Part B transition

**What:** When a project moves from PRE_PRODUCTION to PRODUCTION (or when the user triggers it), the system should:

1. **Snapshot:** Preserve Part A estimates as a historical baseline
2. **Seed:** Pre-populate Part B entry forms from planning data (activity plan → suggested activity day structure; budget annotations → expense fact defaults)
3. **Compare:** Surface plan-vs-actual dashboards as Part B data accumulates
4. **Guide:** Show what Part B data is still missing relative to the Part A plan

### 5.6 Treat "structural" data as shared foundation, not mixed concern

Participants, residency, ownership, rights, locations, and vendors are **reference data** consumed by both Part A and Part B. They should be:

- Entered once (not duplicated per lifecycle stage)
- Surfaced in context (the readiness checklist says "3 key creatives missing residency" — clicking navigates to the person with a prompt)
- Not presented as a separate "step" in either workflow — they're prerequisites, not outputs

### 5.7 Consider the producer's real-world workflow

Today, a producer preparing a CAVCO Part A application:

1. Builds a budget in Movie Magic or Excel
2. Fills out a CAVCO Part A form (PDF or online) by manually extracting: total labour, qualifying Canadian labour, shoot days by province, key creative residency, ownership %
3. Attaches the budget as a supporting document
4. Submits

StoryOS can short-circuit steps 2-3 by:
- Accepting the budget (import or manual entry) — **already built**
- Capturing the eligibility annotations — **partially built** (Eligibility tab)
- Capturing the planning-level activity/location data — **not built** (Activity Plan gap)
- Auto-generating the form outputs from structured data — **partially built** (calculator results, but no form rendering)
- Showing exactly what's missing — **not built** (readiness dashboard)

The highest-leverage gap is the combination of **Activity Plan** + **Readiness Dashboard**. These two concepts, layered onto the existing budget annotation workflow, would make StoryOS meaningfully better than Excel for Part A preparation.

---

## Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | No aggregate planning input for activity/day-based data | **High** | Structural gap |
| 2 | UI does not adapt to project lifecycle stage | **Medium** | Navigation/UX |
| 3 | No submission readiness indicator per program | **High** | Workflow gap |
| 4 | Activity Days is audit-grade only — no planning equivalent | **High** | Abstraction mismatch |
| 5 | Part A → Part B has no connective tissue | **Medium** | Data flow gap |
| 6 | Part B entry doesn't scale (no bulk/pattern tools) | **Medium** | Scalability |
| 7 | Calculators silently skip in BUDGET mode | **Medium** | Trust/transparency |
| 8 | Shared reference data (participants, residency, etc.) lacks contextual prompting | **Low** | UX polish |
| 9 | Budget annotation fatigue at scale | **Medium** | Scalability |

**The core product problem:** StoryOS has a well-designed calculation engine that can run in both BUDGET and ACTUAL mode, but the **input layer** only has first-class support for actuals-grade data. The planning layer is partially built (budget + annotation) but missing the activity/day dimension and the "what do I need next?" guidance layer. Until those gaps close, producers cannot complete a Part A workflow entirely within StoryOS.

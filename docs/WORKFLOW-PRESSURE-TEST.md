# Workflow Pressure Test: Friction, Risks, and Adoption Gaps

**Date:** March 2026
**Status:** Product critique — no redesign
**Evaluates:** USER-WORKFLOW-DESIGN.md
**Goal:** Identify what breaks in real-world usage before we build.

---

## 1. Where Users Will Struggle the Most

### 1.1 Budget annotation is the wall

The workflow estimates 30-120 minutes for Phase 3 (Budget). Most of that is annotation — individually classifying 200-400 lines across five dimensions: person/vendor, location, phase, expense type, and labour amount.

**Why this is worse than the document suggests:**

- **Cognitive load is front-loaded.** The user just imported or entered a budget. They lock it (a conceptual shift: "done entering numbers, now classifying"). Then they face every line again, this time answering "who, where, when, what type?" for each. This is a different *mode of thinking* — not financial, but taxonomic. Most users will not have these mappings readily available.

- **The long tail is brutal.** Bulk operations handle the obvious cases: "all below-the-line crew → Toronto Studio." That covers maybe 40-60% of lines. The remaining lines are the hard ones — split locations, ambiguous expense types, lines that span phases, service contracts where the "person" is a company. The per-line effort on the tail is 5-10x higher than the bulk-resolved lines.

- **Incomplete annotation degrades silently.** A line with no person assigned is *excluded from qualifying labour*, not flagged as an error. The user doesn't see "this line is wrong" — they see a lower percentage at estimate time. The connection between "I skipped annotating line 247" and "my labour test dropped from 76% to 71%" is invisible.

- **The 312-line readiness message is demoralizing.** "312 lines need person or location" after locking a budget is not motivating — it's a wall. Readiness percentage climbing from 0% to 43% via one bulk operation is good, but from 43% to 88% is the grind. The diminishing returns on effort are real.

**What's missing in the design:** Any articulation of *how* the system helps with annotation beyond "smart defaults" and "bulk operations." These are hand-waved. The hardest UX problem in the entire product is treated as a solved sub-problem.

### 1.2 Lock-before-annotate creates undo friction

The sequence is: enter amounts → lock → annotate. But during annotation, the user commonly discovers errors: a line is miscategorized in the chart of accounts, an amount is wrong, or two lines should be merged. They cannot fix these on a locked version. They must:

1. Create a new budget version
2. Copy forward all amounts (does this happen automatically?)
3. Re-lock
4. Lose any annotations already done on the previous locked version (or do those carry forward?)

The document doesn't address version-to-version annotation portability. If annotations don't carry forward, the user re-does their hardest work. If they do carry forward, the system needs a merge strategy for lines that changed.

### 1.3 Org directory cold start

The workflow design starts with "Create Project." But for a new organization, the real first session is:

1. Add persons to the org directory (key creatives, crew leads)
2. Add locations (studio, primary shoot city)
3. Optionally add vendors

This is invisible in the workflow. Edge case 6.4 mentions it, but for many first-time users, this *is* the first experience. They create a project, see "No persons in directory," navigate away to an entirely different section (org settings), add people, navigate back. The context switch is jarring, and the readiness model can't help because it's project-scoped, not org-scoped.

---

## 2. Where the System Is Too Passive

### 2.1 Annotation should be proposed, not blank

After budget import, the system has the chart-of-accounts structure (account codes, account names, hierarchy). It also knows the project's locations and phases. It should pre-fill annotations aggressively:

- **Only one location on the project?** Every line defaults to it. The user confirms, not enters.
- **Only one phase (Principal Photography)?** Every line defaults to it.
- **Account code maps to a known expense type?** Pre-fill it. (Account 501 "Camera Rental" → EQUIPMENT is deterministic from the template.)
- **Account is in the above-the-line section?** Mark as LABOUR with the associated person if one is assigned as key creative for that role.

The workflow says the system "informs but never blocks." The problem is the inverse: **the system also never proposes.** For annotation, the correct posture is "here's what we think — correct what's wrong" rather than "here are 312 blank fields — fill them in."

### 2.2 The readiness model counts lines, but it should count dollars

"Budget annotation: 64% complete" treats a $2M above-the-line producer fee and a $150 office supply line as equally important. A user who annotates all small lines first reaches 80% readiness but has classified almost none of the qualifying expenditure.

The readiness model should weight by dollar value: "Budget annotation: $1.2M of $3.4M classified (35% of expenditure)." This is honest and actionable — it tells the user where the impact is.

### 2.3 No "what-if" mode before full data entry

The system delays all substantive feedback until Phase 5 (Run Estimate). Before that, the only signal is readiness percentage — a completeness metric, not a *qualification* metric. The user has no idea if they're trending toward passing or failing until they've done all the work.

The system could provide lightweight directional signals earlier:

- After ownership entry: "Canadian control: 62% — this meets the CPTC threshold of 50%+." Immediate win.
- After key creative roles + residency: "Key creative points: 8/10 — CPTC requires 6. Passing." Immediate win.
- After partial budget annotation (even 30%): "Based on classified lines so far, Canadian labour is trending at 78% (CPTC threshold: 75%). This could change as more lines are classified."

These aren't full estimates — they're directional signals from *the data already entered*. The readiness model knows the requirement thresholds. Using them for early feedback turns data entry from a chore into a conversation.

### 2.4 Activity Plan is orphaned in the workflow

The Activity Plan is introduced as Phase 4, after budget annotation. But the *reason* to enter it is buried in calculator architecture. The readiness model tells the user "no shoot day estimates entered — OFTTC requires Ontario day minimums," but this is passive. The user has to:

1. Understand that "shoot day estimates" are a separate concept from budget
2. Navigate to a separate domain to enter them
3. Trust that 3 rows of data are worth their time

The system should be more directive: when the user finishes (or gets deep into) budget annotation, and Activity Plan entries are empty, the system should actively surface it: "You've assigned 147 budget lines to Ontario locations. How many principal photography days do you plan to shoot there? OFTTC uses this to assess your Ontario day minimum."

This connects the abstract concept to something the user just did (budget annotation with locations) and to a concrete program outcome (OFTTC day minimum).

---

## 3. Does Activity Plan Feel Natural?

**Short answer: it depends on the user and the program.**

### When it feels natural

- **OFTTC/FIBC users:** These programs have explicit day-minimum requirements. The producer already thinks in shoot days when planning these applications. "25 days in Ontario" is a number they know.
- **Producers who have a production schedule:** If they've already planned their shoot, entering planned days per location per phase is fast. It's literally reading off their stripboard.

### When it feels like an extra step

- **CPTC-only users:** CPTC does not have a day-minimum requirement. The Activity Plan exists to feed `ActivityDayMinimumCalculator` and `RegionalSpendCalculator`, neither of which is a standard CPTC requirement. For these users, the readiness model *should not ask for it* (since no enrolled program has requirements in those categories). But if they later add OFTTC, it suddenly appears as a gap. The timing feels arbitrary.

- **Users who just annotated location on every budget line:** They already told the system "this money is being spent at Toronto Studio." Now the system asks "how many days are you shooting at Toronto Studio?" The user may feel this is redundant — they think of location as one concept, not two (location-of-spend vs location-of-activity).

- **Users who don't have a production schedule yet:** At Part A stage, some producers have only a rough sense of shoot duration. "Around 30 days, mostly in Ontario" is what they know. The Activity Plan asks for location × phase × days — more precision than they have. They'll enter a guess, which is fine, but the system presents it with the same confidence as their carefully entered budget.

### The core tension

Activity Plan captures a genuinely different dimension (time, not money) and is necessary for specific calculators. But it introduces a new concept that doesn't map to any existing document the producer has (unlike the budget, which maps to their Movie Magic file, or participants, which map to their deal memos). It's the one planning input that exists *only because the calculator needs it*, not because the producer was going to track it independently.

This isn't a reason to remove it. It's a reason to surface it contextually (tied to the programs that need it) rather than as a standalone workflow phase.

---

## 4. Is There a Clear Moment of Value?

### The current design's value timeline

| Elapsed time | What the user has done | What they've gotten back |
|-------------|----------------------|------------------------|
| 2 min | Created project, set format | Readiness view: 5% complete |
| 15 min | Added locations, phases, participants | Readiness: 20% complete |
| 30 min | Added residency, ownership | Readiness: 35% complete |
| 60 min | Imported and locked budget | Readiness: 40% complete, "begin annotation" |
| 120 min | Annotated 80% of lines | Readiness: 75% complete |
| 130 min | Entered activity plan | Readiness: 80% complete |
| 135 min | Ran estimate | **First substantive output: pass/fail per requirement** |

**The problem:** For 135 minutes, the only feedback is a progress bar. The user is investing significant effort on faith that the payoff is worth it. The readiness percentage is not *value* — it's a measure of how much work they've done, not how their project is performing.

### Where value could come earlier

**Minute 15 — after participants + residency + ownership:** The system can already evaluate three requirements (Key Creative Test, Residency Test, Canadian Control). These are structural tests that don't depend on budget data. Running them immediately and showing results gives the user a concrete win in 15 minutes:

> "Based on what you've entered: Key creative test — Passing (8/10 points). Canadian control — Passing (62%). Residency — 4 of 6 key creatives confirmed Canadian."

This is real output — not readiness, but *assessment*. The user has learned something about their project's eligibility before entering a single dollar.

**Minute 60 — after budget import (pre-annotation):** Even unannotated, the budget has total amounts by account. The system can compute a rough expenditure threshold: "Total budget: $4.2M. CPTC minimum eligible expenditure: $1M. Your total budget exceeds the threshold — detailed breakdown requires annotation."

This is a weak signal, but it confirms the project is in the right ballpark.

**Minute 90 — after partial annotation (40-50%):** A directional labour percentage based on annotated lines: "Of $1.8M classified so far, $1.4M (78%) is Canadian-resident labour. CPTC threshold: 75%. Trending above." This is genuinely useful — it tells the user if their annotation effort is heading in the right direction.

### The risk of delayed value

If the first real output comes at 135 minutes, users who are unsure about the product will not reach it. They'll spend 30-60 minutes, see nothing but a progress bar, and leave. The "moment of value" needs to be under 20 minutes — ideally at the point where structural tests (which need no budget data) can run.

---

## 5. Top 3 UX Risks

### Risk 1: Annotation fatigue causes abandonment

**What happens:** The user imports a 300-line budget, locks it, sees "0% annotated," and faces a data entry marathon. Even with bulk operations, the per-line work for the long tail is tedious. After 40 minutes of annotating, they're at 65% and slowing down. The remaining lines are ambiguous. They stop.

**Why it's dangerous:** Annotation is the gateway to all expenditure-based calculators (Labour, Expenditure Threshold, Vendor Eligibility). A project with an unannotated budget produces useless Part A results. If the user abandons annotation, the entire workflow fails.

**What makes it worse:** The system offers no proposal, no pre-fill, no inference. Every field starts blank. The burden of classification is entirely on the user.

**Severity: Critical.** This is the most likely single point of failure in the entire product. Budget annotation effort is the #1 predictor of whether a user completes a Part A estimate.

**Mitigation direction (not a redesign):** The system should propose annotations aggressively (using account structure, template mappings, and project context) and let the user *correct*, not *create*. The cognitive effort of verifying "yes, this is right" is 10x lower than "what should this be?"

### Risk 2: No early payoff drives skepticism

**What happens:** A new user spends 30 minutes entering structural data (participants, residency, ownership). The readiness model says "35% complete." They don't know if their project qualifies. They don't know if this tool is useful. They're being asked to do more work before they'll find out.

**Why it's dangerous:** Trust in a new product is built in the first session. If that session is pure data entry with no output, the user has no reason to believe the eventual estimate will be accurate, useful, or worth the effort. They compare it to calling their accountant ("she'd just tell me if we qualify").

**What makes it worse:** The readiness model is completeness-focused, not outcome-focused. "35% complete" says nothing about qualification likelihood.

**Severity: High.** This primarily affects new users and trial/evaluation scenarios. Experienced users who trust the tool will push through; new users won't.

**Mitigation direction:** Run partial assessments on non-budget requirements as soon as data permits. Show the user real pass/fail results for structural tests within the first 20 minutes. "Key creative: Passing. Canadian control: Passing. Labour: needs budget annotation." Two greens and one gray is more motivating than "35%."

### Risk 3: The annotation-to-estimate feedback loop is too slow

**What happens:** The user annotates 200 lines, runs an estimate, discovers "only 71% of labour qualifies — need 75%." They need to find the lines dragging the percentage down. They go back to annotation, try to fix some, re-run, see 73%. Still not passing. They adjust more lines, re-run, 74.5%. Getting closer, but each iteration takes 10-15 minutes because the round trip is: navigate to budget → find problem lines → change annotation → navigate back → re-run estimate → find the result → check if it changed.

**Why it's dangerous:** This iterate-to-pass loop is where the user is most engaged (they can see the gap, they know what to fix) and most frustrated (the tools are slow, the round trip is long). If each iteration takes 15 minutes and they need 4-5 iterations, that's over an hour of post-estimate tweaking — after they've already spent 2 hours on initial data entry.

**What makes it worse:** The estimate results say "71% qualifying labour" but don't say *which lines* are pulling the number down. The user has to reverse-engineer the calculator's logic by examining individual line annotations. The connection between "line 247 is assigned to a non-resident" and "your percentage dropped" is not surfaced.

**Severity: High.** This affects every user who doesn't pass on the first estimate (which will be most users). The quality of the iteration experience determines whether users finish or give up.

**Mitigation direction:** The estimate results need line-level attribution: "These 23 lines ($420K) are excluded because the assigned person has no Canadian residency on file." This turns a blind search into a targeted fix. The user clicks through to those 23 lines, corrects the annotation, and re-runs with confidence.

---

## 6. Additional Friction Points (Lower Severity)

### 6.1 Intent declaration vs formal enrollment is confusing

The workflow has two moments where the user selects programs: at creation ("which programs are you targeting?" — intent) and at Phase 5a ("enroll in programs" — formal). The distinction between intent and enrollment is clear in the architecture but opaque to the user. They'll ask: "Didn't I already pick CPTC?"

The system needs to either collapse these into one step (selection at creation *is* enrollment) or make the distinction extremely clear ("You indicated interest in CPTC. Ready to formally begin your application?").

### 6.2 Multi-program readiness can overwhelm

A user targeting CPTC + OFTTC + FIBC sees readiness computed across all three programs. Each program has 10-12 requirements. The readiness home could show 30+ items. Even with deduplication (same gap for multiple programs), this is noisy.

The risk is information overload — the user can't distinguish "this matters for all three programs" from "this only matters for FIBC." The design addresses this with program badges on each gap, but the visual weight of 20+ readiness items on first load is a problem.

### 6.3 Budget version management adds conceptual overhead

For a novice, "lock version" is an unfamiliar concept. They don't understand why they can't just annotate a draft budget. The lock mechanism exists for good architectural reasons (financial immutability, audit trail), but it introduces a step that doesn't map to the producer's mental model. They think: "I entered my budget. Now let me tag which lines go where." The system says: "First, freeze it."

### 6.4 Readiness-to-domain navigation may strand the user

The loop is: Readiness → click gap → navigate to domain → do work → return to Readiness. But "return to Readiness" requires explicit navigation. If the user gets deep into budget annotation (which is a long session), they may forget the readiness view exists. They're now in Lens 2 (domain view) and staying there. The readiness model, which is the orchestrator, loses its role.

### 6.5 Activity Plan precision vs user knowledge

Activity Plan asks for location × phase × days. Some users know "about 30 shoot days total" but can't break it down by location or phase. If the input requires all three dimensions, it's more precise than the user's knowledge. If it allows "30 days, unallocated," the calculators can't filter by location or phase.

This is a genuine tension between usability (accept what the user knows) and calculator requirements (need location-level attribution). The design doesn't address how to handle approximate inputs.

---

## 7. Summary: The Three Things That Will Break

| # | Risk | Why it matters | Who it affects |
|---|------|---------------|---------------|
| **1** | **Annotation fatigue** | 200-400 lines × 5 fields, no system proposals, long tail of ambiguous lines. The single largest effort in the workflow and the most likely abandonment point. | Everyone. This is the critical path. |
| **2** | **No early payoff** | 135 minutes of data entry before first substantive output. Readiness % is not value — it's a progress bar. New users won't trust the tool on faith alone. | New users, trial evaluators, skeptical adopters. |
| **3** | **Slow iterate-to-pass loop** | After the estimate, fixing gaps requires long round trips with no line-level attribution. Users who are closest to passing (and most motivated) face the most friction. | Every user who doesn't pass on first run. |

Everything else in the workflow design is sound. The readiness model, the three-lens navigation, the no-gates philosophy, the program-agnostic planning layer — these are correct. The risks above are not architectural flaws; they're **effort and feedback gaps** in the highest-friction parts of the user journey.

# MeCaX (incentives-app) — Current App State (Code-Grounded)

This document describes the **actual** behavior and structure of the codebase as of the repository state it was generated from. Section headings match the requested structure.

---

## 1. App Overview

### What the app is intended to do (from code)

- **Film/TV incentive estimation UI**: Users enter a **project name**, **production province**, **rich metadata** (`meta`), **calculation options** (`opts`), and **budget line items** (`lines`). The app computes **provincial credit estimates**, optional **post-production add-ons** (AB PPG-style, BC DAVE-style), a flat **CMF/Telefilm** dollar input, and a **simplified federal CPTC-style** estimate. Results are shown in currency (CAD) on `ResultsScreen`.
- **“Funding readiness” heuristic**: `hooks/useScore.js` produces a **0–100 score** and hints from metadata completeness, labour share, regional day data, and demographic toggles—not from government rules.
- **Authentication & profile**: Email/password auth via Supabase (`context/AuthContext.js`, `lib/supabase.ts`), with optional email confirmation flows (`screens/ConfirmationPendingScreen.js`). User profile rows in Supabase `profiles` (`lib/profiles.ts`) with `full_name`, `organization_name`, `role`, `notes`.
- **Local project persistence**: Saving writes append-only records to AsyncStorage (`storage/projects.js`, `context/AppContext.js`).

### Main user flows implemented today

1. **Anonymous or signed-in home**  
   - `App.js` → `AppNavigator`: `initialRouteName` is `Auth` if `isAnonymous`, else `Welcome` (`useAuth().isAnonymous`).  
   - `WelcomeScreen`: project name field; **New Project** → `Metadata`; **Open Saved Projects** → `Projects`; auth users see **Account**; anonymous users see optional **Account** + login/register.

2. **Project / calculator flow (primary)**  
   - `Welcome` → `Metadata` → **Next: Options** → `Options` → **Next: Line Items** → `Lines` → **Next: Results** → `Results`.  
   - `Province` exists as a separate screen (`ProvinceScreen`) and is reachable from metadata’s footprint section (“Set Province”) and is in the stack; the **default** path from `Metadata` goes **directly to Options**, not through `Province` first.  
   - `Lines` → `EditLine` to add/edit a line; **Next: Results** does not require non-zero amounts.

3. **Results follow-ups**  
   - `Results` → `ReadinessDetails` (tap card); `Results` → `Advisor` (“Ask AI Advisor”).  
   - `AdvisorScreen` is explicitly a **preview** that repeats numbers; it does not call an AI API.

4. **Save / load**  
   - `Results` and `Projects` can call `saveCurrentProject` (AsyncStorage append).  
   - `ProjectsScreen`: list tap / Open loads project and navigates to `Welcome` (not back into the wizard).

5. **Exit project**  
   - Project-related stack screens (`App.js`) expose header **Home** → `confirmExitProject(navigation)` in `AppContext`: if `isDirty`, alert **Save & Exit** / **Discard & Exit** / **Cancel**; else `navigation.reset` to `Welcome`.

### Entry points, routes, navigation structure

- **Navigator**: Single native stack in `App.js` (`createNativeStackNavigator`).
- **Screen names (exact)**:  
  `Auth`, `Login`, `Register`, `ConfirmationPending`, `ForgotPassword`, `Welcome`, `Account`, `ProfileSetup`, `ProjectInfo`, `Metadata`, `Province`, `Lines`, `EditLine`, `Options`, `Results`, `Projects`, `Advisor`, `ReadinessDetails`.
- **Global options**: `screenOptions={{ headerTitle: 'MeCaX', headerTitleAlign: 'center' }}`; `Auth` hides header; project screens add `headerRight: Home`.
- **`NavigationContainer` key**: `key={isAnonymous ? 'anon' : 'auth'}` remounts the tree on auth mode flip.

---

## 2. Feature Inventory (Concrete)

| Feature | What it does | Where | Status |
|--------|----------------|------|--------|
| Auth landing | Login / Create account only | `screens/AuthLandingScreen.js` | Fully wired |
| Email/password login | Supabase `signInWithPassword` | `screens/LoginScreen.js`, `AuthContext.js` | Implemented |
| Registration | Sign up + optional profile upsert if session exists | `screens/RegisterScreen.js` | Implemented |
| Email confirmation pending | Resend + go to login | `screens/ConfirmationPendingScreen.js` | Implemented |
| Password reset | `resetPasswordForEmail` | `screens/ForgotPasswordScreen.js` | Implemented |
| Session restore + deep links | `getSession`, `onAuthStateChange`, `Linking` + code exchange | `AuthContext.js` | Implemented (see risks for `exchangeCodeForSession` usage) |
| Anonymous mode | `getOrCreateAnonId` when no Supabase session | `auth/anonId.js`, `AuthContext.js` | Implemented |
| User profile CRUD | Supabase `profiles` table | `lib/profiles.ts`, `AccountScreen`, `ProfileSetupScreen`, `RegisterScreen` | Implemented; **role enum mismatch** with some pickers (see §7) |
| Welcome hub | Project name + navigation | `screens/WelcomeScreen.js` | Implemented |
| Metadata capture | Format, genre, production type, synopsis, scale, demographics, ownership, copyright, footprint, province selector | `screens/MetadataScreen.js` | Implemented (large form) |
| Province picker (standalone) | Picker + reset opts on change | `screens/ProvinceScreen.js` | Implemented |
| Project info (alternate form) | Overlaps with metadata: name, format, genre, etc. | `screens/ProjectInfoScreen.js` | **Registered in stack only** — **no `navigation.navigate('ProjectInfo')` found** → effectively **unreachable** from UI |
| Calculation options | CMF, regional days, ON stream, BC toggles, AB post grant | `screens/OptionsScreen.js` | Implemented |
| Line list / edit | CRUD lines | `screens/LinesScreen.js`, `screens/EditLineScreen.js` | Implemented |
| Results | Currency summary + credits | `screens/ResultsScreen.js`, `hooks/useCalc.js` | Implemented; **duplicate UI line** for AB post (see §7) |
| Readiness score | Heuristic score + hints | `hooks/useScore.js`, `ReadinessDetailsScreen.js` | Implemented (not regulatory) |
| AI Advisor | Static “preview” copy + numbers | `screens/AdvisorScreen.js` | **Stub** — no AI, no `WebView` usage here |
| Save project | Append to AsyncStorage | `storage/projects.js`, `saveCurrentProject` in `AppContext.js` | Implemented; **always creates new storage row** (no update) |
| Load/delete projects | List from storage | `screens/ProjectsScreen.js` | Load/delete implemented |
| Dirty tracking + exit | Wrapped setters + Home confirmation | `AppContext.js`, `App.js` header | Implemented |
| Form keyboard UX | Shared wrapper | `components/FormScreen.js` | Implemented on many screens |
| Profile setup screen | Guided profile | `screens/ProfileSetupScreen.js` | **Registered** but **no navigation to `ProfileSetup` in code** → **unreachable** unless manually navigated |
| Animated welcome/results | Moti-based variants | `screens/WelcomeScreenAnimated.js`, `screens/ResultsScreenAnimated.js` | **Not registered in `App.js`** → **unused**; `WelcomeScreenAnimated` imports `moti` which is **not** in `package.json` |
| Tests | Province calculators | `__tests__/useCalc.test.ts`, `__tests__/credits/*.test.ts` | Present |

---

## 3. Data Model (Actual)

### Core in-memory app state (`AppContext.js`)

Defined as React `useState` with defaults `DEFAULT_*`:

| Field | Shape (as used) | Purpose |
|-------|------------------|--------|
| `projectName` | `string` | Display + saved `name` |
| `province` | `string` | Selected production province (`''` or `AB`/`ON`/…) |
| `lines` | `Array<{ id, type, category, province, amount, activity? }>` | Budget lines; `activity` used for post/VFX (`EditLineScreen`) |
| `opts` | Object (see `DEFAULT_OPTS`) | CMF, AB post, ON stream, MB/BC toggles, `totalDays`, `daysProvincial`, `daysDistant` |
| `meta` | Object (see `DEFAULT_META`) | Format, genre, footprint, copyright, demographics, etc. |
| `projects` | Array of flattened saved rows | From AsyncStorage mapping |
| `activeProjectId` | `string \| null` | Last loaded/saved storage id (note: save always generates **new** id in `storage/projects.js`) |
| `isDirty` | `boolean` | Set by wrapped `setMeta`/`setOpts`/`setLines`/`setProjectName`/`setProvince` |
| `lastSavedProject` | object \| null | Snapshot for discard/restore |

**Wrapped setters** (`setProvince`, `setProjectName`, `setLines`, `setOpts`, `setMeta`) call `markDirty()` unless `withDirtySuppressed` is used (`loadProject`, `resetProject`).

### Persisted project payload (`buildCurrentProject` in `AppContext.js`)

```text
{ id, name, province, lines, opts, meta, createdAt, updatedAt }
```

Saved inside AsyncStorage item as `data: project` (`storage/projects.js`).

### Profile type (`lib/profiles.ts`)

`ProfileRow`: `id`, `email?`, `full_name?`, `organization_name?`, `role?: 'Student' | 'Producer' | 'Other'`, `notes?`, `updated_at?`.

### Line item type (implicit)

From `LinesScreen` default line and `credits/prov/*.ts` `Line` types:

- `id`: number (timestamp)
- `type`: `'Labour' | 'Non-Labour'` (from `constants/lists.js`)
- `category`: string including `'Post-Production'`
- `province`: string
- `amount`: number
- `activity`: optional string (e.g. `VFX_Animation`) for post credit filters

### Data flow (input → state → processing → output)

1. **Input**: Screens call `useApp()` setters → updates `province` / `lines` / `opts` / `meta` / `projectName`.
2. **Processing**: `useCalc(lines, province, opts, meta)` (`hooks/useCalc.js`) sums amounts, calls `calcAB`/`calcON`/`calcMB`/`calcBC`, then applies assistance + CPTC block.
3. **Output**: `ResultsScreen` / `AdvisorScreen` display currency strings via `toLocaleString('en-CA', { currency: 'CAD' })`.
4. **Readiness**: `useScore({ meta, lines, province, opts })` reads same state; **does not** feed back into `useCalc`.

### Mismatches / inconsistencies

- **`AdvisorScreen`** calls `useCalc(lines, province, opts)` **without** `meta` → fourth parameter defaults to `{}`. **AB** `calcAB` then sees empty `meta` (ownership/copyright checks weakened vs `ResultsScreen` which passes `meta`).
- **`ProjectInfoScreen`** edits `projectName` via `useApp().setProjectName` and `meta` via `setMeta`; **`MetadataScreen`** also edits `meta` and shows `projectName` read-only at top — two parallel UIs for overlapping concepts; `ProjectInfo` is not linked from navigation.
- **`RegisterScreen` / `AccountScreen`** Pickers include roles **Faculty**, **Accountant** while `lib/profiles.ts` types only **`Student` | `Producer` | `Other`** — runtime upsert may **reject or coerce** depending on DB constraint (code allows sending non-typed values via cast).
- **`saveCurrentProject`**: `buildCurrentProject(activeProjectId || Date.now())` puts a numeric-ish `id` inside snapshot, but `storage/projects.js` assigns a **new string id** for the list item — **duplicates** on repeated saves, no “update existing”.
- **`MetadataScreen`** uses both `setMeta` and `setMeta` / `setOpts` from context and **`setMeta` from `useApp` is the wrapped one**; inner `set({ ... })` uses functional updates — OK. Some sections use `setMeta` with name `setMeta` shadowing — file uses `setMeta` from props of `useApp` as `set` for one helper — verify: actually `const set = (patch) => setMeta({ ...meta, ...patch });` uses context `setMeta` — dirty marked.

---

## 4. Calculation / Estimation Logic

### Where logic lives

- **Orchestrator**: `hooks/useCalc.js` — function named `useCalc` but implemented as a **pure function** (not a React hook); imported and called like `useCalc(...)`.
- **Provincial modules**:  
  - `credits/prov/ab.ts` → `calcAB`  
  - `credits/prov/on.ts` → `calcON`  
  - `credits/prov/mb.ts` → `calcMB`  
  - `credits/prov/bc.ts` → `calcBC` (returns `{ core, dave }`)
- **Rates constant (duplicate)**: `PROV_RATES` in `hooks/useCalc.js` (with comment “TODO verify”); **not** the same object as `PROV_RATES` in `App.js` (top-level, **unused** by `AppNavigator` / providers).

### Inputs used (by `useCalc`)

- **Always**: `lines`, `province`, `opts`, `meta` (optional; defaults `{}`).
- **Line aggregates**:  
  - `total` = sum of all `amount`  
  - `labour` = sum where `type === 'Labour'`  
  - `nonlabour` = `total - labour`  
  - `canadaLabour` = labour lines where `province` ∈ `['AB','BC','MB','ON']`  
  - `provLabour`, `provPostLabour` computed in `useCalc` but **provincial amounts come from province modules**, not these intermediate variables (some intermediate vars are unused for credit math).
- **Per province** (inside modules): labour filtered by `l.province === province`, post detection via `/post/i.test(category)`, VFX filter `activity === 'VFX_Animation'` when `activity` present.
- **AB-specific** (`calcAB`): uses `meta.provincialOwnershipPercent`, `meta.copyright.holderName`, `meta.copyright.jurisdiction.province`, line-based spend/labour shares, and **opts** `totalDays`, `daysProvincial`, `daysDistant` for rural proxy.
- **ON** (`calcON`): `opts.onStream` (`OPSTC` vs `OCASE`), `opts.totalDays`, `daysProvincial`, `daysDistant`, toggles `onOutsideGTA`, `onOutsideEntireGTA` when no day weights.
- **BC** (`calcBC`): same day pattern + `opts.bcRegionalOn`, `bcDistantOn`, `bcDaveOn`.
- **MB** (`calcMB`): day-weighted or `mbRuralOn`, `mbNorthernOn`, `mbOwnershipOn`.

### Formulas (derived from code)

**Provincial (examples)**  
- **AB** (`calcAB`): Rate `0.22` or `0.30` on **AB labour only**; `0.30` if “controlled” (ownership ≥50%, copyright province AB, producer/copyright heuristic) **OR** rural share `(daysProvincial + daysDistant)/totalDays ≥ 0.75`.  
- **ON OPSTC**: `provLabour * (0.35 + tier1 + tier2)` where tiers use day weights or boolean flags as in `on.ts`.  
- **ON OCASE**: `postVfxLab * 0.35`.  
- **BC core**: `bcLabour * 0.35` + regional/distant components on labour + toggles; **DAVE**: `bcPostVfxLab * 0.16` if `bcDaveOn`.  
- **MB**: `mbLabour * (0.45 + bonus rates)`.

**Assistance (in `useCalc`)**  
- **AB Post (PPG-style)**: If `province === 'AB' && opts.abPostOn`: eligible base = sum of **AB labour** in post category; `min(eligible * abPostRatePct/100, abPostCap)`.  
- **BC DAVE**: taken from `calcBC` `dave.amount`, added to `postAssist`.  
- **CMF**: if `opts.cmfOn`, flat `opts.cmfAmount`.

**CPTC-style block (simplified)**  
```text
totalAssistance = provincialCredit + postAssist + cmf
netProd = max(total - totalAssistance, 0)
labourShare = labour / total (0 if total 0)
labourAssistance = totalAssistance * labourShare
cptcEligibleLabour = max(canadaLabour - labourAssistance, 0)
cptcBase = min(cptcEligibleLabour, 0.60 * netProd)
cptc = 0.25 * cptcBase
totalCredits = provincialCredit + postAssist + cmf + cptc
effectiveCost = max(total - totalCredits, 0)
```

### Outputs

Object returned from `useCalc`:  
`totals`, `provincialCredit`, `provincialDetail`, `abPost`, `bcDave`, `bcDaveDetail`, `cmf`, `cptc`, `totalCredits`, `effectiveCost`.

### Limitations / simplifications (explicit in code)

- Comment in `useCalc.js`: rates are **placeholders; TODO verify before launch**.
- CPTC is a **rough stacking model**, not a full federal rules engine.
- **Province `"Other"`**: provincial credit path returns 0; CPTC may still apply via `canadaLabour`.
- Many **metadata fields** (demographics, footprint percentages) **do not** affect `useCalc` — only `useScore` / AB calc partially uses `meta`.

---

## 5. State Management & Persistence

### State management

- **Global app data**: `React.createContext` — `AppProvider` in `context/AppContext.js`; consumers use `useApp()`.
- **Auth + profile**: `AuthProvider` in `context/AuthContext.js`; `useAuth()`.
- **Local component state**: Various screens (`useState` for forms, `EditLine` draft, etc.).
- **`App.js` default export**: Declares **additional** `useState` for `province`, `lines`, `opts`, `projectName` and `store` object — **never passed to `AppProvider`** → **dead / misleading**; real source of truth is `AppContext`.

### Persistence

| Mechanism | Key / API | What persists |
|-----------|-----------|----------------|
| AsyncStorage | `mecax.projects` (`storage/projects.js`) | Append-only list of `{ id, createdAt, data: fullProjectSnapshot }` |
| AsyncStorage | `mecax.userId` (`auth/anonId.js`) | Anonymous id |
| AsyncStorage | Supabase session | Via `lib/supabase.ts` `auth.storage: AsyncStorage` |

### Survives app restart vs not

- **Survives**: Saved projects list; Supabase session (if configured); anonymous id.  
- **Does not survive** (unless saved): In-memory `projectName`, `province`, `lines`, `opts`, `meta`, `isDirty` — lost on process kill unless user saved (and even then, **loading** from list is manual via `Projects`).

---

## 6. API / External Dependencies

### Backend / API

- **Supabase** (`@supabase/supabase-js`): Auth (`signIn`, `signUp`, `resetPasswordForEmail`, `resend`, session), and `profiles` table read/upsert (`lib/profiles.ts`). URL/key from `app.json` extra / env (`lib/supabase.ts`). If misconfigured, `supabase` is `null` and auth falls back to anonymous.

### Not used as live APIs in app flow

- **No** REST/GraphQL client for incentives data.  
- **No** OpenAI/LLM calls — Advisor is static text.

### Third-party libraries (from `package.json`) and roles

| Library | Use in app |
|---------|------------|
| `expo`, `expo-linear-gradient`, `expo-linking`, `expo-status-bar`, `expo-updates` | App shell, gradients, auth redirects, OTA |
| `@react-navigation/native`, `@react-navigation/native-stack` | Navigation |
| `@react-native-async-storage/async-storage` | Projects + Supabase session + anon id |
| `@supabase/supabase-js` | Auth + profiles |
| `@react-native-picker/picker` | Pickers on some screens |
| `react-native-modal-selector` | Metadata selectors |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-safe-area-context` | RN navigation / gestures |
| `react-native-webview` | Dependency present; **no screen reviewed uses it for advisor** |

---

## 7. Incomplete / Broken Areas

- **`ProjectInfo` screen**: In stack, **no incoming navigation** → dead feature in practice.
- **`ProfileSetup` screen**: Registered, **no navigation** from `Welcome` / `Account` → unreachable.
- **`WelcomeScreenAnimated` / `ResultsScreenAnimated`**: Not in navigator; `moti` import without `moti` in `package.json` → would break if wired without adding dependency.
- **`App.js`**: Unused `PROV_RATES`, `PROVINCES`, `TYPES`, `CATS`, duplicate local state — clutter / confusion.
- **`ResultsScreen.js`**: **Duplicate** `<Text>Post-Production Credit (AB PPG)`** block (lines 153–162 area) — same content twice.
- **`AdvisorScreen`**: Missing `meta` in `useCalc` → **inconsistent AB** vs Results.
- **`AuthContext`**: `exchangeCodeForSession(code)` is called with **parsed `code` string**; if the Supabase client expects `{ authCode }` object (version-dependent), deep link completion may fail — needs verification against installed `@supabase/supabase-js` version.
- **Save model**: Cannot “update” a project in storage; repeated saves **duplicate** entries; `activeProjectId` updated to latest save id but old rows remain.
- **Role values**: UI allows roles not in `ProfileRow` TypeScript union — potential DB or type mismatch.

### TODOs / placeholders

- `hooks/useCalc.js`: “TODO verify before launch” on rates.  
- `App.js`: comment “Very rough placeholder rates”.  
- `AdvisorScreen`: “Next step we’ll add AI suggestions.”

---

## 8. Gaps vs Intended Goal (“User inputs project data and receives a tax credit estimate”)

The **happy path exists**: Metadata → Options → Lines → Results shows **a** credit estimate. Gaps relative to a credible “tax credit estimate” product:

### Missing or weak inputs vs real programs

- No structured capture of many real eligibility drivers (company type, treaty copro, treaty copro limits, timing of expenditures, qualified labour definition, caps per credit, interaction rules between credits, etc.) — only a subset in `meta`/`opts` and **most `meta` ignored by `useCalc`**.
- **Federal CPTC** in code is a **toy stacking formula**, not CRA/program rules.
- **Provincial modules** use **fixed percentages** with comments that they are placeholders — not tied to statute/regulation versions.

### Missing calculations

- No **provincial non-refundable vs refundable** distinction, no **per-year amortization**, no **stacking order** beyond the single `useCalc` formula.
- **`province === 'Other'`** → no provincial credit path (by design in switch default).
- **Metadata footprint** (`meta.footprint`) fields are largely **not consumed** by `useCalc` (AB uses opts days + line sums; not the rich footprint object from metadata UI).

### Missing flows

- No guided “first-time” flow that forces **province** before options (user can skip `Province` screen if they use Metadata → Options only).
- No **export** (PDF/email) of estimate.
- No **server-side** persistence of projects per user (only local AsyncStorage; Supabase used for profile only).
- **Load project** returns to `Welcome`, not to **Results** — user must re-walk wizard to see estimate unless they navigate manually.

---

## 9. Risks / Constraints

- **Dual sources of truth risk**: `App.js` dead state vs `AppContext` real state confuses future contributors.
- **Tight coupling**: `useCalc` is a large monolith; province logic split across files but CPTC/assistance stacking is embedded only in `useCalc.js`.
- **Storage append-only**: Will accumulate duplicate projects; complicates v1 “my projects” UX and sync.
- **Navigation + dirty**: `confirmExitProject` uses `saveCurrentProject` which **always appends** — “Save & Exit” may not mean “update my project” in user’s mind.
- **Auth container remount**: `key={isAnonymous ? 'anon' : 'auth'}` resets navigation stack on login/logout — intentional but can surprise if mid-project.
- **Hard to extend**: Adding a new province requires new `credits/prov` module + switch branch + tests; metadata fields need explicit wiring into calcs or they stay cosmetic.
- **TypeScript/JavaScript mix**: Credit logic in `.ts`, app mostly `.js` — no generated DB types for Supabase in app.
- **Expo / EAS**: `app.json` / `eas.json` exist; production behavior depends on correct Supabase redirect URLs (documented separately in `AUTH_FLOW.md`, not repeated here).

---

*End of document.*

# **1 SYSTEM RULES**

## **1.1 Definitive Calculation Order**

Calculations MUST execute strictly in the following chronological sequence. Federal credits MUST ALWAYS be calculated last, as they act as the ultimate systemic offset.

1. Base Initialization (Gross Labour, Gross Total Cost, Gross QPE)
2. Ineligible Cost Deduction (Fringes, specific exclusions)
3. Direct Assistance Deduction (Regional/Federal Grants)
4. Provincial Tax Credit Calculation (Applies to Provincial Base)
5. Federal Tax Credit Calculation (Applies to Federal Base; deducts Assistance AND Provincial Credit)

## **1.2 Definition of "Assistance"**

A funding source isassistance  true IF it is:

- Direct non-repayable grant or subsidy  
- Forgivable loan  
- Crowdsourcing (tiered, non-equity)  
- Sponsorship (non-market value)  
- Non-bona fide loan  
- Provincial tax credit (ONLY when evaluating Federal base)

A funding source isassistance  false (Exempt) IF it is:

- Bona fide commercial loan  
- Equity investment  
- Licence fee / Pre-sale / Minimum Guarantee

## **1.3 What Grinds What (Explicit Rules)**

- Regional Grants  Grinds Provincial Base AND Federal Base  
- Provincial Credits  Grinds Federal Base ONLY  
- Federal Credits  Statutorily exempt from being considered assistance; does not reduce the base of any other provincial or federal program.  
- Exempt Sources  Does not reduce the base of any program.

## **1.4 CMF / Telefilm Treatment**

The default system assumption for Canada Media Fund (CMF) and Telefilm funding is that they are exempt and do NOT constitute assistance.

- CMF / Telefilm Equity Investment: isassistance  false (Default: No Grind)  
- CMF Licence Fee Top-up: isassistance  false (Default: No Grind)  
- *Exception:* CMF / Telefilm Non-Recoupable Grant: isassistance  true (Triggers Grind)  
- *Exception:* For the federal PSTC specifically, CMF Licence Fee Top-ups are uniquely evaluated as assistance.1

# **2 GRINDING MATRIX**


| Source Type                   | Grinds Provincial | Grinds Federal | Notes                                      |
| ----------------------------- | ----------------- | -------------- | ------------------------------------------ |
| Regional Grants (e.g., NOHFC) | Yes               | Yes            | Treated as direct assistance               |
| Provincial Tax Credits        | No                | Yes            | Defines the core federal grind             |
| Federal Tax Credits           | No                | No             | Always calculated last; statutorily exempt |
| CMF / Telefilm Equity         | No                | No             | Default: Exempt from assistance definition |
| CMF Licence Fee Top-up        | No                | No             | Default: Exempt (Exception: Grinds PSTC 1) |
| CMF / Telefilm Grant          | Yes               | Yes            | Evaluated as standard government grant     |
| Commercial Loans              | No                | No             | Must have standard repayment terms         |
| Broadcaster Licence Fees      | No                | No             | Standard commercial revenue                |


# **3 PROGRAM-LEVEL RULES**

## **3.1 CPTC (Federal  Domestic)**

- **Base Type:** Qualified Labour Expenditure (QLE)  
- **Base Rate:** 25%  
- **Grind Type:** Labour-Base Grind  
- **Reduces its base:** Grants, Forgivable Loans, Provincial Tax Credits (OFTTC, FIBC, AB FTTC, MB FTTC)  
- **What it reduces:** Statutorily exempt; grinds nothing  
- **Caps:** Max Eligible Labour  60% of (Total Cost  Total Assistance)  
- **Special Logic:** CPTC and PSTC are mutually exclusive. MUST be calculated last.

## **3.2 PSTC (Federal  Service)**

- **Base Type:** Qualified Canadian Labour Expenditure (QCLE)  
- **Base Rate:** 16%  
- **Grind Type:** Labour-Base Grind  
- **Reduces its base:** Grants, Provincial Services Credits (OPSTC, BC PSTC), CMF Licence Fee Top-ups 1  
- **What it reduces:** Statutorily exempt; grinds nothing  
- **Caps:** None

## **3.3 OFTTC (Ontario  Domestic)**

- **Base Type:** Ontario Labour  
- **Base Rate:** 35% (Bonus uplifts available)  
- **Grind Type:** Proportional Grind  
- **Reduces its base:** Grants (e.g., NOHFC)  
- **What it reduces:** CPTC  
- **Caps:** None  
- **Special Logic:** Uses *Proportional Grind* based on global total cost.2

## **3.4 OPSTC (Ontario  Service)**

- **Base Type:** Qualifying Production Expenditures (QPE)  
- **Base Rate:** 21.5%  
- **Grind Type:** Total-Cost (QPE) Grind  
- **Reduces its base:** Grants  
- **What it reduces:** PSTC  
- **Caps:** Ontario Labour must be = 25% of Total QPE

## **3.5 FIBC (BC  Domestic)**

- **Base Type:** BC Labour  
- **Base Rate:** 35% (Bonus uplifts available)  
- **Grind Type:** Labour-Base Grind  
- **Reduces its base:** Grants, Deferrals, specific BC Ineligible Costs (Website, 50% craft services, app fees)  
- **What it reduces:** CPTC  
- **Caps:** Max Eligible Labour  60% of (Total Cost  Assistance  BC Ineligible Costs)

## **3.6 AB FTTC (Alberta)**

- **Base Type:** Total Alberta Spend (Labour  Goods/Services)  
- **Base Rate:** 22% or 30%  
- **Grind Type:** Total-Cost (QPE) Grind (Program-Specific)  
- **Reduces its base:** "Designated Assistance" (Grants, Other Provincial Credits)  
- **What it reduces:** CPTC / PSTC  
- **Caps:** None  
- **Special Logic:** *Program-Specific Grind:* Grants or assistance explicitly providing support for out-of-province expenses are ignored and do not grind the AB FTTC.3

## **3.7 MB FTTC (Manitoba)**

- **Base Type:** MB Labour (Cost-of-Salaries) OR MB Spend (Cost-of-Production)  
- **Base Rate:** 45% (Labour) OR 30% (Spend)  
- **Grind Type:** Labour-Base Grind OR Total-Cost Grind  
- **Reduces its base:** Government Grants  
- **What it reduces:** CPTC / PSTC  
- **Special Logic:** Mutually exclusive choice between Labour vs Spend model.4 Strict "No Double Counting" rule.

# **4 GRIND TYPES & ATTRIBUTION LOGIC**

## **4.1 Clarification: Labour vs. Total Assistance Attribution**

When determining how much assistance reduces a base, the system must properly attribute the assistance type:

- **Direct Labour Assistance:** Grants explicitly provided to subsidize wages. Deducted 1:1 directly from the Labour Base.  
- **General Production Assistance:** Grants provided for the overall production without specific allocations. For labour-based credits, these cannot be deducted 1:1; they must be *pro-rated* to the labour base (e.g., GeneralAssistance  (Labour / TotalCost)) before applying the deduction.

## **4.2 Labour-Base Grind**

Applied when calculating pure labour credits (CPTC, PSTC, FIBC, MB Cost-of-Salaries).  
AdjustedLabourBase  GrossLabour  DirectLabourAssistance  ProRatedGeneralAssistance

## **4.3 Total-Cost (QPE) Grind**

Applied to credits based on overall spend (OPSTC, AB FTTC, MB Cost-of-Production).  
AdjustedQPE  GrossQPE  TotalAssistance

## **4.4 Proportional Grind (Ontario OFTTC specific)**

Ontario dictates that general grants reduce the labour base proportionately based on the global ratio of Ontario Labour to Total Production Cost.2 GrindAmount  GeneralAssistance  (OntarioLabour / GlobalTotalProductionCost) AdjustedOntarioLabour  OntarioLabour  GrindAmount

## **4.5 Program-Specific Grind (Alberta FTTC specific)**

Provincial grinds are generally program-specific, meaning they only factor in assistance directly related to the expenses claimed in that jurisdiction. Alberta explicitly enforces this: If AssistanceOrigin = "Out-of-Province" then Grind  0 3

# **5 CALCULATION SEQUENCE**

**Step 1: Base Construction**

- TotalCost  Sum of all production expenditures  
- ProvincialLabour  Sum of eligible provincial labour  
- FederalLabour  Sum of eligible federal labour

**Step 2: Assistance Identification & Attribution**

- DirectAssistance  Sum of all grants, NOHFC, forgivable loans  
- *Filter:* Exclude CMF Equity, CMF Top-ups (default), Broadcaster Licences, Bona Fide Loans.  
- *Attribution:* Tag assistance as LabourSpecific or GeneralProduction.

**Step 3: Provincial Calculation (e.g., OFTTC)**

- ProvincialGrind  Execute specific Grind Type logic (e.g., Proportional Grind for OFTTC).  
- *Check:* Ignore out-of-province assistance if evaluating a program-specific credit like AB FTTC.3  
- AdjustedProvincialBase  GrossProvincialBase  ProvincialGrind  
- ProvincialCreditYield  AdjustedProvincialBase  ProvincialRate

**Step 4: Federal Cap Calculation (CPTC  ALWAYS CALCULATED LAST)**

- TotalFederalAssistance  DirectAssistance  ProvincialCreditYield  
- NetTotalCost  TotalCost  TotalFederalAssistance  
- CPTCCap  NetTotalCost  0.60

**Step 5: Federal Base Adjustment & Yield (CPTC)**

- LabourSpecificAssistance  ProRatedDirectAssistance  ProvincialCreditYield  
- AdjustedFederalLabour  FederalLabour  LabourSpecificAssistance  
- FinalEligibleFederalLabour  MIN(AdjustedFederalLabour, CPTCCap)  
- FederalCreditYield  FinalEligibleFederalLabour  FederalRate

# **6 CONCRETE WORKED EXAMPLE**

**Input Variables:**

- TotalCost: 10,000,000  
- OntarioLabour: 4,000,000  
- FederalLabour: 4,000,000  
- ProvincialRate (OFTTC): 35%  
- FederalRate (CPTC): 25%  
- NOHFCGrant (General Assistance): 1,000,000  
- CMFEquity (Exempt Default): 1,500,000

**Execution Flow:**

1. **Provincial Grind (OFTTC Proportional)**
  - Grind  1,000,000  (4,000,000 / 10,000,000)  400,000 2  
  - AdjustedONLabour  4,000,000  400,000  3,600,000
2. **Provincial Yield (OFTTC)**
  - OFTTC  3,600,000  0.35  1,260,000
3. **Federal Cap Calculation (Calculated Last)**
  - TotalFederalAssistance  1,000,000 (Grant)  1,260,000 (OFTTC)  2,260,000  
  - NetTotalCost  10,000,000  2,260,000  7,740,000  
  - CPTCCap  7,740,000  0.60  4,644,000
4. **Federal Base Adjustment (Labour Attribution)**
  - LabourAssistance  400,000 (Grant pro-rated to labour)  1,260,000 (OFTTC)  1,660,000  
  - AdjustedFedLabour  4,000,000  1,660,000  2,340,000
5. **Federal Yield (CPTC)**
  - Compare AdjustedFedLabour (2,340,000) against CPTCCap (4,644,000). Use the lesser amount.  
  - CPTC  2,340,000  0.25  585,000

**Final Outputs:**

- OFTTCYield  1,260,000  
- CPTCYield  585,000

# **7 EDGE CASES**

## **7.1 Provincial vs Global Assistance Application**

- **Rule:** Jurisdictions like Alberta apply a strict program-specific grind, meaning assistance received for out-of-province expenses is completely ignored.3 In contrast, Ontario's proportional formula evaluates the *global* Total Production Cost, so out-of-province assistance will proportionally grind the Ontario labour base.2

## **7.2 Mutual Exclusivity**

- **Rule:** A single production corporation cannot claim both CPTC and PSTC.  
- **Action:** System must enforce a hard toggle: if CPTC = true then PSTC  false.

## **7.3 Alberta "Designated Assistance" Interprovincial Overlap**

- **Rule:** If a production applies for the AB FTTC but splits production with BC, the BC tax credit (e.g., FIBC) constitutes "Designated Assistance" and grinds the AB base.  
- **Action:** ABAdjustedSpend  GrossABSpend  BCFIBCYield.

## **7.4 CMF Default Rules and Explicit Exceptions**

- **Rule:** By default, CMF is NOT assistance. However, if the user selects the federal PSTC, CMF Licence Fee Top-ups uniquely convert into assistance and trigger a grind.1  
- **Action:** if FederalProgram = "PSTC" and Funding = "CMFTopUp" then isassistance  true.

#### **Works cited**

1. Application Policy  Canada.ca, accessed April 28, 2026, [https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/film-media-tax-credits/film-video-production-services-tax-credit-program/application-policies/application-policy-assistance.html](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/film-media-tax-credits/film-video-production-services-tax-credit-program/application-policies/application-policy-assistance.html)
2. Ontario Film & Television Tax Credit (OFTTC), accessed April 28, 2026, [https://www.ontariocreates.ca/tax-incentives/ofttc](https://www.ontariocreates.ca/tax-incentives/ofttc)
3. Film and Television Tax Credit | Program Guidelines  Government of Alberta, accessed April 28, 2026, [https://www.alberta.ca/system/files/jet-fttc-program-guidelines.pdf](https://www.alberta.ca/system/files/jet-fttc-program-guidelines.pdf)
4. An overview of the Manitoba Film & Video Production Tax Credit  Fillmore Riley LLP, accessed April 28, 2026, [https://www.fillmoreriley.com/publication/an-overview-of-the-manitoba-film---video-production-tax-credit](https://www.fillmoreriley.com/publication/an-overview-of-the-manitoba-film---video-production-tax-credit)
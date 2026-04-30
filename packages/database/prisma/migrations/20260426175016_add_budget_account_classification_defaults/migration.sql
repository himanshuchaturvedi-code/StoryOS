-- AlterTable
ALTER TABLE "budget_accounts" ADD COLUMN     "defaultLabourClassification" "ExpenseType",
ADD COLUMN     "defaultPhase" "PhaseType";

-- AlterTable
ALTER TABLE "budget_template_accounts" ADD COLUMN     "defaultLabourClassification" "ExpenseType",
ADD COLUMN     "defaultPhase" "PhaseType";

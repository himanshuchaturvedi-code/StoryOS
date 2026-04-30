import { Injectable } from '@nestjs/common';
import { RequirementCategory } from '@storyos/types';
import { GrantEstimatorService } from '../grants/grant-estimator.service';
import type { Calculator } from './calculator.interface';
import { ExpenditureThresholdCalculator } from './calculators/expenditure-threshold.calculator';
import { LabourExpenditureCalculator } from './calculators/labour-expenditure.calculator';
import { RegionalSpendCalculator } from './calculators/regional-spend.calculator';
import { KeyCreativeCalculator } from './calculators/key-creative.calculator';
import { ResidencyTestCalculator } from './calculators/residency-test.calculator';
import { ActivityDayMinimumCalculator } from './calculators/activity-day-minimum.calculator';
import { CanadianControlCalculator } from './calculators/canadian-control.calculator';
import { RightsControlCalculator } from './calculators/rights-control.calculator';
import { FormatEligibilityCalculator } from './calculators/format-eligibility.calculator';
import { VendorEligibilityCalculator } from './calculators/vendor-eligibility.calculator';
import { ProducerCreditCalculator } from './calculators/producer-credit.calculator';
import { DocumentationCalculator } from './calculators/documentation.calculator';
import { CustomCalculator } from './calculators/custom.calculator';

@Injectable()
export class CalculatorRegistry {
  private readonly calculators = new Map<RequirementCategory, Calculator>();

  constructor(grantEstimator: GrantEstimatorService) {
    this.register(RequirementCategory.EXPENDITURE_THRESHOLD, new ExpenditureThresholdCalculator());
    this.register(
      RequirementCategory.LABOUR_EXPENDITURE,
      new LabourExpenditureCalculator(grantEstimator),
    );
    this.register(RequirementCategory.REGIONAL_SPEND, new RegionalSpendCalculator());
    this.register(RequirementCategory.KEY_CREATIVE_TEST, new KeyCreativeCalculator());
    this.register(RequirementCategory.RESIDENCY_TEST, new ResidencyTestCalculator());
    this.register(RequirementCategory.ACTIVITY_DAY_MINIMUM, new ActivityDayMinimumCalculator());
    this.register(RequirementCategory.CANADIAN_CONTROL, new CanadianControlCalculator());
    this.register(RequirementCategory.RIGHTS_CONTROL, new RightsControlCalculator());
    this.register(RequirementCategory.FORMAT_ELIGIBILITY, new FormatEligibilityCalculator());
    this.register(RequirementCategory.VENDOR_ELIGIBILITY, new VendorEligibilityCalculator());
    this.register(RequirementCategory.PRODUCER_CREDIT, new ProducerCreditCalculator());
    this.register(RequirementCategory.DOCUMENTATION, new DocumentationCalculator());
    this.register(RequirementCategory.CUSTOM, new CustomCalculator());
  }

  private register(category: RequirementCategory, calculator: Calculator): void {
    this.calculators.set(category, calculator);
  }

  getCalculator(category: RequirementCategory): Calculator | undefined {
    return this.calculators.get(category);
  }

  hasCalculator(category: RequirementCategory): boolean {
    return this.calculators.has(category);
  }

  get registeredCategories(): RequirementCategory[] {
    return Array.from(this.calculators.keys());
  }
}

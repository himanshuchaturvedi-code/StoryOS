import { Controller, Get } from '@nestjs/common';
import { INCENTIVE_REGIONS } from '@storyos/types';
import { Public } from '../common/decorators/public.decorator';

@Controller('reference')
export class ReferenceController {
  @Get('incentive-regions')
  @Public()
  listIncentiveRegions() {
    return INCENTIVE_REGIONS;
  }
}

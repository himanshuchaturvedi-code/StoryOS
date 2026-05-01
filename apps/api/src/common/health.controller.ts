import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';

/** Public probe for Render / load balancers. Global prefix adds `/api`. */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return { ok: true };
  }
}

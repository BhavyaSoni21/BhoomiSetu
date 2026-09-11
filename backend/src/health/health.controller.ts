import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// KNOWN_RISKS.md MED-7: real deployment infra (load balancers, uptime
// checks, Render/Vercel health probes) had nothing dedicated to poll. Plain
// process-liveness only (no DB round trip) - a probe hitting this every few
// seconds shouldn't add load to the database, and SkipThrottle keeps
// frequent polling from ever tripping the app-wide rate limit
// (app.module.ts). Mounted outside the /api/v1 prefix (see main.ts's
// setGlobalPrefix exclude) so it's a stable, version-independent path for
// infra to target.
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

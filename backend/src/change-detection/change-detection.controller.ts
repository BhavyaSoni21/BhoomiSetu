import { BadRequestException, Body, Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ChangeDetectionService } from './change-detection.service';
import { AnalyzeChangeDto } from './dto/analyze-change.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ALL_STAFF_ROLES } from '../auth/roles.constants';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image

// Tech.md #33 CHANGE DETECTION SERVICE. POST /api/v1/change-detection/analyze
// accepts two images (multipart fields "before"/"after") plus the real
// geographic bounds they cover. Tighter rate limit than the app default
// (see AppModule) - image decode/resize/diff is real CPU work per request.
// Officer/admin-only (docs/FEATURE_AUDIT.md §8 item 5) - only the Officer
// Portal's ChangeDetectionPanel calls this.
@Controller('change-detection')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALL_STAFF_ROLES)
export class ChangeDetectionController {
  constructor(private readonly changeDetectionService: ChangeDetectionService) {}

  @Post('analyze')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'before', maxCount: 1 },
        { name: 'after', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  async analyze(
    @UploadedFiles() files: { before?: Express.Multer.File[]; after?: Express.Multer.File[] },
    @Body() dto: AnalyzeChangeDto,
  ) {
    const before = files.before?.[0];
    const after = files.after?.[0];
    if (!before || !after) {
      throw new BadRequestException('Both "before" and "after" image files are required');
    }
    if (!before.mimetype.startsWith('image/') || !after.mimetype.startsWith('image/')) {
      throw new BadRequestException('Both files must be images');
    }

    return this.changeDetectionService.analyze(
      before.buffer,
      after.buffer,
      { minLng: dto.minLng, minLat: dto.minLat, maxLng: dto.maxLng, maxLat: dto.maxLat },
      dto.description,
    );
  }
}

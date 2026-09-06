import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { DocumentVerificationService } from './document-verification.service';
import { VerifyDocumentDto } from './dto/verify-document.dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, matching change-detection's own image upload limit

// Citizen-facing (no auth guard - the Citizen Portal has no account concept,
// same as parcel search and service-request creation elsewhere in this
// app). Tighter rate limit than the app default: OCR is real CPU work per
// request, same reasoning as change-detection's own image-upload endpoint.
@Controller('document-verification')
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class DocumentVerificationController {
  constructor(private readonly documentVerificationService: DocumentVerificationService) {}

  @Post('verify')
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async verify(@UploadedFile() file: Express.Multer.File, @Body() dto: VerifyDocumentDto) {
    if (!file) {
      throw new BadRequestException('A "document" image file is required');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    return this.documentVerificationService.verify(dto.parcelId, file.buffer);
  }
}

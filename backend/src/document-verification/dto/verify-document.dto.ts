import { IsUUID } from 'class-validator';

// multipart/form-data field, arrives alongside the "document" file field -
// see analyze-change.dto.ts for the same pattern.
export class VerifyDocumentDto {
  @IsUUID()
  parcelId: string;
}

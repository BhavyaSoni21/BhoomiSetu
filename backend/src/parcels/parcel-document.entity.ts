import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// A parcel's real, persisted land-property paperwork (e.g. a Record of
// Rights copy) - previously nothing was ever stored per parcel, only OCR'd
// transiently from a citizen's upload and discarded (the old
// document-verification module). Seeded deliberately partial/messy (see
// seed.ts) - not every citizen-linked parcel has one, and of those that do,
// a mix of REGISTERED/UNREGISTERED status exists from the start, exactly
// like a real system that's been in use rather than freshly pristine.
@Entity('parcel_documents')
@Index(['parcelId'])
export class ParcelDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'varchar', length: 40, default: 'ROR_COPY' })
  documentType: string;

  @Column({ type: 'varchar' })
  fileName: string;

  @Column({ type: 'varchar' })
  filePath: string;

  @Column({ type: 'varchar', length: 40, default: 'image/png' })
  mimeType: string;

  // OCR'd once at seed time (or when a bare row is created on workflow
  // approval - see WorkflowsService) rather than re-OCRing on every request -
  // reused as the automatic pre-check shown to the reviewing officer.
  @Column({ type: 'text', nullable: true })
  extractedText: string | null;

  @Column({ type: 'varchar', length: 20, default: 'UNREGISTERED' })
  registrationStatus: string; // REGISTERED | UNREGISTERED

  @CreateDateColumn()
  createdAt: Date;
}

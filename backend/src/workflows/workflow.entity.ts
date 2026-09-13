import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// A citizen service request (Tech.md #23/#24 - "workflows" table), e.g.
// "request a copy of the RoR" or "correction request". `parcelId` is a
// plain string, not a relation, consistent with the department records
// pattern elsewhere. `createdBy` is a free-text name/contact rather than a
// user UUID - there's no auth system yet (Phase 10), so a service request
// form can't assume a logged-in citizen.
@Entity('workflows')
@Index(['parcel_id'])
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parcel_id', type: 'varchar' })
  parcelId: string;

  @Column({ name: 'workflow_type', type: 'varchar', length: 40 })
  workflowType: string; // e.g. ROR_COPY_REQUEST | CORRECTION_REQUEST

  @Column({ name: 'current_status', type: 'varchar', length: 20, default: 'SUBMITTED' })
  currentStatus: string; // SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | COMPLETED

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @Column({ name: 'request_details', type: 'text', nullable: true })
  requestDetails: string | null;

  @Column({ name: 'last_remarks', type: 'text', nullable: true })
  lastRemarks: string | null;

  // Set only when RequestRoutingService's AI call successfully chose this
  // workflow's pipeline (as opposed to the deterministic pipelineFor()
  // fallback) - the AI's own one-sentence rationale, shown to the assigned
  // officer(s) so they see *why* this request landed in their queue.
  @Column({ name: 'routing_notes', type: 'text', nullable: true })
  routingNotes: string | null;

  // The citizen who filed this request, set once at creation. Needed
  // specifically for LAND_CLAIM_REQUEST - unlike every other workflow type,
  // a claim has no citizen_parcels link yet at filing time, so
  // notifyCitizenOfStepDecision/reviewStep's claim-approval hook can't
  // resolve "which citizen" via that join the way every other workflow can.
  // Replaces that join-based lookup for every workflow type going forward.
  @Column({ name: 'citizen_id', type: 'varchar', nullable: true })
  citizenId: string | null;

  // Snapshotted from the citizen's profile at creation (never citizen-
  // entered) so the reviewing officer has everything needed to decide
  // without a separate profile lookup per request (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up, "simplified Raise Request"). createdBy already covers name.
  @Column({ name: 'applicant_contact', type: 'varchar', nullable: true })
  applicantContact: string | null;

  @Column({ name: 'applicant_address', type: 'varchar', nullable: true })
  applicantAddress: string | null;

  // Automatic OCR pre-check (JSON-stringified {verdict, checks}) run against
  // the parcel's stored ParcelDocument at creation time, for LAND_CLAIM_REQUEST/
  // DOCUMENT_VERIFICATION_REQUEST only - reuses the existing OCR/field-matcher
  // code (document-verification/ocr.ts, field-matcher.ts) as an aid shown to
  // officer, not an instant citizen-facing verdict. The officer's own
  // decision is what actually counts, not this match.
  @Column({ name: 'verification_precheck', type: 'text', nullable: true })
  verificationPrecheck: string | null;

  // A citizen-submitted file attached to THIS specific request - distinct
  // from a parcel's official ParcelDocument, since e.g. a DISPUTE_FILING's
  // evidence must never overwrite the parcel's existing (someone else's)
  // legitimate paperwork. Only LAND_CLAIM_REQUEST/DOCUMENT_VERIFICATION_REQUEST
  // ever promote this into becoming the parcel's ParcelDocument, and only on
  // approval (WorkflowsService.reviewStep/markParcelDocumentRegistered) -
  // DISPUTE_FILING's evidence stays visible only here, for the officer.
  @Column({ name: 'evidence_file_name', type: 'varchar', nullable: true })
  evidenceFileName: string | null;

  @Column({ name: 'evidence_file_path', type: 'varchar', nullable: true })
  evidenceFilePath: string | null;

  @Column({ name: 'evidence_mime_type', type: 'varchar', nullable: true })
  evidenceMimeType: string | null;

  @Column({ name: 'evidence_extracted_text', type: 'text', nullable: true })
  evidenceExtractedText: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { CitizenParcel } from '../parcels/citizen-parcel.entity';
import { ParcelDocument } from '../parcels/parcel-document.entity';
import { User } from '../users/user.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { RequestRoutingService } from './request-routing.service';
import { AuditModule } from '../audit/audit.module';
import { GroqModule } from '../ai/groq.module';
import { NotificationFeedModule } from '../notification-feed/notification-feed.module';

// Registers its own Parcel/CitizenParcel/User repositories (rather than
// importing ParcelsModule/UsersModule) so ParcelsModule can import this one -
// for GET /parcels/:id/workflows - without a cycle, same pattern as
// Departments/Interoperability. The citizen-association check this needs
// (docs/FRONTEND_UPGRADE_SPEC.md §4 - "Raise Request only for associated
// parcels") is therefore a small duplicate of ParcelsService's own version,
// not a cross-module call - same convention as UsersController's toPublicUser.
// GroqModule/NotificationFeedModule added 2026-09-09 for AI-based request
// routing and the in-app notification feed - both verified cycle-free
// (neither imports anything that imports WorkflowsModule back).
@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, CitizenParcel, ParcelDocument, User, Workflow, WorkflowStep]),
    AuditModule,
    GroqModule,
    NotificationFeedModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, RequestRoutingService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

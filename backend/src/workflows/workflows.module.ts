import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { CitizenParcel } from '../parcels/citizen-parcel.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { AuditModule } from '../audit/audit.module';

// Registers its own Parcel/CitizenParcel repositories (rather than importing
// ParcelsModule) so ParcelsModule can import this one - for GET
// /parcels/:id/workflows - without a cycle, same pattern as
// Departments/Interoperability. The citizen-association check this needs
// (docs/FRONTEND_UPGRADE_SPEC.md §4 - "Raise Request only for associated
// parcels") is therefore a small duplicate of ParcelsService's own version,
// not a cross-module call - same convention as UsersController's toPublicUser.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, CitizenParcel, Workflow, WorkflowStep]), AuditModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

// Registers its own Parcel repository (rather than importing ParcelsModule)
// so ParcelsModule can import this one - for GET /parcels/:id/workflows -
// without a cycle, same pattern as Departments/Interoperability.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, Workflow, WorkflowStep])],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

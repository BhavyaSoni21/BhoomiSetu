import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationFeedService } from './notification-feed.service';
import { NotificationFeedController } from './notification-feed.controller';

// Leaf module (registers only its own Notification repository, imports
// nothing) so WorkflowsModule/GovernanceModule can both import this without
// any risk of a cycle - same shape as AuditModule.
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationFeedController],
  providers: [NotificationFeedService],
  exports: [NotificationFeedService],
})
export class NotificationFeedModule {}

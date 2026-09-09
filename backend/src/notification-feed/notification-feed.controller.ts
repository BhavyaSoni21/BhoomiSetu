import { Controller, Get, Patch, Param, ParseUUIDPipe, NotFoundException, UseGuards } from '@nestjs/common';
import { NotificationFeedService } from './notification-feed.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

// Open to any authenticated user regardless of role (citizen or staff both
// have their own notification feed) - same bare-JwtAuthGuard-no-@Roles
// shape as GET /auth/me, the only other endpoint in this codebase meant for
// "whoever is signed in", not a specific role.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationFeedController {
  constructor(private readonly notificationFeedService: NotificationFeedService) {}

  @Get()
  async findMine(@CurrentUser() user: User) {
    return this.notificationFeedService.findMine(user.id);
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const notification = await this.notificationFeedService.markRead(id, user.id);
    if (!notification) {
      throw new NotFoundException(`Notification not found: ${id}`);
    }
    return notification;
  }
}

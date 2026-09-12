import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

// Leaf module (no repositories, no imports) - both services are pure
// external-API wrappers, deliberately independent of GroqService/the
// historical-imagery AI service. Consumed by AuthModule for
// registration/OTP-verification/Profile contact-method flows.
@Module({
  providers: [SmsService, EmailService],
  exports: [SmsService, EmailService],
})
export class NotificationsModule {}

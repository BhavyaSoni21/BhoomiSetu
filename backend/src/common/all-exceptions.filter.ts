import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-id.middleware';

// KNOWN_RISKS.md MED-8: relied entirely on Nest's built-in default handler -
// safe (no stack-trace leakage to the client, same behavior kept here) but
// with no request-ID correlation between what a client sees and what ends
// up in the server logs, and no logging at all for a genuinely unexpected
// (5xx) error beyond whatever Nest prints by default.
//
// Deliberately preserves the exact response shape a thrown HttpException
// already produced (several e2e tests assert on res.body.message) - this
// only adds a `requestId` field alongside it, never changes status/message.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.requestId ?? 'unknown';

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : { statusCode: status, message: 'Internal server error' };
    const responseBody = typeof body === 'string' ? { statusCode: status, message: body, requestId } : { ...body, requestId };

    // A well-formed 4xx (validation, not-found, forbidden - normal
    // application flow, and the overwhelming majority of what this filter
    // sees) isn't noise-logged the way a genuinely unexpected error is; a
    // 5xx always is, with the full stack, since that's the case an on-call
    // engineer actually needs to go find.
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${requestId}] ${request.method} ${request.originalUrl} -> ${status}`, stack);
    }

    response.status(status).json(responseBody);
  }
}

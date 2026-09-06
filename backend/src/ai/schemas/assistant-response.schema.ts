import { z } from 'zod';

// Replaces query-intent.schema.ts's narrower "always a data filter" shape -
// the floating Ask AI widget (docs/Plan.md's citizen-assistant addendum)
// handles two kinds of question in one Groq round trip: a question about
// actual parcel data (DATA_QUERY, same filter shape as before) or a
// question about how to use the site (HELP, a direct plain-language
// answer). One call, not two, keeps the widget feeling responsive.
export const assistantResponseSchema = z.object({
  intent: z.enum(['DATA_QUERY', 'HELP']),
  // For DATA_QUERY: one short intro sentence - the backend fills in the
  // actual count/results, so the model is never the source of truth for
  // data it never queried. For HELP: the full answer.
  reply: z.string().min(1).max(600),
  filters: z
    .object({
      // Accepts either a short code ("MH") or the full name ("Maharashtra")
      // - AiService normalizes whichever form the AI extracted before
      // querying, so the schema just needs to allow both lengths.
      state: z.string().max(30).optional(),
      district: z.string().max(40).optional(),
      tax_status: z.enum(['PAID', 'PENDING', 'OVERDUE']).optional(),
      has_restriction: z.boolean().optional(),
      land_use: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'MIXED_USE']).optional(),
      registration_status: z.enum(['REGISTERED', 'PENDING', 'NOT_REGISTERED']).optional(),
    })
    .strip()
    .optional(),
});

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
export type AssistantFilters = NonNullable<AssistantResponse['filters']>;

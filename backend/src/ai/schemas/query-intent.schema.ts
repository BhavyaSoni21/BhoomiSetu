import { z } from 'zod';

// Tech.md #29.1's exact example shape (query -> { filters: { tax_status,
// has_restriction } }), extended with the other fields this mock actually
// has data for. Every field is optional (the model only sets what the
// user's query asked about) but a set field must have one of these exact
// types/values - Tech.md #30 requires rejecting malformed AI responses
// before they reach application logic, and "the LLM must never directly
// execute unrestricted SQL" (#29.1) means these are the ONLY levers it gets.
export const queryIntentSchema = z.object({
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
    .strip(),
});

export type QueryIntent = z.infer<typeof queryIntentSchema>;

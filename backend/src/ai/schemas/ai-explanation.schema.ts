import { z } from 'zod';

// Tech.md #30's generic "preferred architecture" structured-output shape.
// Reused for both AI explain endpoints (parcel 360 summary, #29.2, and
// governance alert explanation, #29.3) rather than giving each its own
// schema - #29.3's example ({risk_level, explanation, recommended_action})
// is a strict subset of this one's fields, and #30 presents this as the
// general-purpose shape every structured AI response should follow.
export const aiExplanationSchema = z.object({
  summary: z.string().min(1),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  findings: z.array(
    z.object({
      type: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  recommended_action: z.string().min(1),
});

export type AiExplanation = z.infer<typeof aiExplanationSchema>;

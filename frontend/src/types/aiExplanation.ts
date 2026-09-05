// Shape returned by POST /api/v1/ai/parcels/:id/explain and
// POST /api/v1/ai/alerts/:id/explain (Tech.md #30's generic structured
// output shape, Zod-validated on the backend before it's ever returned).
export interface AiExplanationFinding {
  type: string;
  description: string;
}

export interface AiExplanation {
  summary: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  findings: AiExplanationFinding[];
  recommended_action: string;
}

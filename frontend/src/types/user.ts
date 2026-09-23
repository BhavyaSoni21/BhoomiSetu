// Shape of GET/POST/PATCH /api/v1/users - never includes a password hash.
export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  // Optional verifier workload stats - only present when the backend enriches
  // a VERIFIER row (field-verification assignment UI); undefined otherwise.
  workload?: string;
  assigned_area?: string;
  availability?: string;
  active_task_count?: number;
}

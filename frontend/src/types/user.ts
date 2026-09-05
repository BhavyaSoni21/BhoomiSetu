// Shape of GET/POST/PATCH /api/v1/users - never includes a password hash.
export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

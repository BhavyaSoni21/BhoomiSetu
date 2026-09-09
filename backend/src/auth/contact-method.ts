// Shared across every DTO/service that deals with a citizen's mobile-vs-email
// choice (docs/FRONTEND_UPGRADE_SPEC.md §3's method-selector) - registration,
// OTP verify/resend, and the Profile add/change-contact flow all key off this
// same two-value type.
export type ContactMethod = 'EMAIL' | 'MOBILE';
export const CONTACT_METHODS: ContactMethod[] = ['EMAIL', 'MOBILE'];

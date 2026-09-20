"""Ported from backend/src/auth/roles.constants.ts."""

OFFICER_ROLES = [
    "LAND_RECORD_OFFICER",
    "REGISTRATION_OFFICER",
    "PLANNING_OFFICER",
    "DISPUTE_OFFICER",
    "TAX_OFFICER",
    "RESTRICTION_OFFICER",
    "ENCUMBRANCE_OFFICER",
    "SURVEY_OFFICER",
]
ALL_STAFF_ROLES = [*OFFICER_ROLES, "ADMIN"]

# Optional citizen sign-in: a citizen account exists purely to associate a
# login with 0-5 parcels for a "My Parcels" dashboard - citizens never
# appear in ALL_STAFF_ROLES/the Admin Portal's user management.
CITIZEN_ROLE = "CITIZEN"

# Field evidence collector - deliberately NOT in OFFICER_ROLES/
# ALL_STAFF_ROLES. That's what structurally guarantees a Verifier account
# can never call the workflow-step review/approve endpoints (those all
# require_roles(*ALL_STAFF_ROLES)): separation of duties (verifier collects
# evidence, officer decides) falls out of the role split itself rather than
# needing its own enforcement check.
VERIFIER_ROLE = "VERIFIER"

# Mirrors frontend/src/features/officer/officerAuth.ts's ROLE_DEPARTMENT -
# duplicated rather than shared, matching this codebase's existing
# convention of not sharing enum-like constants across the backend/frontend
# boundary.
ROLE_DEPARTMENT = {
    "LAND_RECORD_OFFICER": "LAND_RECORDS",
    "REGISTRATION_OFFICER": "REGISTRATION",
    "PLANNING_OFFICER": "PLANNING",
    "DISPUTE_OFFICER": "DISPUTE",
    "TAX_OFFICER": "TAX",
    "RESTRICTION_OFFICER": "RESTRICTION",
    "ENCUMBRANCE_OFFICER": "ENCUMBRANCE",
    "SURVEY_OFFICER": "SURVEY",
}

# Reverse of the map above (department code -> officer role) - used to turn
# an AI-chosen department code into a real {department, assignedRole}
# pipeline step, and by the governance-alert review flow to find which
# officer role to notify for a given alert.
DEPARTMENT_ROLE = {department: role for role, department in ROLE_DEPARTMENT.items()}

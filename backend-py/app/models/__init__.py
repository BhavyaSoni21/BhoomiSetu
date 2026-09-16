# Every SQLAlchemy model module is imported here so app.database.Base.metadata
# (and therefore Alembic's autogenerate) sees it.
from app.models.admin import Department  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.department_record import (  # noqa: F401
    DisputeRecord,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
    TaxRecord,
)
from app.models.governance import GovernanceAlert  # noqa: F401
from app.models.land_records import StateALandRecord, StateBLandRecord  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.parcel import (  # noqa: F401
    CitizenParcel,
    CropRecord,
    OwnershipHistoryRecord,
    Parcel,
    ParcelDocument,
    ParcelHistoricalState,
    ParcelIdentifier,
    ParcelNeighbour,
)
from app.models.pending_registration import PendingRegistration  # noqa: F401
from app.models.spatial import (  # noqa: F401
    AdminMapNote,
    ChangeDetectionEvent,
    InfrastructureFeature,
    RestrictionZone,
    ZoningOverlay,
)
from app.models.user import User  # noqa: F401
from app.models.verification_evidence import VerificationEvidence  # noqa: F401
from app.models.workflow import Workflow, WorkflowStep  # noqa: F401

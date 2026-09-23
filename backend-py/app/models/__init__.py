# Every SQLAlchemy model module is imported here so app.database.Base.metadata
# (and therefore Alembic's autogenerate) sees it.
from app.models.admin import Department  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.case import (  # noqa: F401
    Application,
    Appointment,
    AIAnalysis,
    Case,
    CaseParcelGeometryVersion,
    CaseTimelineEvent,
    DepartmentTask,
    Feedback,
    ProposedFieldChange,
    RoutingDecision,
    SLAConfig,
)
from app.models.department_record import (  # noqa: F401
    DisputeRecord,
    EncumbranceCertificate,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
    SurveyDocument,
    SurveyRecord,
    TaxRecord,
)
from app.models.governance import GovernanceAlert  # noqa: F401
from app.models.land_records import StateALandRecord, StateBLandRecord  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.parcel import (  # noqa: F401
    CitizenParcel,
    CropRecord,
    DisputeHistoryRecord,
    EncumbranceHistoryRecord,
    OwnershipHistoryRecord,
    Parcel,
    ParcelDocument,
    ParcelHistoricalState,
    ParcelIdentifier,
    ParcelNeighbour,
    RegistrationHistoryRecord,
    RestrictionHistoryRecord,
    TaxHistoryRecord,
)
from app.models.pending_registration import PendingRegistration  # noqa: F401
from app.models.profile_field import ProfileField  # noqa: F401
from app.models.processing_job import ProcessingJob  # noqa: F401
from app.models.spatial import (  # noqa: F401
    AdminMapNote,
    ChangeDetectionEvent,
    InfrastructureFeature,
    RestrictionZone,
    ZoningOverlay,
)
from app.models.terrain import (  # noqa: F401
    RoadNetwork,
    BuildingFootprint,
    LandCover,
    ElevationTile,
    ParcelTerrainProfile,
)
from app.models.user import User  # noqa: F401
from app.models.verification_evidence import VerificationEvidence  # noqa: F401
from app.models.workflow import Workflow, WorkflowStep  # noqa: F401

"""Every backend/src/*.entity.ts field is camelCase (TypeORM's default,
e.g. `canonicalParcelId`, `stateCode`) and the frontend was built against
that JSON shape - PYTHON_MIGRATION_PLAN.md §2's contract-parity target
means every backend-py response schema needs to serialize the same way,
even though the Python/SQLAlchemy side is idiomatically snake_case
(`canonical_parcel_id`). CamelModel is the shared base every response
schema should inherit from instead of solving this per-schema.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

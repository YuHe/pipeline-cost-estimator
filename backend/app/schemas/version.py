from pydantic import BaseModel


class VersionRollbackRequest(BaseModel):
    version_id: int

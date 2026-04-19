from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserAdminOut(BaseModel):
    id: int
    email: str
    display_name: str
    is_admin: bool
    created_at: datetime
    pipeline_count: Optional[int] = None

    model_config = {"from_attributes": True}

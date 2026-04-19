from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ModuleTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: dict


class ModuleTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict] = None


class ModuleTemplateOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    config: dict
    is_global: bool
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}

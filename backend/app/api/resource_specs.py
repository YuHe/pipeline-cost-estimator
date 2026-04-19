from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.pipeline import ResourceSpec
from app.models.user import User
from app.schemas.resource_spec import ResourceSpecCreate, ResourceSpecOut

router = APIRouter(prefix="/api/resource-specs", tags=["resource-specs"])


@router.get("/", response_model=list[ResourceSpecOut])
async def list_resource_specs(
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ResourceSpecOut]:
    query = select(ResourceSpec).where(
        or_(
            ResourceSpec.is_system == True,  # noqa: E712
            ResourceSpec.created_by == current_user.id,
        )
    )

    if q:
        search_pattern = f"%{q}%"
        query = query.where(
            or_(
                ResourceSpec.name.ilike(search_pattern),
                ResourceSpec.gpu_type.ilike(search_pattern),
            )
        )

    query = query.order_by(ResourceSpec.is_system.desc(), ResourceSpec.name)
    result = await db.execute(query)
    specs = result.scalars().all()
    return [ResourceSpecOut.model_validate(s) for s in specs]


@router.post("/", response_model=ResourceSpecOut, status_code=status.HTTP_201_CREATED)
async def create_resource_spec(
    payload: ResourceSpecCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceSpecOut:
    spec = ResourceSpec(
        name=payload.name,
        gpu_type=payload.gpu_type,
        gpu_count=payload.gpu_count,
        cost_per_unit=payload.cost_per_unit,
        gpus_per_instance=payload.gpus_per_instance,
        gpus_per_machine=payload.gpus_per_machine,
        qps_per_instance=payload.qps_per_instance,
        avg_response_time_ms=payload.avg_response_time_ms,
        is_system=False,
        created_by=current_user.id,
    )
    db.add(spec)
    await db.flush()
    return ResourceSpecOut.model_validate(spec)


@router.delete("/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource_spec(
    spec_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ResourceSpec).where(ResourceSpec.id == spec_id)
    )
    spec = result.scalar_one_or_none()
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource spec not found",
        )
    if spec.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system resource specs",
        )
    if spec.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own resource specs",
        )
    await db.delete(spec)
    await db.flush()

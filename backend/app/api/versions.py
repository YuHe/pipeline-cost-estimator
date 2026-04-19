from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.pipeline import Pipeline, PipelineVersion
from app.models.user import User
from app.schemas.pipeline import PipelineVersionOut
from app.schemas.version import VersionRollbackRequest

router = APIRouter(prefix="/api/pipelines/{pipeline_id}/versions", tags=["versions"])


@router.post("/rollback", response_model=PipelineVersionOut)
async def rollback_version(
    pipeline_id: int,
    payload: VersionRollbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineVersionOut:
    """Rollback to a specific version by creating a new version with that config."""
    # Verify pipeline ownership
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.owner_id == current_user.id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    # Fetch the target version to rollback to
    result = await db.execute(
        select(PipelineVersion).where(
            PipelineVersion.id == payload.version_id,
            PipelineVersion.pipeline_id == pipeline_id,
        )
    )
    target_version = result.scalar_one_or_none()
    if target_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target version not found",
        )

    # Determine the next version number
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PipelineVersion.version_number), 0)).where(
            PipelineVersion.pipeline_id == pipeline_id
        )
    )
    max_version = result.scalar()
    next_version = max_version + 1

    # Create a new version with the target version's config
    new_version = PipelineVersion(
        pipeline_id=pipeline_id,
        version_number=next_version,
        config=target_version.config,
        cost_snapshot=target_version.cost_snapshot,
        description=f"Rollback to version {target_version.version_number}",
    )
    db.add(new_version)
    await db.flush()

    # Update pipeline's current_version_id
    pipeline.current_version_id = new_version.id
    await db.flush()

    return PipelineVersionOut.model_validate(new_version)

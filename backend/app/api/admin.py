from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_admin_user, get_db
from app.models.pipeline import Pipeline, PipelineVersion
from app.models.user import User
from app.schemas.admin import UserAdminOut
from app.schemas.pipeline import PipelineListOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserAdminOut])
async def list_users(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserAdminOut]:
    """List all users with pipeline counts. Admin only."""
    result = await db.execute(
        select(
            User,
            sa_func.count(Pipeline.id).label("pipeline_count"),
        )
        .outerjoin(Pipeline, Pipeline.owner_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
    )
    rows = result.all()
    return [
        UserAdminOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            is_admin=user.is_admin,
            created_at=user.created_at,
            pipeline_count=pipeline_count,
        )
        for user, pipeline_count in rows
    ]


@router.put("/users/{user_id}/toggle-admin", response_model=UserAdminOut)
async def toggle_admin(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> UserAdminOut:
    """Toggle admin status for a user. Admin only. Cannot de-admin self."""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own admin status",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_admin = not user.is_admin
    await db.flush()

    # Fetch pipeline count
    count_result = await db.execute(
        select(sa_func.count(Pipeline.id)).where(Pipeline.owner_id == user.id)
    )
    pipeline_count = count_result.scalar()

    return UserAdminOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
        created_at=user.created_at,
        pipeline_count=pipeline_count,
    )


@router.get("/pipelines", response_model=list[PipelineListOut])
async def list_all_pipelines(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[PipelineListOut]:
    """List all pipelines across all users. Admin only."""
    result = await db.execute(
        select(Pipeline).order_by(Pipeline.updated_at.desc())
    )
    pipelines = result.scalars().all()

    results: list[PipelineListOut] = []
    for p in pipelines:
        latest_cost_snapshot = None
        if p.current_version_id is not None:
            ver_result = await db.execute(
                select(PipelineVersion).where(
                    PipelineVersion.id == p.current_version_id
                )
            )
            ver = ver_result.scalar_one_or_none()
            if ver is not None:
                latest_cost_snapshot = ver.cost_snapshot

        results.append(
            PipelineListOut(
                id=p.id,
                name=p.name,
                description=p.description,
                owner_id=p.owner_id,
                created_at=p.created_at,
                updated_at=p.updated_at,
                current_version_id=p.current_version_id,
                latest_cost_snapshot=latest_cost_snapshot,
            )
        )
    return results


@router.delete("/pipelines/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_pipeline(
    pipeline_id: int,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete any pipeline. Admin only."""
    result = await db.execute(
        select(Pipeline).where(Pipeline.id == pipeline_id)
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    # Delete all versions first
    versions_result = await db.execute(
        select(PipelineVersion).where(PipelineVersion.pipeline_id == pipeline.id)
    )
    for version in versions_result.scalars().all():
        await db.delete(version)
    await db.delete(pipeline)
    await db.flush()

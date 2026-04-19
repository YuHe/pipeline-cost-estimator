from fastapi import HTTPException, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import Pipeline, PipelineVersion
from app.schemas.pipeline import PipelineCreate, PipelineUpdate


async def create_pipeline(
    db: AsyncSession, user_id: int, data: PipelineCreate
) -> Pipeline:
    pipeline = Pipeline(
        name=data.name,
        description=data.description,
        owner_id=user_id,
    )
    db.add(pipeline)
    await db.flush()
    return pipeline


async def get_user_pipelines(db: AsyncSession, user_id: int) -> list[Pipeline]:
    result = await db.execute(
        select(Pipeline)
        .where(Pipeline.owner_id == user_id)
        .order_by(Pipeline.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_pipeline(
    db: AsyncSession, pipeline_id: int, user_id: int
) -> Pipeline:
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.owner_id == user_id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )
    return pipeline


async def update_pipeline(
    db: AsyncSession, pipeline_id: int, user_id: int, data: PipelineUpdate
) -> Pipeline:
    pipeline = await get_pipeline(db, pipeline_id, user_id)
    if data.name is not None:
        pipeline.name = data.name
    if data.description is not None:
        pipeline.description = data.description
    await db.flush()
    return pipeline


async def delete_pipeline(
    db: AsyncSession, pipeline_id: int, user_id: int
) -> None:
    pipeline = await get_pipeline(db, pipeline_id, user_id)
    # Delete all versions first
    versions_result = await db.execute(
        select(PipelineVersion).where(PipelineVersion.pipeline_id == pipeline.id)
    )
    for version in versions_result.scalars().all():
        await db.delete(version)
    await db.delete(pipeline)
    await db.flush()


async def save_version(
    db: AsyncSession,
    pipeline_id: int,
    user_id: int,
    config: dict,
    cost_snapshot: dict | None = None,
    description: str | None = None,
) -> PipelineVersion:
    # Verify ownership
    pipeline = await get_pipeline(db, pipeline_id, user_id)

    # Determine next version number
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PipelineVersion.version_number), 0)).where(
            PipelineVersion.pipeline_id == pipeline.id
        )
    )
    max_version = result.scalar()
    next_version = max_version + 1

    version = PipelineVersion(
        pipeline_id=pipeline.id,
        version_number=next_version,
        config=config,
        cost_snapshot=cost_snapshot,
        description=description,
    )
    db.add(version)
    await db.flush()

    # Update pipeline's current_version_id
    pipeline.current_version_id = version.id
    await db.flush()

    return version


async def get_versions(
    db: AsyncSession, pipeline_id: int, user_id: int
) -> list[PipelineVersion]:
    # Verify ownership
    await get_pipeline(db, pipeline_id, user_id)

    result = await db.execute(
        select(PipelineVersion)
        .where(PipelineVersion.pipeline_id == pipeline_id)
        .order_by(PipelineVersion.version_number.desc())
    )
    return list(result.scalars().all())


async def get_version(
    db: AsyncSession, pipeline_id: int, version_id: int, user_id: int
) -> PipelineVersion:
    # Verify ownership
    await get_pipeline(db, pipeline_id, user_id)

    result = await db.execute(
        select(PipelineVersion).where(
            PipelineVersion.id == version_id,
            PipelineVersion.pipeline_id == pipeline_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline version not found",
        )
    return version


async def copy_pipeline(
    db: AsyncSession, pipeline_id: int, user_id: int, new_name: str
) -> Pipeline:
    # Get original pipeline and verify ownership
    original = await get_pipeline(db, pipeline_id, user_id)

    # Create new pipeline
    new_pipeline = Pipeline(
        name=new_name,
        description=original.description,
        owner_id=user_id,
    )
    db.add(new_pipeline)
    await db.flush()

    # Copy the latest version if one exists
    if original.current_version_id is not None:
        result = await db.execute(
            select(PipelineVersion).where(
                PipelineVersion.id == original.current_version_id
            )
        )
        latest_version = result.scalar_one_or_none()
        if latest_version is not None:
            new_version = PipelineVersion(
                pipeline_id=new_pipeline.id,
                version_number=1,
                config=latest_version.config,
                cost_snapshot=latest_version.cost_snapshot,
                description=latest_version.description,
            )
            db.add(new_version)
            await db.flush()
            new_pipeline.current_version_id = new_version.id
            await db.flush()

    return new_pipeline

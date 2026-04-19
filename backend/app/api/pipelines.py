from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.pipeline import PipelineVersion
from app.models.user import User
from app.schemas.pipeline import (
    PipelineCopyRequest,
    PipelineCreate,
    PipelineListOut,
    PipelineOut,
    PipelineUpdate,
    PipelineVersionCreate,
    PipelineVersionOut,
)
from app.services import pipeline_service

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


@router.get("/", response_model=list[PipelineListOut])
async def list_pipelines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PipelineListOut]:
    pipelines = await pipeline_service.get_user_pipelines(db, current_user.id)
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


@router.post("/", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    payload: PipelineCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineOut:
    pipeline = await pipeline_service.create_pipeline(db, current_user.id, payload)
    return PipelineOut.model_validate(pipeline)


@router.get("/{pipeline_id}", response_model=PipelineOut)
async def get_pipeline(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineOut:
    pipeline = await pipeline_service.get_pipeline(db, pipeline_id, current_user.id)
    return PipelineOut.model_validate(pipeline)


@router.put("/{pipeline_id}", response_model=PipelineOut)
async def update_pipeline(
    pipeline_id: int,
    payload: PipelineUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineOut:
    pipeline = await pipeline_service.update_pipeline(
        db, pipeline_id, current_user.id, payload
    )
    return PipelineOut.model_validate(pipeline)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await pipeline_service.delete_pipeline(db, pipeline_id, current_user.id)


@router.post(
    "/{pipeline_id}/versions",
    response_model=PipelineVersionOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_version(
    pipeline_id: int,
    payload: PipelineVersionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineVersionOut:
    version = await pipeline_service.save_version(
        db,
        pipeline_id,
        current_user.id,
        config=payload.config,
        description=payload.description,
    )
    return PipelineVersionOut.model_validate(version)


@router.get("/{pipeline_id}/versions", response_model=list[PipelineVersionOut])
async def list_versions(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PipelineVersionOut]:
    versions = await pipeline_service.get_versions(db, pipeline_id, current_user.id)
    return [PipelineVersionOut.model_validate(v) for v in versions]


@router.get(
    "/{pipeline_id}/versions/{version_id}", response_model=PipelineVersionOut
)
async def get_version(
    pipeline_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineVersionOut:
    version = await pipeline_service.get_version(
        db, pipeline_id, version_id, current_user.id
    )
    return PipelineVersionOut.model_validate(version)


@router.post("/{pipeline_id}/copy", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
async def copy_pipeline(
    pipeline_id: int,
    payload: PipelineCopyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineOut:
    pipeline = await pipeline_service.copy_pipeline(
        db, pipeline_id, current_user.id, payload.name
    )
    return PipelineOut.model_validate(pipeline)

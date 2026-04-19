from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.pipeline import Pipeline, PipelineVersion
from app.models.user import User
from app.schemas.compare import CompareItem, CompareRequest, CompareResponse
from app.schemas.trend import TrendPoint, TrendRequest, TrendResponse

router = APIRouter(prefix="/api", tags=["compare"])


@router.post("/compare", response_model=CompareResponse)
async def compare_pipelines(
    payload: CompareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompareResponse:
    """Compare multiple pipelines' latest costs."""
    if len(payload.pipeline_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least two pipeline IDs are required for comparison",
        )

    items: list[CompareItem] = []
    best_pipeline_id: int | None = None
    lowest_cost: float | None = None

    for pid in payload.pipeline_ids:
        # Fetch pipeline (must belong to current user)
        result = await db.execute(
            select(Pipeline).where(
                Pipeline.id == pid,
                Pipeline.owner_id == current_user.id,
            )
        )
        pipeline = result.scalar_one_or_none()
        if pipeline is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pipeline {pid} not found",
            )

        # Fetch current version's cost_snapshot
        cost_snapshot: dict | None = None
        if pipeline.current_version_id is not None:
            result = await db.execute(
                select(PipelineVersion).where(
                    PipelineVersion.id == pipeline.current_version_id
                )
            )
            version = result.scalar_one_or_none()
            if version is not None:
                cost_snapshot = version.cost_snapshot

        # Extract fields from cost_snapshot
        e2e_total_cost = None
        unit_cost = None
        unit_label = None
        target_qps = None
        node_count = None
        total_gpu_cost = None

        if cost_snapshot is not None:
            e2e_total_cost = cost_snapshot.get("e2e_total_cost")
            unit_cost = cost_snapshot.get("unit_cost")
            unit_label = cost_snapshot.get("unit_label")
            target_qps = cost_snapshot.get("target_qps")
            node_count = cost_snapshot.get("node_count")
            total_gpu_cost = cost_snapshot.get("total_gpu_cost")

        item = CompareItem(
            pipeline_id=pipeline.id,
            pipeline_name=pipeline.name,
            e2e_total_cost=e2e_total_cost,
            unit_cost=unit_cost,
            unit_label=unit_label,
            target_qps=target_qps,
            node_count=node_count,
            total_gpu_cost=total_gpu_cost,
        )
        items.append(item)

        # Track best (lowest e2e_total_cost)
        if e2e_total_cost is not None:
            if lowest_cost is None or e2e_total_cost < lowest_cost:
                lowest_cost = e2e_total_cost
                best_pipeline_id = pipeline.id

    return CompareResponse(items=items, best_pipeline_id=best_pipeline_id)


@router.post("/trend", response_model=TrendResponse)
async def get_cost_trend(
    payload: TrendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrendResponse:
    """Get cost trend for a pipeline across all versions."""
    # Verify pipeline ownership
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == payload.pipeline_id,
            Pipeline.owner_id == current_user.id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    # Fetch all versions ordered by version_number
    result = await db.execute(
        select(PipelineVersion)
        .where(PipelineVersion.pipeline_id == pipeline.id)
        .order_by(PipelineVersion.version_number.asc())
    )
    versions = result.scalars().all()

    points: list[TrendPoint] = []
    for v in versions:
        cost_snapshot = v.cost_snapshot
        e2e_total_cost = None
        unit_cost = None
        target_qps = None

        if cost_snapshot is not None:
            e2e_total_cost = cost_snapshot.get("e2e_total_cost")
            unit_cost = cost_snapshot.get("unit_cost")
            target_qps = cost_snapshot.get("target_qps")

        points.append(
            TrendPoint(
                version_number=v.version_number,
                created_at=v.created_at,
                e2e_total_cost=e2e_total_cost,
                unit_cost=unit_cost,
                target_qps=target_qps,
            )
        )

    return TrendResponse(pipeline_name=pipeline.name, points=points)

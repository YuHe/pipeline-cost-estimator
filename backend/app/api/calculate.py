from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.calculate import CalculateRequest, CalculateResponse
from app.services.calculation import calculate_pipeline_cost

router = APIRouter(prefix="/api", tags=["calculate"])


@router.post("/calculate", response_model=CalculateResponse)
async def calculate(
    payload: CalculateRequest,
    current_user: User = Depends(get_current_user),
) -> CalculateResponse:
    try:
        result = calculate_pipeline_cost(payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return result

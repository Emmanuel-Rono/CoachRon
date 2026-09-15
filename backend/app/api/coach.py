
from fastapi import APIRouter, HTTPException

from app.schemas.coach import CoachRequest, CoachResponse
from app.services.coaching_service import coaching_service


router = APIRouter(prefix="/api", tags=["coach"])


@router.post("/coach", response_model=CoachResponse)
def coach(request: CoachRequest) -> CoachResponse:
    """Generate one focused coaching response for a learner message."""
    try:
        return coaching_service.coach(request.message)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Coach Ron is temporarily unavailable. Please try again.",
        ) from error


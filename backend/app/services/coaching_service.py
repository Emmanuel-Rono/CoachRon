
from langchain_core.messages import HumanMessage, SystemMessage

from app.prompts.coach_prompt import Coach_Ron_System_Prompt
from app.schemas.coach import CoachResponse
from app.services.ollama_client import get_ollama_client



class CoachingService:
    def __init__(self) -> None:
        model = get_ollama_client()
        self.coach_model = model.with_structured_output(
            CoachResponse,
            method="json_schema",
        )

    def coach(self, message: str) -> CoachResponse:
        return self.coach_model.invoke(
            [
                SystemMessage(content=Coach_Ron_System_Prompt),
                HumanMessage(content=message),
            ]
        )


coaching_service = CoachingService()

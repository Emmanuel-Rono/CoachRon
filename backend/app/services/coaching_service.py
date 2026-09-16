
from langchain_core.messages import HumanMessage, SystemMessage

from app.prompts.coach_prompt import Coach_Ron_System_Prompt
from app.schemas.coach import CoachResponse
from app.services.ollama_client import get_ollama_client

class CoachingService:
    def __init__(self):
        model= get_ollama_client()
        self.OllamaModel = model.with_structured_output(
            CoachResponse, method ="json_schema")
        
    def get_coach_response(self, message: str) -> CoachResponse:
        return self.OllamaModel.invoke(
            [
                SystemMessage(content=Coach_Ron_System_Prompt),
                HumanMessage(content= message),
            ]
        )

coaching_service = CoachingService()
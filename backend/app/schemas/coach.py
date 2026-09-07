from pydantic import BaseModel, Field


class CoachRequest(BaseModel):
    message: str = Field(
        min_length=1,
           max_length=1000,
                 description="The message to send to the coach."
    )

    class CoachResponse(BaseModel):
        reply_text: str
        positive_observation: str
        immediate_action: str
        area_for_improvement: str
        practise_prompt: str
        
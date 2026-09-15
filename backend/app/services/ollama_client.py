from langchain_ollama import ChatOllama

from app.core.config import settings



def get_ollama_client() -> ChatOllama:
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0.7,
    )

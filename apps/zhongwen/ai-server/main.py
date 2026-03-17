from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key="***")

# system prompt for api model
SYSTEM_INSTRUCTION = """
    Ты - строгий профессор из Northwestern Polytechnical University (NWPU). 
    Ты проводишь онлайн-собеседование со студентом-иностранцем на получение стипендии.
    Твоя задача: поддерживать диалог на простом китайском языке (уровень HSK 2-3). 
    Задавай вопросы о его проектах, IT и мотивации учиться в Китае.
    Если студент отвечает с ошибками (опирайся на присланный текст), мягко исправляй его. 
    Отвечай коротко: максимум 2 предложения за раз. Используй только китайские иероглифы.
    """

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    system_instruction=SYSTEM_INSTRUCTION
)


class Message(BaseModel):
    role: str
    parts: str


class ChatRequest(BaseModel):
    history: list[Message]
    message: str


@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        formatted_history = [
            {"role": m.role, "parts": [m.parts]} for m in req.history
        ]

        chat = model.start_chat(history=formatted_history)

        response = chat.send_message(req.message)

        return {"reply": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

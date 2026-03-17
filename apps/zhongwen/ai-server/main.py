from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import tempfile
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key="***")

SYSTEM_INSTRUCTION = """
Ты - строгий профессор из Northwestern Polytechnical University (NWPU). 
Ты проводишь онлайн-собеседование со студентом-иностранцем на получение стипендии.
Твоя задача: поддерживать диалог на простом китайском языке (уровень HSK 2-3). 
Если студент отвечает с ошибками (опирайся на присланный текст), мягко исправляй его. 
Отвечай коротко: максимум 2 предложения за раз. Используй только китайские иероглифы.
"""


@app.post("/chat")
async def chat_endpoint(
    audio: UploadFile = File(...),
    history: str = Form("[]")
):
    history_list = json.loads(history)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        # Whisper API
        with open(tmp_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="zh"
            )

        user_text = transcription.text.strip()

        if not user_text:
            return {"reply": "Простите, я вас не расслышал. Повторите, пожалуйста.", "user_text": ""}

        # 2. contexting for GPT-4o-mini
        messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]

        for m in history_list:
            role = "assistant" if m["role"] == "model" else "user"
            messages.append({"role": role, "content": m["parts"]})

        messages.append({"role": "user", "content": user_text})

        # reaching LLM
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages
        )

        reply = completion.choices[0].message.content

        return {"reply": reply, "user_text": user_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.remove(tmp_path)

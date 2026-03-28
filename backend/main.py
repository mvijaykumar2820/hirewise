from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import PyPDF2
from dotenv import load_dotenv

load_dotenv()

from agents.discovery import run_discovery_agent
from agents.recruiter import generate_recruiter_test, evaluate_recruiter_test
from agents.interviewer import conduct_interview_turn
from agents.decision_room import run_decision_room

app = FastAPI(title="The Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "The Orchestrator API is Live and Agentic."}

@app.post("/api/phase1_discovery")
async def run_phase1(
    hr_preferences: str = Form("Find top tech talent."),
    resume: UploadFile = File(None)
):
    resume_text = ""
    if resume:
        content = await resume.read()
        if resume.filename.endswith('.pdf'):
            from io import BytesIO
            reader = PyPDF2.PdfReader(BytesIO(content))
            for page in reader.pages:
                resume_text += page.extract_text() + "\n"
        else:
            resume_text = content.decode('utf-8', errors='ignore')

    candidate_data = {
        "resume_text": resume_text,
        "github_url": "",
        "linkedin_url": ""
    }
    
    discovery_result = await run_discovery_agent("candidate", candidate_data, hr_preferences)
    reasoning = discovery_result.get("ranking_analysis", {}).get("reasoning", "")
    questions = await generate_recruiter_test(reasoning)
    
    return {"questions": questions, "analysis_preview": discovery_result}


class TestEvaluationRequest(BaseModel):
    questions: List[str]
    answers: List[str]

class InterviewTurnRequest(BaseModel):
    chat_history: List[Dict[str, str]]
    latest_message: str

class DecisionRoomRequest(BaseModel):
    candidate_data: dict
    transcript: str

@app.post("/api/phase2_evaluate")
async def run_phase2(req: TestEvaluationRequest):
    report = await evaluate_recruiter_test(req.questions, req.answers)
    return {"report": report}

@app.post("/api/phase3_interview")
async def run_phase3(req: InterviewTurnRequest):
    from langchain_core.messages import HumanMessage, AIMessage
    messages = []
    for m in req.chat_history:
        if m["type"] == "human":
            messages.append(HumanMessage(content=m["content"]))
        else:
            messages.append(AIMessage(content=m["content"]))
            
    response_text = await conduct_interview_turn(messages, req.latest_message)
    return {"response": response_text}

@app.post("/api/phase4_decision")
async def run_phase4(req: DecisionRoomRequest):
    decision_result = await run_decision_room(req.candidate_data, req.transcript)
    return decision_result

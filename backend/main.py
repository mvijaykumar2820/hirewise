from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from agents.discovery import run_discovery_agent
from agents.recruiter import generate_recruiter_test, evaluate_recruiter_test
from agents.interviewer import conduct_interview_turn
from agents.decision_room import run_decision_room

from firebase import get_db

app = FastAPI(title="The Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CandidateSubmission(BaseModel):
    job_id: str
    candidate_id: str
    resume_text: str = ""
    github_url: str = ""
    linkedin_url: str = ""

class TestEvaluationRequest(BaseModel):
    job_id: str
    candidate_id: str
    questions: List[str]
    answers: List[str]

class InterviewTurnRequest(BaseModel):
    job_id: str
    candidate_id: str
    chat_history: List[Dict[str, str]]
    latest_message: str

class DecisionRoomRequest(BaseModel):
    job_id: str
    candidate_id: str

@app.get("/")
def read_root():
    return {"status": "The Orchestrator API is Live and Agentic."}

@app.post("/api/phase1_discovery")
async def run_phase1(req: CandidateSubmission):
    db = get_db()
    job_ref = db.collection("jobs").document(req.job_id)
    job_doc = job_ref.get()
    
    if not job_doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")
        
    hr_preferences = job_doc.to_dict().get("aiPreferences", "Find top tech talent.")
    
    # 1. Discovery Agent
    discovery_result = await run_discovery_agent(req.candidate_id, req.dict(), hr_preferences)
    
    # 2. Recruiter Test Generator
    reasoning = discovery_result.get("ranking_analysis", {}).get("reasoning", "")
    questions = await generate_recruiter_test(reasoning)
    
    # Update candidate in DB
    cand_ref = db.collection("jobs").document(req.job_id).collection("candidates").document(req.candidate_id)
    cand_ref.set({
        "status": "Screening",
        "discovery_analysis": discovery_result,
        "pending_test_questions": questions,
        "name": req.candidate_id
    }, merge=True)
    
    return {"questions": questions, "analysis_preview": discovery_result}

@app.post("/api/phase2_evaluate")
async def run_phase2(req: TestEvaluationRequest):
    # Evaluate answers
    report = await evaluate_recruiter_test(req.questions, req.answers)
    
    db = get_db()
    cand_ref = db.collection("jobs").document(req.job_id).collection("candidates").document(req.candidate_id)
    cand_ref.update({
        "status": "Interview",
        "test_eval_report": report
    })
    return {"report": report}

@app.post("/api/phase3_interview")
async def run_phase3(req: InterviewTurnRequest):
    from langchain_core.messages import HumanMessage, AIMessage
    
    # Convert dict history to LangChain messages
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
    db = get_db()
    cand_ref = db.collection("jobs").document(req.job_id).collection("candidates").document(req.candidate_id)
    cand_doc = cand_ref.get()
    
    if not cand_doc.exists:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    data = cand_doc.to_dict()
    transcript = "Simulated Live WebSocket Interview completed."
    
    decision_result = await run_decision_room(data, transcript)
    
    cand_ref.update({
        "status": "Evaluated",
        "decision_room_log": decision_result["agents_debate_log"],
        "final_decision_xai": decision_result["final_decision_xai"]
    })
    
    return decision_result

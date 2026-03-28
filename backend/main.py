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
    try:
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
        score = discovery_result.get("ranking_analysis", {}).get("potential_score", 50)
        reasoning = discovery_result.get("ranking_analysis", {}).get("reasoning", "")
        
        if score < 50:
            return {
                "status": "rejected", 
                "analysis_preview": discovery_result,
                "first_message": "Thank you for sharing your resume. Unfortunately, based on the job requirements, we won't be moving forward with your application at this time."
            }

        # If passed, generate dynamic targeted opening question using the Phase 3 Interview Agent!
        from langchain_core.messages import SystemMessage
        from agents.interviewer import conduct_interview_turn
        from agents.recruiter import generate_recruiter_test
        
        questions_list = await generate_recruiter_test(reasoning, resume_text)
        
        context_msg = SystemMessage(content=f"Background: Candidate passed screening. AI Analysis: {reasoning}. Job Context: {hr_preferences}\n\nCandidate Raw Resume:\n{resume_text}")
        dynamic_opening = await conduct_interview_turn(
            chat_history=[context_msg],
            latest_user_msg="Please introduce yourself briefly as the AI Hiring Manager and ask exactly one highly personalized, probing question based directly on my resume analysis to start the interview."
        )
        
        return {
            "status": "accepted", 
            "analysis_preview": discovery_result, 
            "recruiter_questions": "\n\n".join(questions_list),
            "first_message": dynamic_opening
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Phase 1 AI Processing failed: {str(e)}")


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
    try:
        from langchain_core.messages import HumanMessage, AIMessage
        messages = []
        for m in req.chat_history:
            if m.get("type") in ["human", "user"]:
                messages.append(HumanMessage(content=m["content"]))
            else:
                messages.append(AIMessage(content=m["content"]))
                
        response_text = await conduct_interview_turn(messages, req.latest_message)
        return {"response": response_text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Phase 3 AI Interview failed: {str(e)}")

@app.post("/api/phase4_decision")
async def run_phase4(req: DecisionRoomRequest):
    try:
        decision_result = await run_decision_room(req.candidate_data, req.transcript)
        return decision_result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Phase 4 Decision Room failed: {str(e)}")

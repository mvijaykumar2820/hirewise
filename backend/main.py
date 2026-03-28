from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import PyPDF2
from dotenv import load_dotenv

load_dotenv()

from agents.discovery import run_discovery_agent
from agents.recruiter import generate_recruiter_test, evaluate_recruiter_test
from agents.interviewer import conduct_interview_turn, evaluate_interview
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
    resume: UploadFile = File(None),
    github_url: str = Form("")
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
            "github_url": github_url,
        }
        
        # Scrape GitHub profile if URL provided
        github_analysis = ""
        if github_url and github_url.strip():
            from agents.github_scraper import scrape_github_profile, format_github_for_ai
            print(f"[BRIGHTDATA] Scraping GitHub profile: {github_url}")
            github_data = await scrape_github_profile(github_url.strip())
            github_analysis = format_github_for_ai(github_data)
            candidate_data["github_data"] = github_data
            print(f"[BRIGHTDATA] GitHub scrape complete: {len(github_data.get('repos', []))} repos found")
        
        # Pass GitHub data along with resume to discovery agent
        enriched_resume = resume_text
        if github_analysis:
            enriched_resume += f"\n\n{github_analysis}"
        
        discovery_result = await run_discovery_agent("candidate", candidate_data, hr_preferences)
        score = discovery_result.get("ranking_analysis", {}).get("potential_score", 50)
        reasoning = discovery_result.get("ranking_analysis", {}).get("reasoning", "")
        
        if score < 50:
            return {
                "status": "rejected", 
                "score": score,
                "analysis_preview": discovery_result,
                "first_message": f"Thank you for applying. After careful analysis, our AI Screening Agent has determined that your profile does not meet the requirements for this role (Score: {score}/100). Reason: {reasoning}"
            }

        # If passed, generate dynamic targeted opening question using the Phase 3 Interview Agent!
        from langchain_core.messages import SystemMessage
        from agents.interviewer import conduct_interview_turn
        from agents.recruiter import generate_recruiter_test
        
        questions_list = await generate_recruiter_test(reasoning, enriched_resume, github_analysis)
        print(f"[DEBUG] Recruiter generated {len(questions_list)} questions: {questions_list}")
        
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

class InterviewEvalRequest(BaseModel):
    transcript: List[Dict[str, str]]
    tab_switches: int = 0

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

@app.post("/api/phase3_evaluate")
async def run_phase3_evaluate(req: InterviewEvalRequest):
    try:
        report = await evaluate_interview(req.transcript, req.tab_switches)
        return {"report": report}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Phase 3 Evaluation failed: {str(e)}")

@app.post("/api/phase4_decision")
async def run_phase4(req: DecisionRoomRequest):
    try:
        decision_result = await run_decision_room(req.candidate_data, req.transcript)
        return decision_result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Phase 4 Decision Room failed: {str(e)}")

@app.post("/api/cleanup")
async def cleanup_candidates():
    """Temp endpoint: Delete all candidate data from all jobs, reset counters."""
    from firebase import get_db
    fdb = get_db()
    deleted = 0
    jobs = fdb.collection("jobs").stream()
    for job in jobs:
        cands = fdb.collection("jobs").document(job.id).collection("candidates").stream()
        for c in cands:
            c.reference.delete()
            deleted += 1
        job.reference.update({"applicants": 0, "passed": 0})
    return {"status": "cleaned", "candidates_deleted": deleted}

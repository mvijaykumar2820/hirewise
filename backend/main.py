from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="The Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CandidateSubmission(BaseModel):
    resume_text: str
    github_url: str = ""
    linkedin_url: str = ""
    leetcode_url: str = ""

@app.get("/")
def read_root():
    return {"status": "The Orchestrator is running"}

@app.post("/api/submit_candidate")
async def submit_candidate(data: CandidateSubmission):
    # This will trigger Phase 1 and 2
    return {"status": "received", "data": data}

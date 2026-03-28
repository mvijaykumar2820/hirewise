import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import asyncio

def get_featherless_llm(model="meta-llama/Meta-Llama-3.1-70B-Instruct"):
    # Using Llama 3.1 70B for strict JSON output compliance over DeepSeek R1 for this specific task
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
        model_kwargs={"extra_body": {"max_tokens": 4096}}
    )

async def gather_non_traditional_signals(candidate_data: dict):
    """
    Simulates mining work artifacts, online activity, and project history.
    In a real scenario, this uses BrightData to scrape GitHub PRs, StackOverflow, Medium, etc.
    """
    await asyncio.sleep(1) # Simulate network call
    
    # Mocking rich non-traditional data fetching
    # Instead of hallucinating, we extract key words from their actual resume if present
    # This keeps the 'non-traditional signals' architecture intact for the demo
    resume_lower = str(candidate_data.get("resume_text", "")).lower()
    return {
        "work_artifacts": [
            "Discovered GitHub footprint matching projects listed in resume.",
        ] if "github" in resume_lower else ["No public code repositories found."],
        "online_activity": [
            "Candidate has active online presence."
        ],
        "project_history": [
            f"Extracted {len(resume_lower.split())} words of direct project context from resume."
        ]
    }

async def run_discovery_agent(candidate_id: str, candidate_data: dict, hr_preferences: str):
    llm = get_featherless_llm()
    
    signals = await gather_non_traditional_signals(candidate_data)
    
    sys_prompt = """You are the 'Deep Discovery Agent', an elite technical recruiter AI for a top-tier tech firm. 

Your task is to rigorously evaluate the candidate's Resume and Signals against the exact Job Requirements.
Rule 1: If the job requires Senior-level experience but the candidate only has junior, academic, or mismatched projects, penalize their score heavily (below 40).
Rule 2: Do NOT be generous. Only award a passing score (> 50) if their actual documented experience clearly aligns with the core requirements and seniority of the job.

You MUST respond with ONLY a valid JSON object matching this schema exactly:
{
  "candidate_id": "string",
  "potential_score": int (0 to 100),
  "reasoning": "Detailed, highly critical evaluation of whether their specific past projects objectively meet the seniority and technical domains required by the job.",
  "key_artifacts_found": ["string", "string"]
}
Do not include markdown blocks like ```json. Output raw JSON."""

    user_prompt = f"""
Candidate ID: {candidate_id}

HR Preferences / AI Screening Instructions:
{hr_preferences}

Candidate Raw Resume Text:
{candidate_data.get('resume_text', 'No resume text provided.')[:3000]}

Candidate Non-Traditional Signals (Gathered from the web):
Work Artifacts: {signals['work_artifacts']}
Online Activity: {signals['online_activity']}

Evaluate this candidate's Resume Text and Signals against the HR Preferences and return the JSON object."""
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_prompt)
    ])
    
    raw_content = response.content.strip()
    if raw_content.startswith("```json"):
        raw_content = raw_content[7:]
    if raw_content.endswith("```"):
        raw_content = raw_content[:-3]
    raw_content = raw_content.strip()
        
    try:
        ranked_payload = json.loads(raw_content)
    except Exception as e:
        print("Failed to parse JSON:", raw_content)
        ranked_payload = {
            "candidate_id": candidate_id,
            "potential_score": 50,
            "reasoning": "Failed to generate structured reasoning from signals.",
            "key_artifacts_found": []
        }
        
    return {
        "signals_gathered": signals,
        "ranking_analysis": ranked_payload
    }

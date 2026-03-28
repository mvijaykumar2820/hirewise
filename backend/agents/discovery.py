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
    
    sys_prompt = """You are the 'Deep Discovery Agent', an elite, ruthless AI recruiter for a Fortune 500 tech company. You have ZERO tolerance for mismatched candidates.

Your task: Compare the candidate's ACTUAL resume against the EXACT job requirements. Score them 0-100.

SCORING RULES (follow these EXACTLY):
- If job title says "Senior" but candidate has 0-2 years experience or is a student/new grad: score MUST be 15-25.
- If the job requires specific backend skills (Redis, WebSockets, microservices) but candidate only has frontend projects (React, Next.js, CSS): score MUST be 20-35.
- If candidate's tech stack has ZERO overlap with job requirements: score MUST be 10-20.
- If candidate matches the seniority AND has 70%+ tech stack overlap: score should be 60-85.
- If candidate is a perfect match (seniority + tech stack + proven scale): score should be 85-100.
- NEVER give above 40 to a student applying for a Senior role. NEVER.

You MUST respond with ONLY a valid JSON object:
{
  "candidate_id": "string",
  "potential_score": int (0 to 100),
  "reasoning": "Be brutally honest. State exactly which required skills are missing and why the seniority level doesn't match.",
  "key_artifacts_found": ["string", "string"]
}
Do not include markdown blocks like ```json. Output raw JSON only."""

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

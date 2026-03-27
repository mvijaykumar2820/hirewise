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
    )

async def gather_non_traditional_signals(candidate_data: dict):
    """
    Simulates mining work artifacts, online activity, and project history.
    In a real scenario, this uses BrightData to scrape GitHub PRs, StackOverflow, Medium, etc.
    """
    await asyncio.sleep(1) # Simulate network call
    
    # Mocking rich non-traditional data fetching
    return {
        "work_artifacts": [
            "Merged complex PR in open-source framework fixing race condition.",
            "Wrote a custom memory allocator in C++ for a personal game engine.",
        ],
        "online_activity": [
            "Top 5% answerer in Rust category on StackOverflow.",
            "Technical blog post analyzing performance disparities in React 18."
        ],
        "project_history": [
            "Built and scaled a decentralized chat app to 10k users solo.",
            "Created a VSCode extension with 50k+ installs."
        ]
    }

async def run_discovery_agent(candidate_id: str, candidate_data: dict, hr_preferences: str):
    llm = get_featherless_llm()
    
    signals = await gather_non_traditional_signals(candidate_data)
    
    sys_prompt = """You are the 'Deep Discovery Agent', an AI designed to identify high-potential individuals using non-traditional signals (work artifacts, online activity, project history) instead of relying on standard resumes or pedigrees.

Your task is to analyze the candidate's signals against the HR's specific preferences, and output a structured ranking.

You MUST respond with ONLY a valid JSON object matching this schema exactly:
{
  "candidate_id": "string",
  "potential_score": int (0 to 100),
  "reasoning": "Deep reasoning explaining why this candidate is high-potential based *specifically* on their artifacts and activity.",
  "key_artifacts_found": ["string", "string"]
}
Do not include markdown blocks like ```json. Output raw JSON."""

    user_prompt = f"""
Candidate ID: {candidate_id}

HR Preferences / AI Screening Instructions:
{hr_preferences}

Candidate Non-Traditional Signals:
Work Artifacts: {signals['work_artifacts']}
Online Activity: {signals['online_activity']}
Project History: {signals['project_history']}

Evaluate this candidate and return the JSON object."""
    
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

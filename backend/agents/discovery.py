import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import httpx
import asyncio

def get_featherless_llm(model="deepseek-ai/DeepSeek-R1"):
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
    )

async def scrape_bright_data(linkedin_url: str, github_url: str):
    """
    Implementation of Bright Data scraping for Hackathon.
    In a live hackathon environment, simulating this ensures zero downtime if the scraper blocks.
    """
    await asyncio.sleep(1) # Simulate network call
    data = {
        "github_metrics": {
            "public_repos": 15,
            "followers": 120,
            "top_languages": ["Python", "JavaScript", "TypeScript"],
            "recent_pr_comments": "Focuses heavily on code modularity and maintainability.",
        },
        "linkedin_metrics": {
            "connections": 500,
            "years_experience": 4,
            "current_role": "Software Engineer"
        }
    }
    return data

async def run_discovery_agent(resume_text: str, linkedin_url: str, github_url: str):
    llm = get_featherless_llm(model="deepseek-ai/DeepSeek-R1")
    
    # 1. Scrape digital footprints
    footprint_data = await scrape_bright_data(linkedin_url, github_url)
    
    # 2. Analyze footprints vs resume
    sys_prompt = "You are an expert AI Technical Recruiter (The Artifact Miner). Analyze the candidate's resume and digital footprint. Provide a deep reasoning report on their technical skills, soft skills (like conflict resolution based on PR comments), and seniority potential."
    user_prompt = f"Resume:\n{resume_text}\n\nDigital Footprint:\n{footprint_data}\n\nReason and analyze this candidate deeply."
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_prompt)
    ])
    
    return {
        "digital_footprint_data": footprint_data,
        "resume_analysis": response.content
    }

import os
import asyncio
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

def get_featherless_llm(model="meta-llama/Meta-Llama-3.1-70B-Instruct"):
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
        max_tokens=4096
    )

async def run_decision_room(candidate_data: dict, interview_transcript: str):
    """
    Simulates how real hiring decisions are made across multiple stakeholders.
    Reflects tradeoffs, disagreements, and executive synthesis.
    """
    llm = get_featherless_llm("meta-llama/Meta-Llama-3.1-405B-Instruct") 
    
    # 3 distinct roles for the Decision Simulator
    recruiter_prompt = "You are Agent A (The Recruiter). You are desperate to fill the role quickly, but you care about culture fit. You will rigorously defend the candidate if they show non-traditional hustle, but you hate when candidates sound robotic or AI-generated. Read the data and argue your case."
    hm_prompt = "You are Agent B (The Hiring Manager). You only care about technical excellence, deep thinking, and long-term business impact. You are highly skeptical of buzzwords. Read the candidate data and transcript, and aggressively critique their technical depth."
    compliance_prompt = "You are Agent C (Risk/Compliance). You flag potential bias, institutional pedigree considerations, and cheating risks. You ensure alignment with HR guidelines. You are strictly objective and cautious."
    
    payload = f"Candidate Data:\n{candidate_data}\n\nTranscript:\n{interview_transcript}"
    
    # Run the initial debate in parallel
    results = await asyncio.gather(
        llm.ainvoke([SystemMessage(content=recruiter_prompt), HumanMessage(content=payload)]),
        llm.ainvoke([SystemMessage(content=hm_prompt), HumanMessage(content=payload)]),
        llm.ainvoke([SystemMessage(content=compliance_prompt), HumanMessage(content=payload)])
    )
    
    recruiter_case, hm_case, compliance_case = [r.content for r in results]
    
    # Orchestrator resolves the debate
    consensus_prompt = """You are 'The Orchestrator'. You lead the final hiring decision room.
Read the heated arguments from the Recruiter, Hiring Manager, and Risk Officer. 
Reflect the tradeoffs, synthesize the deep disagreements, and make a FINAL ruling: HIRE or REJECT.
This must read like a dramatic execution summary from a real decision room, not a scoring script."""
    
    debate_log = f"--- DECISION ROOM LOG ---\n\n*Recruiter (Focus: Hustle & Speed):*\n{recruiter_case}\n\n*Hiring Manager (Focus: Tech Depth & Risk):*\n{hm_case}\n\n*Compliance Officer (Focus: Cheating & Guidelines):*\n{compliance_case}"
    
    final_decision = await llm.ainvoke([
        SystemMessage(content=consensus_prompt),
        HumanMessage(content=debate_log)
    ])
    
    return {
        "agents_debate_log": debate_log,
        "final_decision_xai": final_decision.content
    }

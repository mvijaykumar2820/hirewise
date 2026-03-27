import os
import asyncio
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

async def run_decision_room(candidate_data: dict, interview_transcript: str):
    """
    Simulates a debate between the Recruiter, Hiring Manager, and Compliance Officer.
    Finally, The Orchestrator reaches a consensus or documents a split decision.
    """
    llm = ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model="deepseek-ai/DeepSeek-R1"
    )
    
    # 3 distinct roles for the Decision Simulator
    recruiter_prompt = "You are Agent A (The Recruiter). Focus on Time-to-Productivity and culture fit. Try to find the non-traditional signals that point to high ROI. Read the candidate data and interview transcript, and argue your case."
    hm_prompt = "You are Agent B (The Hiring Manager). Focus on technical Quality of Hire and long-term business impact. Read the candidate data and transcript, and argue your case objectively."
    compliance_prompt = "You are Agent C (The Compliance Officer). Flag potential bias and Institutional Pedigree considerations. Ensure alignment with the EU AI Act. Argue your case safely."
    
    payload = f"Candidate Data:\n{candidate_data}\n\nTranscript:\n{interview_transcript}"
    
    # Run the initial debate in parallel
    results = await asyncio.gather(
        llm.ainvoke([SystemMessage(content=recruiter_prompt), HumanMessage(content=payload)]),
        llm.ainvoke([SystemMessage(content=hm_prompt), HumanMessage(content=payload)]),
        llm.ainvoke([SystemMessage(content=compliance_prompt), HumanMessage(content=payload)])
    )
    
    recruiter_case, hm_case, compliance_case = [r.content for r in results]
    
    # Generate the Final Explainable AI (XAI) output
    consensus_prompt = "You are 'The Orchestrator'. Read the arguments from the Recruiter, Hiring Manager, and Compliance Officer. Output a structured final decision (Explainable AI report) detailing the tradeoffs and whether to HIRE or REJECT the candidate."
    
    debate_log = f"*Recruiter Agent:*\n{recruiter_case}\n\n*Hiring Manager Agent:*\n{hm_case}\n\n*Compliance Officer Agent:*\n{compliance_case}"
    
    final_decision = await llm.ainvoke([
        SystemMessage(content=consensus_prompt),
        HumanMessage(content=debate_log)
    ])
    
    return {
        "agents_debate_log": debate_log,
        "final_decision_xai": final_decision.content
    }

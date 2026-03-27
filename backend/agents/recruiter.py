import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

async def generate_recruiter_test(resume_analysis: str):
    llm = ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model="meta-llama/Meta-Llama-3.1-405B-Instruct" 
    )
    
    sys_prompt = "You are Agent A (The Recruiter). Focus on Time-to-Productivity. Based on the candidate's discovery analysis, generate EXACTLY 3 targeted technical/behavioral screening questions."
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=f"Discovery Analysis:\n{resume_analysis}\n\nGenerate the 3 questions as a numbered list.")
    ])
    
    # Parse the questions loosely
    questions = [q.strip() for q in response.content.split('\n') if q.strip() and q.strip()[0].isdigit()]
    if not questions:
        questions = [response.content.strip()]
        
    return questions

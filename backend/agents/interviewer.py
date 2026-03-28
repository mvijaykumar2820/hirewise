import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage

async def conduct_interview_turn(chat_history: list[BaseMessage], latest_user_msg: str):
    llm = ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model="meta-llama/Meta-Llama-3.1-70B-Instruct",
        model_kwargs={"extra_body": {"max_tokens": 4096}}
    )
    
    sys_prompt = """You are Agent 3 (The HR Video Interviewer). You are conducting a live, rapid-fire video interview. 
Your primary goal is to:
1. Evaluate their actual human communication skills, agility, and behavioral fit.
2. Detect Cheating dynamically: If they take too long to answer or sound like they are reading from a script, aggressively call them out and pivot to an unexpected logical puzzle.
3. Answer any questions the candidate has about the company in a quick, real interview manner.

Keep responses concise, conversational, and highly probing. Do not break character."""
    
    messages = [SystemMessage(content=sys_prompt)] + chat_history + [HumanMessage(content=latest_user_msg)]
    
    response = await llm.ainvoke(messages)
    
    return response.content

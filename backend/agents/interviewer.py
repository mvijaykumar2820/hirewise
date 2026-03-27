import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage

async def conduct_interview_turn(chat_history: list[BaseMessage], latest_user_msg: str):
    llm = ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model="meta-llama/Meta-Llama-3.1-405B-Instruct"
    )
    
    sys_prompt = "You are Agent B (The Hiring Manager). Conduct a live interview. Use Dynamic Difficulty Adjustment (DDA). If they give a high-quality answer, pivot to a 'Stress Test' question probing the ceiling of their thinking. Evaluate linguistic consistency to detect GenAI cheating. Keep responses conversational and probing."
    
    messages = [SystemMessage(content=sys_prompt)] + chat_history + [HumanMessage(content=latest_user_msg)]
    
    response = await llm.ainvoke(messages)
    
    return response.content

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
    
    sys_prompt = """You are The AI Hiring Manager. You are conducting a live, rapid-fire text-chat interview with a candidate.
Your primary goal is to:
1. Evaluate their technical knowledge, communication skills, and behavioral fit based on their resume.
2. Ask one highly specific, probing question at a time. Do not overwhelm them with multi-part questions.
3. If they give a superficial answer like 'idk' or 'no', politely push them to explain their thought process on a technical challenge, but do not give them arbitrary riddles.

Keep your responses concise, conversational, and highly probing. Do not break character. Do NOT refer to yourself as 'Agent X'."""
    
    messages = [SystemMessage(content=sys_prompt)] + chat_history + [HumanMessage(content=latest_user_msg)]
    
    response = await llm.ainvoke(messages)
    
    return response.content

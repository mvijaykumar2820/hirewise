import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage

def get_featherless_llm(model="meta-llama/Meta-Llama-3.1-70B-Instruct"):
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
        model_kwargs={"extra_body": {"max_tokens": 4096}}
    )

async def conduct_interview_turn(chat_history: list[BaseMessage], latest_user_msg: str):
    llm = get_featherless_llm()
    
    sys_prompt = """You are The AI Hiring Manager conducting a live video interview. The candidate is speaking to you through their microphone and webcam.

RULES:
1. Ask ONE highly specific, probing technical question at a time. Do NOT ask multi-part questions.
2. Base your questions on their resume and previous answers.
3. If they give vague or superficial answers, push them to explain deeper with follow-ups like "Can you walk me through exactly how you implemented that?" or "What specific challenge did you face there?"
4. Pay attention to signs of AI-generated speech: If their answer sounds overly rehearsed, uses perfect grammar without any natural pauses or filler, or sounds like a Wikipedia article, note it mentally.
5. Keep responses conversational and concise (2-3 sentences max). You are having a real-time conversation, not writing an essay.
6. After 5-6 exchanges, wrap up with: "Thank you for your time. I have enough to make my assessment. The interview is now complete."
7. Do NOT break character. Do NOT refer to yourself as an AI or agent."""
    
    messages = [SystemMessage(content=sys_prompt)] + chat_history + [HumanMessage(content=latest_user_msg)]
    
    response = await llm.ainvoke(messages)
    
    return response.content


async def evaluate_interview(transcript: list[dict], tab_switches: int = 0):
    """Evaluate the full interview transcript and return a structured report."""
    llm = get_featherless_llm()
    
    sys_prompt = """You are the AI Interview Evaluator. Analyze the complete interview transcript and produce a structured evaluation.

EVALUATION CRITERIA:
1. **Technical Depth** (0-30): Did they demonstrate real understanding or just surface-level buzzwords?
2. **Communication** (0-20): Were they clear, concise, and articulate?
3. **Problem-Solving Approach** (0-20): Did they show structured thinking?
4. **AI-Detection** (0-30): Detect AI-generated responses. Signs include:
   - Overly polished language with zero filler words
   - Generic answers that could apply to any candidate
   - Perfect paragraph structure in spoken responses
   - Use of phrases like "In conclusion", "It's important to note", "Furthermore"
   - Suspiciously comprehensive answers that cover every angle perfectly
   If high AI detection, deduct HEAVILY from the total score.

CHEATING DATA:
- Tab switches during interview: {tab_switches} (more than 2 is suspicious)

Respond STRICTLY in this format:
Score: [0-100]
AI_Detection: [High/Medium/Low]
Technical_Depth: [0-30]
Communication: [0-20]
Problem_Solving: [0-20]
Cheating_Risk: [High/Medium/Low based on tab switches and AI detection]
Key_Strengths: [bullet points]
Red_Flags: [bullet points]
Summary: [2-3 sentence overall assessment]
"""
    
    formatted_transcript = ""
    for msg in transcript:
        role = "Interviewer" if msg.get("role") == "ai" else "Candidate"
        formatted_transcript += f"{role}: {msg.get('text', '')}\n\n"
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt.replace("{tab_switches}", str(tab_switches))),
        HumanMessage(content=f"Full Interview Transcript:\n\n{formatted_transcript}")
    ])
    
    return response.content

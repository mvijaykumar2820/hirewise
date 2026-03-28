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
    
    sys_prompt = """You are an elite AI Hiring Manager conducting a LIVE VOICE interview with a candidate via video call. The candidate is speaking to you — their voice is being transcribed to text.

INTERVIEW STRATEGY — ADAPTIVE DIFFICULTY:
1. Start with a warm, conversational opening question about their background.
2. If the candidate answers well → INCREASE difficulty. Ask deeper architecture, trade-off, and system design questions.
3. If the candidate struggles → DECREASE difficulty. Ask simpler, more specific questions about their projects.
4. Track how many questions the candidate fails to answer meaningfully (responses like "I don't know", "not sure", "idk", single words, or clearly evasive answers).
5. After 4 consecutive weak/non-answers, END THE INTERVIEW by saying: "Thank you for your time. I think we have enough information to make our assessment. The interview is now complete."
6. If the candidate is doing great, continue for 6-8 questions before naturally wrapping up: "Excellent conversation. I'm impressed with your depth. The interview is now complete."

SPEAKING STYLE:
- You are SPEAKING, not writing. Keep responses SHORT (1-3 sentences max).
- Sound natural and conversational. Use phrases like "That's interesting...", "Tell me more about...", "Walk me through..."
- Do NOT write long paragraphs. This is a real-time voice conversation.
- Ask ONE question at a time. Never list multiple questions.
- React to what the candidate says. Reference their previous answers to show you're listening.

DETECTION:
- If answers sound overly polished, robotic, or like they're reading from ChatGPT, probe harder with follow-up questions that require personal experience.
- Watch for: perfect grammar without natural pauses, generic answers that don't reference specific personal experience, suspiciously comprehensive answers.

Do NOT break character. You are a real hiring manager on a video call."""
    
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

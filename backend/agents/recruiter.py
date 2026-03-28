import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

def get_featherless_llm(model="meta-llama/Meta-Llama-3.1-70B-Instruct"):
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
        model_kwargs={"extra_body": {"max_tokens": 4096}}
    )

async def generate_recruiter_test(resume_analysis: str, resume_text: str = ""):
    llm = get_featherless_llm()
    sys_prompt = """You are Agent 2, an elite Technical Recruiter at a Fortune 500 company. Your job is to generate EXACTLY 3 deep-dive, scenario-based technical screening questions.

STRICT RULES:
1. Each question MUST be a detailed, multi-paragraph scenario (at least 4-5 sentences each).
2. Each question MUST start with a bold title using **Title Here** format.
3. Each question MUST reference a SPECIFIC project or technology from the candidate's resume.
4. Each question MUST present a realistic, complex problem scenario that forces the candidate to explain their architecture, trade-offs, and debugging approach.
5. Do NOT write short one-liner questions. Each question should read like a mini case study.
6. Format: Number each question (1. 2. 3.) with the bold title on the first line, then the detailed scenario below it.

Example format:
1. **Designing Real-Time Seat Booking with Firestore**: Imagine your CineVerse booking system is experiencing race conditions where two users simultaneously try to book the same seat. The Firestore transaction occasionally fails under high load, and users are seeing inconsistent seat availability. Walk me through exactly how you would diagnose this issue, what changes you would make to your transaction logic, and how you would stress-test the fix to ensure atomicity at scale.

Generate questions with this level of depth and specificity."""
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=f"Discovery Analysis:\n{resume_analysis}\n\nCandidate Resume:\n{resume_text}\n\nGenerate the 3 detailed scenario questions.")
    ])
    
    questions = [q.strip() for q in response.content.split('\n') if q.strip() and q.strip()[0].isdigit()]
    if not questions:
        questions = [response.content.strip()]
    return questions

async def evaluate_recruiter_test(questions: list[str], answers: list[str]):
    # Use a reasoning model for complex evaluation and AI-detection
    llm = get_featherless_llm("deepseek-ai/DeepSeek-R1") 
    
    sys_prompt = """You are Agent 2 (The Technical Recruiter Evaluator). Your job is to deeply analyze the candidate's answers to the technical screening questions.
Criteria:
1. Detect AI-generated answers: If the tone is overly generic, lacks personal reflection, or uses classic ChatGPT tropes (e.g. 'In conclusion,' 'It is important to note'), severely penalize the score.
2. Evaluate more than correctness: Focus heavily on their thinking process, approach, and problem-solving consistency.
3. Output a structured evaluation report.

Respond strictly in this format:
Score: [0-100]
AI_Detection: [High/Medium/Low likelihood of being AI generated]
Report: [Your detailed reasoning]
"""
    
    payload = ""
    for q, a in zip(questions, answers):
        payload += f"Q: {q}\nA: {a}\n\n"
        
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=payload)
    ])
    
    return response.content


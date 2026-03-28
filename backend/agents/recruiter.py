import os
import re
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

def get_featherless_llm(model="meta-llama/Meta-Llama-3.1-70B-Instruct"):
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
        model_kwargs={"extra_body": {"max_tokens": 4096}}
    )

async def generate_recruiter_test(resume_analysis: str, resume_text: str = "", github_analysis: str = ""):
    llm = get_featherless_llm()
    sys_prompt = """You are Agent 2, an elite Technical Recruiter at a Fortune 500 company. Your job is to generate EXACTLY 3 deep-dive, scenario-based technical screening questions.

STRICT RULES:
1. Each question MUST be a detailed, multi-paragraph scenario (at least 4-5 sentences each).
2. Each question MUST start with a bold title using **Title Here** format.
3. Each question MUST reference a SPECIFIC project, repository, or technology from the candidate's resume or GitHub profile.
4. If GitHub data is provided, at least ONE question MUST directly reference one of their actual GitHub repositories by name and ask about the real code/architecture decisions in that project.
5. Each question MUST present a realistic, complex problem scenario that forces the candidate to explain their architecture, trade-offs, and debugging approach.
6. Do NOT write short one-liner questions. Each question should be 4-6 sentences minimum, like a mini case study.
7. Format: Number each question (1. 2. 3.) with the bold title on the first line, then the detailed scenario below it.

Example format:
1. **Designing Real-Time Seat Booking with Firestore**: Imagine your CineVerse booking system is experiencing race conditions where two users simultaneously try to book the same seat. The Firestore transaction occasionally fails under high load during Friday evening showtimes, and users are seeing inconsistent seat availability — sometimes two users successfully book the same seat. Walk me through exactly how you would diagnose this issue, what changes you would make to your Firestore transaction logic to guarantee atomicity, and how you would design a stress test to validate that your fix handles 500 concurrent booking attempts without a single double-booking.

Generate questions with this level of depth and specificity. EVERY question must be long and detailed."""
    
    user_content = f"Discovery Analysis:\n{resume_analysis}\n\nCandidate Resume:\n{resume_text[:3000]}"
    if github_analysis:
        user_content += f"\n\nCandidate GitHub Profile Data:\n{github_analysis}"
    user_content += "\n\nGenerate the 3 detailed scenario questions. Each question MUST be at least 4-5 sentences long."
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_content)
    ])
    
    # Split on numbered patterns (1. 2. 3.) to preserve multi-paragraph questions
    raw = response.content.strip()
    parts = re.split(r'(?=\n\d+\.\s)', '\n' + raw)
    questions = [p.strip() for p in parts if p.strip() and re.match(r'\d+\.', p.strip())]
    
    if not questions:
        questions = [raw]
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


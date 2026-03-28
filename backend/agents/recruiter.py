import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

def get_featherless_llm(model="meta-llama/Meta-Llama-3.1-70B-Instruct"):
    return ChatOpenAI(
        api_key=os.getenv("FEATHERLESS_API_KEY", "mock_key"),
        base_url="https://api.featherless.ai/v1",
        model=model,
        max_tokens=4096
    )

async def generate_recruiter_test(resume_analysis: str):
    llm = get_featherless_llm()
    sys_prompt = "You are Agent 2 (The Technical Recruiter). Based on the candidate's discovery analysis, generate EXACTLY 3 highly targeted thinking/problem-solving questions. These should NOT be easily solvable by basic AI. Force them to explain their unique approach."
    
    response = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=f"Discovery Analysis:\n{resume_analysis}\n\nGenerate the 3 questions as a numbered list.")
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


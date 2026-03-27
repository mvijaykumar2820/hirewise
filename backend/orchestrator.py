from typing import TypedDict, Annotated, List, Dict
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage

# Import Agent Functions
from agents.discovery import run_discovery_agent
from agents.recruiter import generate_recruiter_test
from agents.interviewer import conduct_interview_turn
from agents.decision_room import run_decision_room

class CandidateState(TypedDict):
    resume_text: str
    github_url: str
    linkedin_url: str
    leetcode_url: str
    
    # Phase 1 Data
    digital_footprint_data: Dict
    resume_analysis: str
    
    # Phase 2 Data
    recruiter_test_questions: List[str]
    recruiter_test_answers: List[str]
    recruiter_test_score: int
    
    # Phase 3 Data
    interview_transcript: List[BaseMessage]
    
    # Phase 4 Data
    decision_debate_log: str
    final_decision: str

async def discovery_node(state: CandidateState):
    result = await run_discovery_agent(
        state.get("resume_text", ""),
        state.get("linkedin_url", ""),
        state.get("github_url", "")
    )
    state["digital_footprint_data"] = result["digital_footprint_data"]
    state["resume_analysis"] = result["resume_analysis"]
    return state

async def test_generation_node(state: CandidateState):
    questions = await generate_recruiter_test(state.get("resume_analysis", ""))
    state["recruiter_test_questions"] = questions
    return state

async def interview_node(state: CandidateState):
    # Only executing one turn for the graph, but frontend will handle the back-and-forth loop.
    return state

async def decision_room_node(state: CandidateState):
    # Prepare data for debate
    candidate_data = {
        "footprint": state.get("digital_footprint_data"),
        "resume_analysis": state.get("resume_analysis"),
        "test_score": state.get("recruiter_test_score", 0)
    }
    
    # Format transcript
    transcript_text = "\n".join([f"{m.type}: {m.content}" for m in state.get("interview_transcript", [])])
    
    result = await run_decision_room(candidate_data, transcript_text)
    state["decision_debate_log"] = result["agents_debate_log"]
    state["final_decision"] = result["final_decision_xai"]
    return state

workflow = StateGraph(CandidateState)

workflow.add_node("discovery", discovery_node)
workflow.add_node("test_generation", test_generation_node)
workflow.add_node("interview", interview_node)
workflow.add_node("decision_room", decision_room_node)

workflow.set_entry_point("discovery")
workflow.add_edge("discovery", "test_generation")
workflow.add_edge("test_generation", "interview")
workflow.add_edge("interview", "decision_room")
workflow.add_edge("decision_room", END)

orchestrator = workflow.compile()

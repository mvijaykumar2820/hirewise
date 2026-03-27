from typing import TypedDict, Annotated, List, Dict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage

# Import Agent Functions
from agents.discovery import run_discovery_agent
from agents.recruiter import generate_recruiter_test
from agents.interviewer import conduct_interview_turn
from agents.decision_room import run_decision_room

class CandidateState(TypedDict):
    candidate_id: str
    hr_preferences: str
    resume_text: str
    github_url: str
    linkedin_url: str
    leetcode_url: str
    
    # Phase 1 Data
    signals_gathered: Dict[str, Any]
    ranking_analysis: Dict[str, Any]
    
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
    # Prepare candidate data payload
    candidate_data = {
        "resume_text": state.get("resume_text", ""),
        "github_url": state.get("github_url", ""),
        "linkedin_url": state.get("linkedin_url", ""),
        "leetcode_url": state.get("leetcode_url", "")
    }
    
    result = await run_discovery_agent(
        candidate_id=state.get("candidate_id", "unknown"),
        candidate_data=candidate_data,
        hr_preferences=state.get("hr_preferences", "Find the best technical talent.")
    )
    
    state["signals_gathered"] = result["signals_gathered"]
    state["ranking_analysis"] = result["ranking_analysis"]
    return state

async def test_generation_node(state: CandidateState):
    reasoning = state.get("ranking_analysis", {}).get("reasoning", "")
    questions = await generate_recruiter_test(reasoning)
    state["recruiter_test_questions"] = questions
    return state

async def interview_node(state: CandidateState):
    # Only executing one turn for the graph, but frontend will handle the back-and-forth loop.
    return state

async def decision_room_node(state: CandidateState):
    # Prepare data for debate
    candidate_data = {
        "signals": state.get("signals_gathered"),
        "ranking_analysis": state.get("ranking_analysis"),
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

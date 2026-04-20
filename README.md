# HireWise: AI-Driven Recruitment Orchestrator

HireWise is an agentic recruitment platform designed to automate the end-to-end hiring process—from initial resume screening to a final multi-agent "Decision Room" debate. Built with **FastAPI** on the backend and **Next.js** on the frontend, it leverages **LangGraph** to coordinate specialized AI agents.

## The Multi-Phase Agentic Workflow

The project follows a structured 4-phase interview pipeline managed by an Orchestrator:

1.  **Phase 1: Discovery (The Screener)**
      * Analyzes resumes (PDF/Text) and scrapes GitHub profiles using BrightData.
      * Generates a potential score and reasoning based on HR preferences.
2.  **Phase 2: Recruiter Test (The Skill Validator)**
      * Generates dynamic, highly personalized technical questions based on the candidate's specific background.
      * Evaluates answers to generate a competency report.
3.  **Phase 3: AI Interviewer (The Conversationalist)**
      * Conducts a real-time, probing interview using specialized chat history management.
      * Detects "tab switching" during the interview to ensure integrity.
4.  **Phase 4: Decision Room (The Final Verdict)**
      * A multi-agent debate where signals from all previous phases are analyzed.
      * Produces a "Decision Debate Log" and a final hire/no-hire recommendation.

## 🛠️ Tech Stack

### Backend

  * **Framework**: FastAPI
  * **Orchestration**: LangGraph (StateGraph)
  * **Database**: Firebase Firestore
  * **Tools**: PyPDF2 (Resume parsing), LangChain (Agent logic), Dotenv

### Frontend

  * **Framework**: Next.js (App Router)
  * **Styling**: Tailwind CSS
  * **Authentication**: Firebase Auth

## 📋 Prerequisites

  * Python 3.10+
  * Node.js 18+
  * Firebase Project Credentials

## ⚙️ Installation

### Backend Setup

1.  Navigate to the `backend` directory.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Create a `.env` file and add your API keys (OpenAI, Firebase, BrightData).
4.  Run the server:
    ```bash
    uvicorn main:app --reload
    ```

### Frontend Setup

1.  Navigate to the `frontend` directory.
2.  Install packages:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```

## 🎥 Project Demo
https://drive.google.com/file/d/1Y0kp6-Lg4ainUQ53fChl367v8LRgVQCL/view?usp=drive_link

-----

### Note on "Breaking Changes"

This project uses a specific version of Next.js with significant architectural differences from standard training data. Consult the internal guides in `frontend/AGENTS.md` before making structural changes.

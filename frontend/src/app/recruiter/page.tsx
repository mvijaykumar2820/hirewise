"use client";
import { useState } from "react";
import Link from "next/link";

export default function RecruiterDashboard() {
  const [activeTab, setActiveTab] = useState("submit");
  const [logs, setLogs] = useState<string[]>([]);
  
  const handleSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    setLogs((prev) => [...prev, "[Agent: Artifact Miner] Scraping Deep Footprints..."]);
    setTimeout(() => {
      setLogs((prev) => [...prev, "[Agent: Artifact Miner] GitHub and LinkedIn metrics pulled successfully."]);
      setActiveTab("decision");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-gray-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Recruiter Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage pipeline & decisions</p>
          </div>
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-800">Logout</Link>
        </header>

        <nav className="flex space-x-4 border-b border-gray-200">
          <button onClick={() => setActiveTab("submit")} className={`pb-4 px-2 font-medium ${activeTab === 'submit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            1. Discovery (Input)
          </button>
          <button onClick={() => setActiveTab("decision")} className={`pb-4 px-2 font-medium ${activeTab === 'decision' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            2. Decision Room
          </button>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <main className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6 min-h-[500px]">
            {activeTab === "submit" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">New Candidate Discovery</h2>
                <form onSubmit={handleSubmission} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resume Text Context</label>
                    <textarea className="w-full h-32 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Paste candidate resume here..."></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
                      <input type="url" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://github.com/..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                      <input type="url" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://linkedin.com/in/..." />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded transition-colors shadow-sm">
                    Run Deep Discovery Analysis
                  </button>
                </form>
              </div>
            )}

            {activeTab === "decision" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Final Decision Simulator</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 border-l-4 border-gray-800 rounded">
                    <h3 className="font-bold text-gray-800">Recruiter Agent:</h3>
                    <p className="text-gray-700 text-sm mt-1">Their Time-to-Productivity is strong. GitHub PRs show they mentor well, indicating excellent culture fit and low onboarding overhead.</p>
                  </div>
                  <div className="p-4 bg-gray-50 border-l-4 border-blue-600 rounded">
                    <h3 className="font-bold text-blue-800">Hiring Manager Agent:</h3>
                    <p className="text-gray-700 text-sm mt-1">Quality of Hire is solid. The interview showed high technical ceiling, but they over-indexed on speed vs security in the system design probe.</p>
                  </div>
                  <div className="p-4 bg-gray-50 border-l-4 border-green-600 rounded">
                    <h3 className="font-bold text-green-800">Compliance Agent:</h3>
                    <p className="text-gray-700 text-sm mt-1">No biased signaling detected in transcript. Safe to proceed without compliance risk.</p>
                  </div>
                  <div className="mt-8 p-6 bg-gray-900 border border-black rounded-lg text-white">
                    <h3 className="font-bold text-lg mb-2">Final Consensus (XAI Report):</h3>
                    <p className="text-gray-300 text-sm">HIRE. The minor technical gap in security is offset by high mentorship capabilities.</p>
                  </div>
                </div>
              </div>
            )}
          </main>

          <aside className="bg-slate-900 rounded-lg p-6 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <h3 className="text-white font-semibold mb-4 uppercase text-xs tracking-wider">Agent Activity Logs</h3>
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm">
              <div className="text-green-400">&gt; System initialized...</div>
              {logs.map((log, i) => (
                <div key={i} className="text-blue-300 animate-pulse">{log}</div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

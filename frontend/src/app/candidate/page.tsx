"use client";
import Link from "next/link";
import { useState } from "react";

export default function CandidateDashboard() {
  const [messages, setMessages] = useState<{role: string, text: string}[]>([
    { role: "agent", text: "Hello. Based on your GitHub, I see you prioritize modularity. Tell me about a time you had to refactor a poorly written legacy service under a tight deadline." }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input) return;
    setMessages(prev => [...prev, { role: "user", text: input }]);
    setInput("");
    
    // Simulate AI thinking and DDA pivot
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "agent", text: "That's a solid approach. However, if that legacy service was handling 10,000 requests per second and downtime was unacceptable, how would your strategy change? (Testing ceiling)" }]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-gray-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Candidate Interview Panel</h1>
            <p className="text-gray-500 mt-1">Live Adaptive Interview with Hiring Manager Agent</p>
          </div>
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-800">Logout</Link>
        </header>

        <main className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col h-[600px]">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded p-4 mb-4 overflow-y-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                <div className={`${msg.role === 'agent' ? 'bg-white border-gray-200 text-gray-800' : 'bg-blue-600 text-white'} border p-3 rounded-lg max-w-[80%] shadow-sm`}>
                  {msg.role === 'agent' && <p className="font-semibold text-xs text-gray-500 mb-1">Hiring Manager Agent</p>}
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-1 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="Type your response..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700 text-white px-6 font-medium rounded transition-colors">Send</button>
          </div>
        </main>
      </div>
    </div>
  );
}

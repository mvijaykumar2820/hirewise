"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, setDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";

export default function CandidateDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Application State
  const [phase, setPhase] = useState<"IDLE" | "SUBMIT" | "INTERVIEW">("IDLE");
  
  // Submit Form State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Interview State
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const q = query(collection(db, "jobs"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveJobs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      liveJobs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(liveJobs);
    });
    return () => unsubscribe();
  }, []);

  const handleApplyClick = (job: any) => {
    setSelectedJob(job);
    setPhase("SUBMIT");
  };

  const handleStartSimulatedInterview = async () => {
    if (!resumeFile) {
        alert("Please upload a resume first!");
        return;
    }
    
    // 1. Upload Resume to Firebase Storage
    let resume_url = "";
    try {
        const fileRef = ref(storage, `resumes/${selectedJob.id}/demo-cand-123.pdf`);
        await uploadBytes(fileRef, resumeFile);
        resume_url = await getDownloadURL(fileRef);
        console.log("Resume securely uploaded to Firebase!");
    } catch (err) {
        console.warn("Storage upload skipped or failed:", err);
    }
  
    // 2. Send to Backend AI
    const formData = new FormData();
    formData.append("hr_preferences", selectedJob.aiPreferences || "Find top tech talent.");
    formData.append("resume", resumeFile);
    
    try {
        const res = await fetch("http://localhost:8000/api/phase1_discovery", {
            method: "POST",
            body: formData,
        });
        const data = await res.json();
        console.log("Phase 1 AI Analysis Complete:", data);
        
        // 3. Front-end handles database update directly with Resume Link
        await setDoc(doc(db, "jobs", selectedJob.id, "candidates", "demo-cand-123"), {
            status: "Screening",
            discovery_analysis: data.analysis_preview,
            pending_test_questions: data.questions,
            resume_url: resume_url,
            name: "Candidate"
        });
        
        setPhase("INTERVIEW");
        setMessages([
          { role: "agent", text: `Hello! Thanks for applying. I've analyzed your resume using our Deep Discovery protocol. Let's start the live interview. Based on your profile, what's a project you're most proud of and why?` }
        ]);
    } catch (e) {
        console.error("Failed to upload", e);
        alert("Error uploading to backend. Check console.");
    }
  };

  const handleSend = () => {
    if (!input) return;
    setMessages(prev => [...prev, { role: "user", text: input }]);
    setInput("");
    
    // Simulate AI thinking and DDA pivot
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "agent", text: "That's a solid approach. However, if that service was handling 10,000 requests per second and downtime was unacceptable, how would your strategy change? (Testing ceiling)" }]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Left Pane: Interaction Area */}
        <div className="flex-[2] space-y-6">
          <header className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Candidate Portal</h1>
              <p className="text-gray-500 mt-1">Apply and Interview via AI</p>
            </div>
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-800">Logout</Link>
          </header>

          <main className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 min-h-[600px] flex flex-col">
            {phase === "IDLE" && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <p className="text-lg font-medium">Select a job from the board to apply</p>
              </div>
            )}

            {phase === "SUBMIT" && selectedJob && (
              <div className="flex-1 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <h2 className="text-xl font-bold">Applying for: {selectedJob.title}</h2>
                  <p className="text-sm text-blue-600 mt-1">{selectedJob.salary}</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Resume (PDF/TXT)</label>
                    <input type="file" onChange={e=>setResumeFile(e.target.files?.[0] || null)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 bg-white" accept=".pdf,.txt" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
                    <input type="text" value={githubUrl} onChange={e=>setGithubUrl(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://github.com/..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                    <input type="text" value={linkedinUrl} onChange={e=>setLinkedinUrl(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://linkedin.com/in/..." />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button onClick={() => setPhase("IDLE")} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900 transition">Cancel</button>
                  <button onClick={handleStartSimulatedInterview} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition">Submit & Start Evaluation</button>
                </div>
              </div>
            )}

            {phase === "INTERVIEW" && (
              <>
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
              </>
            )}
          </main>
        </div>

        {/* Right Pane: Open Jobs */}
        <div className="flex-1 space-y-6">
          <div className="bg-gray-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden h-full min-h-[600px]">
            {/* Background Accent */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
            
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Live Job Board
            </h2>
            
            <div className="space-y-4 overflow-y-auto pr-2 max-h-[700px]">
              {jobs.length === 0 ? (
                <p className="text-gray-400 text-sm italic">Waiting for recruiters to post jobs...</p>
              ) : (
                jobs.map(job => (
                  <div key={job.id} onClick={() => handleApplyClick(job)} className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${selectedJob?.id === job.id ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-100">{job.title}</h3>
                      <span className="text-xs font-medium bg-gray-700/50 text-gray-300 px-2 py-1 rounded">{job.salary}</span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2">{job.description}</p>
                    <div className="mt-3 text-xs font-medium text-blue-400">
                      Apply Now →
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

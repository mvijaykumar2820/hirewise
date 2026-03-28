"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { collection, onSnapshot, query, setDoc, doc, updateDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

export default function CandidateDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Application State
  const [phase, setPhase] = useState<"IDLE" | "SUBMIT" | "EVALUATING" | "REJECTED" | "RECRUITER_TEST" | "INTERVIEW_SETUP" | "INTERVIEW" | "COMPLETED">("IDLE");
  const [isUploading, setIsUploading] = useState(false);
  
  // Submit Form State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Interview State
  const [recruiterQuestions, setRecruiterQuestions] = useState<string>("");
  const [testAnswers, setTestAnswers] = useState<string>("");
  const [rejectionMessage, setRejectionMessage] = useState<string>("");
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [input, setInput] = useState("");

  // Video Interview State
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [tabSwitches, setTabSwitches] = useState(0);
  const [interviewStartedAt, setInterviewStartedAt] = useState<string>("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [decisionReport, setDecisionReport] = useState<string>("");

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
    if (!selectedJob) return;
    if (!resumeFile) {
        alert("Please upload a resume first!");
        return;
    }
    
    console.log("Triggered Evaluation Flow. Locking UI...");
    setIsUploading(true);
    setPhase("EVALUATING");

    // 1. Upload Resume to Firebase Storage (with a 10s Timeout limit)
    const fileRef = ref(storage, `resumes/${selectedJob.id}/demo-cand-123.pdf`);
    
    const uploadPromise = uploadBytes(fileRef, resumeFile)
        .then(() => getDownloadURL(fileRef))
        .catch(err => {
            console.warn("Storage upload explicitly failed:", err);
            return "";
        });
    
    const timeoutPromise = new Promise(resolve => setTimeout(() => {
        console.warn("Firebase Storage timeout (ignored). Proceeding anyway...");
        resolve("");
    }, 10000));
    
    // We launch the upload, but limit its holding time to 10 seconds!
    const storageLinkPromise = Promise.race([uploadPromise, timeoutPromise]);

    // 2. Automatically trigger AI processing in parallel!
    console.log("Sending PDF to stateless AI Backend (FastAPI)...");
    const formData = new FormData();
    const combinedPreferences = `Job Description: ${selectedJob.description}\n\nAdditional Requirements: ${selectedJob.aiPreferences || ""}`;
    formData.append("hr_preferences", combinedPreferences);
    formData.append("resume", resumeFile);
    
    try {
        const res = await fetch("http://127.0.0.1:8000/api/phase1_discovery", {
            method: "POST",
            body: formData,
        });
        
        console.log("AI API Responded with status:", res.status);
        if (!res.ok) {
            const errText = await res.text();
            console.error("AI API Raw Error:", errText);
            throw new Error(`API HTTP ${res.status}: ${errText}`);
        }
        
        const data = await res.json();
        console.log("Phase 1 AI Analysis Complete:", data);
        
        if (data.status === "rejected") {
            setIsUploading(false);
            setRejectionMessage(data.first_message);
            setPhase("REJECTED");
            return;
        }
        
        // Ensure storage either resolved or timed out by now
        const resume_url = await storageLinkPromise;
        console.log("Resolved Storage URL for DB:", resume_url);
        
        await setDoc(doc(db, "jobs", selectedJob.id, "candidates", user!.uid), {
            status: "Round 1 Passed",
            round1_score: data.analysis_preview?.ranking_analysis?.potential_score || 0,
            round1_reasoning: data.analysis_preview?.ranking_analysis?.reasoning || "",
            discovery_analysis: data.analysis_preview,
            recruiter_questions: data.recruiter_questions || "",
            resume_url: resume_url,
            name: user!.displayName || "Anonymous",
            email: user!.email || "",
            photoURL: user!.photoURL || "",
            appliedAt: new Date().toISOString(),
            round2_status: "pending",
        });
        
        // Increment counters on parent job doc
        await updateDoc(doc(db, "jobs", selectedJob.id), {
            applicants: increment(1),
            passed: increment(1),
        });
        
        setIsUploading(false);
        setRecruiterQuestions(data.recruiter_questions || "");
        setPhase("RECRUITER_TEST");
        setMessages([
          { role: "agent", text: data.first_message }
        ]);
    } catch (e) {
        console.error("Critical failure during analysis", e);
        alert("Failed to analyze resume. Ensure your APIs and Backend are running cleanly.");
        setIsUploading(false);
        setPhase("SUBMIT");
    }
  };

  const handleSubmitTest = async () => {
    if (!testAnswers.trim()) { alert("Please write your answers first!"); return; }
    
    const questionsArr = recruiterQuestions.split("\n\n").filter(Boolean);
    const answersArr = [testAnswers];
    
    try {
      // Call backend to evaluate
      const res = await fetch("http://127.0.0.1:8000/api/phase2_evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsArr, answers: answersArr })
      });
      const data = await res.json();
      const report = data.report || "";
      
      // Parse score from report
      const scoreMatch = report.match(/Score:\s*(\d+)/i);
      const aiDetectionMatch = report.match(/AI_Detection:\s*(\w+)/i);
      const round2Score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      const aiDetection = aiDetectionMatch ? aiDetectionMatch[1] : "Unknown";
      
      // Save to Firestore
      await setDoc(doc(db, "jobs", selectedJob.id, "candidates", user!.uid), {
        round2_status: "completed",
        round2_questions: recruiterQuestions,
        round2_answers: testAnswers,
        round2_score: round2Score,
        round2_ai_detection: aiDetection,
        round2_report: report,
        status: "Round 2 Completed",
      }, { merge: true });
      
      setPhase("INTERVIEW_SETUP");
    } catch (e: any) {
      console.error("Round 2 evaluation failed:", e);
      setPhase("INTERVIEW_SETUP");
    }
  };

  // --- VIDEO INTERVIEW LOGIC ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (err) {
      alert("Camera/Mic permission is required for the interview. Please allow access and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraReady(false);
  };

  const startInterview = () => {
    setPhase("INTERVIEW");
    setInterviewStartedAt(new Date().toISOString());
    setMessages([{ role: "agent", text: "Hello! I'm your AI Hiring Manager. Welcome to the live interview. Let's start — can you briefly introduce yourself and tell me about the most challenging project you've worked on?" }]);
  };

  // Tab-switch cheating detection
  useEffect(() => {
    if (phase !== "INTERVIEW") return;
    const handler = () => {
      if (document.hidden) setTabSwitches(prev => prev + 1);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [phase]);

  // Speech Recognition
  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech Recognition not supported. Please use Chrome."); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setLiveTranscript(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const sendVoiceMessage = async () => {
    const text = liveTranscript.trim() || input.trim();
    if (!text) return;
    recognitionRef.current?.stop();
    setIsListening(false);
    setLiveTranscript("");
    setInput("");

    const userMsg = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setIsAiThinking(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/phase3_interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_history: messages.map(m => ({ type: m.role === "user" ? "human" : "ai", content: m.text })),
          latest_message: text
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "agent", text: data.response }]);

      // Check if interview naturally ended
      if (data.response?.toLowerCase().includes("interview is now complete")) {
        setInterviewEnded(true);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "agent", text: `Error: ${e.message}` }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleEndInterview = async () => {
    stopCamera();
    const transcript = messages.map(m => ({ role: m.role === "agent" ? "ai" : "candidate", text: m.text }));
    
    // Save transcript to Firestore immediately
    await setDoc(doc(db, "jobs", selectedJob.id, "candidates", user!.uid), {
      round3_status: "completed",
      round3_transcript: transcript,
      round3_tab_switches: tabSwitches,
      round3_started_at: interviewStartedAt,
      round3_ended_at: new Date().toISOString(),
      status: "All Rounds Completed",
    }, { merge: true });

    // Call backend to evaluate the interview
    try {
      const res = await fetch("http://127.0.0.1:8000/api/phase3_evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, tab_switches: tabSwitches })
      });
      const data = await res.json();
      const report = data.report || "";

      const scoreMatch = report.match(/Score:\s*(\d+)/i);
      const aiDetMatch = report.match(/AI_Detection:\s*(\w+)/i);
      const cheatingMatch = report.match(/Cheating_Risk:\s*(\w+)/i);

      await setDoc(doc(db, "jobs", selectedJob.id, "candidates", user!.uid), {
        round3_score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
        round3_ai_detection: aiDetMatch ? aiDetMatch[1] : "Unknown",
        round3_cheating_risk: cheatingMatch ? cheatingMatch[1] : "Unknown",
        round3_report: report,
      }, { merge: true });

      setDecisionReport(report);
    } catch (e) {
      console.error("Interview evaluation failed:", e);
    }

    setPhase("COMPLETED");
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) { router.push("/"); return null; }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Left Pane: Interaction Area */}
        <div className="flex-[2] space-y-6">
          <header className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              {user.photoURL && <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-gray-200" />}
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Candidate Portal</h1>
                <p className="text-gray-500 mt-0.5 text-sm">{user.displayName || user.email}</p>
              </div>
            </div>
            <button onClick={async () => { await logout(); router.push("/"); }} className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors">Logout</button>
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
                  <button 
                    onClick={handleStartSimulatedInterview} 
                    disabled={isUploading}
                    className={`px-6 py-2 ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium rounded-lg shadow-sm transition`}
                  >
                    {isUploading ? "Processing AI Analysis..." : "Submit & Start Evaluation"}
                  </button>
                </div>
              </div>
            )}

            {phase === "EVALUATING" && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-800 space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="relative w-24 h-24 mb-4">
                  <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-3 text-gray-900">Round 1: AI Evaluation</h2>
                  <p className="text-gray-500 max-w-md mx-auto leading-relaxed">Please wait while our Deep Discovery Agent analyzes your non-traditional signals, project history, and experience...</p>
                </div>
              </div>
            )}

            {phase === "REJECTED" && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-800 space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="relative w-24 h-24 mb-4">
                  <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </div>
                </div>
                <div className="text-center max-w-lg">
                  <h2 className="text-2xl font-bold mb-3 text-red-600">Application Not Accepted</h2>
                  <p className="text-gray-600 leading-relaxed text-sm">{rejectionMessage}</p>
                </div>
                <button 
                  onClick={() => setPhase("IDLE")}
                  className="mt-4 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-all"
                >
                  ← Try Another Job
                </button>
              </div>
            )}

            {phase === "RECRUITER_TEST" && (
              <div className="flex-1 space-y-6 animate-in fade-in zoom-in duration-500 bg-white p-6 rounded-lg border shadow-sm">
                 <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Round 2: Written Test (Recruiter Agent)</h2>
                 <p className="text-gray-600">Based on your background, our AI Recruiter has generated highly targeted screening questions. We need to verify your problem-solving approach.</p>
                 <div className="bg-gray-50 border p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap font-medium">
                      {recruiterQuestions}
                 </div>
                 <textarea
                   className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                   placeholder="Type your answers here..."
                   value={testAnswers}
                   onChange={e => setTestAnswers(e.target.value)}
                 />
                 <button 
                   onClick={handleSubmitTest}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-all w-full"
                 >
                   Submit Answers & Proceed to Live Interview
                 </button>
              </div>
            )}

            {phase === "INTERVIEW_SETUP" && (
              <div className="flex-1 space-y-6 animate-in fade-in zoom-in duration-500 bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Round 3: Live AI Interview</h2>
                <p className="text-gray-600">You'll be interviewed by our AI Hiring Manager via your webcam and microphone. Please enable both to begin.</p>
                
                <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video relative">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      <p className="text-gray-400">Camera preview will appear here</p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  {!cameraReady ? (
                    <button onClick={startCamera} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                      🎥 Enable Camera & Microphone
                    </button>
                  ) : (
                    <button onClick={startInterview} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 animate-pulse">
                      🚀 Start Interview
                    </button>
                  )}
                </div>
                {cameraReady && <p className="text-green-600 text-sm font-medium text-center">✅ Camera and microphone are ready!</p>}
              </div>
            )}

            {phase === "INTERVIEW" && (
              <div className="flex-1 flex flex-col space-y-4">
                {/* Video + Chat Split */}
                <div className="flex gap-4">
                  {/* Webcam Feed */}
                  <div className="w-48 flex-shrink-0">
                    <div className="bg-gray-900 rounded-xl overflow-hidden aspect-[3/4] relative">
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                        <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">● LIVE</span>
                        {tabSwitches > 0 && <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">⚠ {tabSwitches} tab switches</span>}
                      </div>
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-y-auto space-y-3 max-h-[400px]">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`${msg.role === 'agent' ? 'bg-white border-gray-200 text-gray-800' : 'bg-blue-600 text-white'} border p-3 rounded-lg max-w-[85%] shadow-sm text-sm`}>
                          {msg.role === 'agent' && <p className="font-semibold text-xs text-gray-500 mb-1">🤖 AI Hiring Manager</p>}
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isAiThinking && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Transcript Preview */}
                {liveTranscript && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700 italic">
                    🎤 <span className="font-medium">Hearing:</span> "{liveTranscript}"
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-2">
                  <button 
                    onClick={toggleListening}
                    className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isListening ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'bg-gray-800 hover:bg-gray-900 text-white'}`}
                  >
                    {isListening ? '⏹ Stop' : '🎤 Speak'}
                  </button>
                  <input 
                    type="text" 
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                    placeholder="Or type your answer..." 
                    value={liveTranscript || input}
                    onChange={(e) => { setInput(e.target.value); setLiveTranscript(""); }}
                    onKeyDown={(e) => e.key === 'Enter' && sendVoiceMessage()}
                  />
                  <button onClick={sendVoiceMessage} disabled={isAiThinking} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 font-medium rounded-lg transition-colors text-sm">Send</button>
                </div>

                {/* End Interview */}
                {(messages.length >= 6 || interviewEnded) && (
                  <button onClick={handleEndInterview} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-all">
                    🏁 End Interview & Get AI Verdict
                  </button>
                )}
              </div>
            )}

            {phase === "COMPLETED" && (
              <div className="flex-1 space-y-6 animate-in fade-in zoom-in duration-500 bg-white p-6 rounded-lg border shadow-sm text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900">All Rounds Completed!</h2>
                <p className="text-gray-600">Your interview data has been submitted to the AI Decision Room. The hiring team will review your performance across all 3 rounds.</p>
                {decisionReport && (
                  <div className="bg-gray-50 border rounded-lg p-4 text-left text-sm text-gray-700 whitespace-pre-wrap mt-4">
                    <p className="font-bold text-gray-900 mb-2">📋 AI Interview Evaluation:</p>
                    {decisionReport}
                  </div>
                )}
                <button onClick={() => { setPhase("IDLE"); setSelectedJob(null); setMessages([]); }} className="mt-4 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-all">
                  ← Back to Job Board
                </button>
              </div>
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

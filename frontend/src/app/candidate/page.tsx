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

  // Video Interview State
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [tabSwitches, setTabSwitches] = useState(0);
  const [interviewStartedAt, setInterviewStartedAt] = useState<string>("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [decisionReport, setDecisionReport] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiThinking]);

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
    
    setIsUploading(true);
    setPhase("EVALUATING");

    const fileRef = ref(storage, `resumes/${selectedJob.id}/demo-cand-123.pdf`);
    
    const uploadPromise = uploadBytes(fileRef, resumeFile)
        .then(() => getDownloadURL(fileRef))
        .catch(() => "");
    
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(""), 10000));
    const storageLinkPromise = Promise.race([uploadPromise, timeoutPromise]);

    const formData = new FormData();
    const combinedPreferences = `Job Description: ${selectedJob.description}\n\nAdditional Requirements: ${selectedJob.aiPreferences || ""}`;
    formData.append("hr_preferences", combinedPreferences);
    formData.append("resume", resumeFile);
    
    try {
        const res = await fetch("http://127.0.0.1:8000/api/phase1_discovery", {
            method: "POST",
            body: formData,
        });
        
        if (!res.ok) throw new Error(`API HTTP ${res.status}`);
        
        const data = await res.json();
        
        if (data.status === "rejected") {
            setIsUploading(false);
            setRejectionMessage(data.first_message);
            setPhase("REJECTED");
            return;
        }
        
        const resume_url = await storageLinkPromise;
        
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
        
        await updateDoc(doc(db, "jobs", selectedJob.id), {
            applicants: increment(1),
            passed: increment(1),
        });
        
        setIsUploading(false);
        setRecruiterQuestions(data.recruiter_questions || "");
        setPhase("RECRUITER_TEST");
        setMessages([{ role: "agent", text: data.first_message }]);
    } catch (e) {
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
      const res = await fetch("http://127.0.0.1:8000/api/phase2_evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsArr, answers: answersArr })
      });
      const data = await res.json();
      const report = data.report || "";
      
      const scoreMatch = report.match(/Score:\s*(\d+)/i);
      const aiDetectionMatch = report.match(/AI_Detection:\s*(\w+)/i);
      const round2Score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      const aiDetection = aiDetectionMatch ? aiDetectionMatch[1] : "Unknown";
      
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

  // Text-to-Speech for AI
  const speakText = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";
      setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); resolve(); };
      speechSynthesis.speak(utterance);
    });
  }, []);

  // Auto-listen after AI finishes speaking
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    let finalTranscript = "";
    let silenceTimer: any = null;
    
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      setLiveTranscript(finalTranscript + interim);
      
      // Reset silence timer on new speech
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        // 2.5 second silence = auto-send
        if (finalTranscript.trim()) {
          recognition.stop();
        }
      }, 2500);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        // Auto-send the captured speech
        handleVoiceSubmit(finalTranscript.trim());
      }
    };
    
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setLiveTranscript("");
  }, []);

  // Handle voice submission
  const handleVoiceSubmit = async (text: string) => {
    if (!text) return;
    setLiveTranscript("");

    const userMsg = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setIsAiThinking(true);

    try {
      const currentMessages = [...messages, userMsg];
      const res = await fetch("http://127.0.0.1:8000/api/phase3_interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_history: currentMessages.map(m => ({ type: m.role === "user" ? "human" : "ai", content: m.text })),
          latest_message: text
        })
      });
      const data = await res.json();
      const aiText = data.response;
      setMessages(prev => [...prev, { role: "agent", text: aiText }]);
      setIsAiThinking(false);

      // Check if interview ended
      if (aiText?.toLowerCase().includes("interview is now complete")) {
        setInterviewEnded(true);
        await speakText(aiText);
        return;
      }

      // AI speaks, then auto-listen
      await speakText(aiText);
      startListening();
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "agent", text: `Connection error. Please try again.` }]);
      setIsAiThinking(false);
    }
  };

  const startInterview = async () => {
    setPhase("INTERVIEW");
    setInterviewStartedAt(new Date().toISOString());
    const greeting = "Let's get started. Tell me about your strongest technical skill and a real project where you used it. Be specific.";
    setMessages([{ role: "agent", text: greeting }]);
    
    // AI speaks the greeting, then auto-listen
    await speakText(greeting);
    startListening();
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

  const handleEndInterview = async () => {
    speechSynthesis.cancel();
    recognitionRef.current?.stop();
    stopCamera();
    const transcript = messages.map(m => ({ role: m.role === "agent" ? "ai" : "candidate", text: m.text }));
    
    await setDoc(doc(db, "jobs", selectedJob.id, "candidates", user!.uid), {
      round3_status: "completed",
      round3_transcript: transcript,
      round3_tab_switches: tabSwitches,
      round3_started_at: interviewStartedAt,
      round3_ended_at: new Date().toISOString(),
      status: "All Rounds Completed",
    }, { merge: true });

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

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) { router.push("/"); return null; }

  // ==================== FULL-SCREEN INTERVIEW ====================
  if (phase === "INTERVIEW_SETUP" || phase === "INTERVIEW") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="bg-green-500 text-black text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">● LIVE</span>
            <span className="text-sm font-medium text-gray-300">Round 3: AI Interview — {selectedJob?.title}</span>
          </div>
          <div className="flex items-center gap-4">
            {tabSwitches > 0 && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-3 py-1 rounded-full font-bold">⚠ {tabSwitches} tab switches detected</span>}
            {phase === "INTERVIEW" && (messages.length >= 4 || interviewEnded) && (
              <button onClick={handleEndInterview} className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-all">
                End Interview
              </button>
            )}
          </div>
        </div>

        {phase === "INTERVIEW_SETUP" ? (
          /* Camera Setup */
          <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="w-full max-w-2xl">
              <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video relative border border-gray-800">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <svg className="w-20 h-20 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <p className="text-gray-500 text-lg">Camera preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">Ready for your Live Interview?</h2>
              <p className="text-gray-400 max-w-md mx-auto">The AI Hiring Manager will ask you questions through voice. Just speak naturally — no typing needed.</p>
              {!cameraReady ? (
                <button onClick={startCamera} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium text-lg transition-all">
                  🎥 Enable Camera & Microphone
                </button>
              ) : (
                <button onClick={startInterview} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-medium text-lg transition-all animate-pulse">
                  🚀 Start Interview
                </button>
              )}
              {cameraReady && <p className="text-green-400 text-sm font-medium">✅ Camera and microphone are ready!</p>}
            </div>
          </div>
        ) : (
          /* Live Interview */
          <div className="flex-1 flex">
            {/* Webcam — Large */}
            <div className="w-1/3 p-4">
              <div className="bg-gray-900 rounded-2xl overflow-hidden h-full relative border border-gray-800">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                  <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full animate-pulse font-bold">● REC</span>
                  {isListening && (
                    <div className="flex items-center gap-1.5 bg-green-500/20 px-3 py-1 rounded-full">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-green-400 text-xs font-medium">Listening...</span>
                    </div>
                  )}
                  {isSpeaking && (
                    <div className="flex items-center gap-1.5 bg-blue-500/20 px-3 py-1 rounded-full">
                      <span className="text-blue-400 text-xs font-medium">🔊 AI Speaking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Conversation Panel */}
            <div className="flex-1 flex flex-col p-4 pl-0">
              <div className="flex-1 bg-gray-900/50 rounded-2xl border border-gray-800 p-6 overflow-y-auto space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`${msg.role === 'agent' ? 'bg-gray-800 text-gray-200' : 'bg-blue-600 text-white'} p-4 rounded-2xl max-w-[80%] shadow-lg`}>
                      {msg.role === 'agent' && <p className="font-semibold text-xs text-blue-400 mb-1">🤖 AI Hiring Manager</p>}
                      {msg.role === 'user' && <p className="font-semibold text-xs text-blue-200 mb-1">🎤 You (Voice)</p>}
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isAiThinking && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 p-4 rounded-2xl shadow-lg">
                      <p className="font-semibold text-xs text-blue-400 mb-2">🤖 AI Hiring Manager</p>
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Voice Status Bar */}
              <div className="mt-4 bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                {liveTranscript ? (
                  <div className="text-sm text-gray-300">
                    <span className="text-green-400 font-medium">🎤 Hearing: </span>
                    <span className="italic">"{liveTranscript}"</span>
                    <span className="text-gray-500 text-xs ml-2">(auto-sends after you pause)</span>
                  </div>
                ) : isListening ? (
                  <div className="flex items-center justify-center gap-3 text-green-400">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-1 bg-green-400 rounded-full animate-pulse" style={{ height: `${12 + Math.random() * 16}px`, animationDelay: `${i * 100}ms` }}></div>
                      ))}
                    </div>
                    <span className="text-sm font-medium">Listening... speak now</span>
                  </div>
                ) : isSpeaking ? (
                  <div className="flex items-center justify-center gap-3 text-blue-400">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-1 bg-blue-400 rounded-full animate-pulse" style={{ height: `${12 + Math.random() * 16}px`, animationDelay: `${i * 100}ms` }}></div>
                      ))}
                    </div>
                    <span className="text-sm font-medium">AI is speaking...</span>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm">Waiting for response...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== COMPLETED SCREEN ====================
  if (phase === "COMPLETED") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center space-y-6">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold">All Rounds Completed!</h2>
          <p className="text-gray-400 text-lg">Your interview data has been submitted to the AI Decision Room. The hiring team will review your performance across all 3 rounds.</p>
          {decisionReport && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-left text-sm text-gray-300 whitespace-pre-wrap mt-6">
              <p className="font-bold text-white text-lg mb-3">📋 AI Interview Evaluation</p>
              {decisionReport}
            </div>
          )}
          <button onClick={() => { setPhase("IDLE"); setSelectedJob(null); setMessages([]); setInterviewEnded(false); setDecisionReport(""); }} className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-lg transition-all">
            ← Back to Job Board
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN PAGE — JOB CARDS + FORMS ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          {user.photoURL && <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-gray-200" />}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">HireWise</h1>
            <p className="text-gray-500 text-xs">{user.displayName || user.email}</p>
          </div>
        </div>
        <button onClick={async () => { await logout(); router.push("/"); }} className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">Logout</button>
      </header>

      <div className="max-w-5xl mx-auto p-8">
        {/* IDLE — Job Cards Grid */}
        {phase === "IDLE" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Open Positions</h2>
              <p className="text-gray-500 mt-1">Select a job to start your multi-round AI evaluation</p>
            </div>
            {jobs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                <p className="text-gray-400 text-lg">Waiting for recruiters to post jobs...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {jobs.map(job => (
                  <div key={job.id} onClick={() => handleApplyClick(job)} className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{job.title}</h3>
                      <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{job.salary}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">{job.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{job.applicants || 0} applicants</span>
                        <span>•</span>
                        <span>{job.location || "Remote"}</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">Apply →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBMIT — Full-Screen Application Form */}
        {phase === "SUBMIT" && selectedJob && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setPhase("IDLE")} className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">← Back to Jobs</button>
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900">Apply for: {selectedJob.title}</h2>
              <p className="text-blue-600 text-sm mt-1 mb-6">{selectedJob.salary} • {selectedJob.location || "Remote"}</p>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Resume (PDF/TXT)</label>
                  <input type="file" onChange={e=>setResumeFile(e.target.files?.[0] || null)} className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" accept=".pdf,.txt" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">GitHub URL</label>
                  <input type="text" value={githubUrl} onChange={e=>setGithubUrl(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://github.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">LinkedIn URL</label>
                  <input type="text" value={linkedinUrl} onChange={e=>setLinkedinUrl(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://linkedin.com/in/..." />
                </div>
              </div>

              <div className="pt-6">
                <button 
                  onClick={handleStartSimulatedInterview} 
                  disabled={isUploading}
                  className={`w-full py-3 ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-semibold rounded-xl shadow-sm transition text-lg`}
                >
                  {isUploading ? "Processing AI Analysis..." : "Submit & Start Evaluation"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EVALUATING */}
        {phase === "EVALUATING" && (
          <div className="flex flex-col items-center justify-center min-h-[500px] text-gray-800 space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-3 text-gray-900">Round 1: AI Evaluation</h2>
              <p className="text-gray-500 max-w-md mx-auto leading-relaxed">Please wait while our Deep Discovery Agent analyzes your resume, project history, and experience...</p>
            </div>
          </div>
        )}

        {/* REJECTED */}
        {phase === "REJECTED" && (
          <div className="flex flex-col items-center justify-center min-h-[500px] text-gray-800 space-y-6 animate-in fade-in zoom-in duration-500">
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
            <button onClick={() => setPhase("IDLE")} className="mt-4 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-medium transition-all">
              ← Try Another Job
            </button>
          </div>
        )}

        {/* RECRUITER TEST — Full Width */}
        {phase === "RECRUITER_TEST" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">Round 2: Written Test (Recruiter Agent)</h2>
              <p className="text-gray-600 mb-6">Based on your background, our AI Recruiter has generated highly targeted screening questions. We need to verify your problem-solving approach.</p>
              <div className="bg-gray-50 border p-5 rounded-xl text-sm text-gray-800 whitespace-pre-wrap font-medium mb-6 leading-relaxed">
                {recruiterQuestions}
              </div>
              <textarea
                className="w-full h-40 p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Type your answers here..."
                value={testAnswers}
                onChange={e => setTestAnswers(e.target.value)}
              />
              <button 
                onClick={handleSubmitTest}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-all w-full mt-4 text-lg"
              >
                Submit Answers & Proceed to Live Interview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

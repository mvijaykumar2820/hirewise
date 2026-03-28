"use client";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<"candidate" | "recruiter" | null>(null);

  useEffect(() => {
    if (!loading && user && role) {
      router.push(`/${role}`);
    }
  }, [user, loading, role, router]);

  const handleGoogleSignIn = async (selectedRole: "candidate" | "recruiter") => {
    setRole(selectedRole);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setRole(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl p-8 text-center">
          <img src={user.photoURL || ""} alt="avatar" className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-blue-500" />
          <h2 className="text-xl font-bold text-white mb-1">Welcome back, {user.displayName}</h2>
          <p className="text-gray-400 text-sm mb-6">{user.email}</p>
          <div className="space-y-3">
            <button onClick={() => router.push("/candidate")} className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20">
              Enter as Candidate
            </button>
            <button onClick={() => router.push("/recruiter")} className="block w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-all border border-gray-700">
              Enter as Recruiter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        {/* Logo / Title */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">HireWise AI</h1>
          <p className="text-gray-400 text-lg">Multi-Agent Autonomous Recruitment</p>
        </div>
        
        {/* Auth Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => handleGoogleSignIn("candidate")}
            className="group relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10"
          >
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">I&apos;m a Candidate</h3>
            <p className="text-gray-500 text-sm">Apply for jobs & interview with AI agents</p>
          </button>
          
          <button 
            onClick={() => handleGoogleSignIn("recruiter")}
            className="group relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10"
          >
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">I&apos;m a Recruiter</h3>
            <p className="text-gray-500 text-sm">Post jobs & manage AI-driven hiring</p>
          </button>
        </div>

        {/* Google branding */}
        <p className="text-gray-600 text-xs">Powered by Google Sign-In • Firebase Authentication</p>
      </div>
    </div>
  );
}

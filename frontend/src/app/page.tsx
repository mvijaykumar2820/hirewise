"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (role: "candidate" | "recruiter") => {
    try {
      setLoading(true);
      setError("");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save user to DB
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        role: role,
        lastLogin: new Date().toISOString()
      }, { merge: true });

      // Redirect based on role
      router.push(`/${role}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">The Orchestrator</h1>
        <p className="text-gray-500 mb-8">Sign in with Google to continue.</p>

        {error && <p className="text-red-500 mb-4 text-sm font-medium">{error}</p>}
        {loading && <p className="text-blue-500 mb-4 text-sm animate-pulse font-medium">Authenticating & Creating Profile...</p>}
        
        <div className="space-y-4">
          <button 
            disabled={loading}
            onClick={() => handleLogin('candidate')} 
            className="block w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold py-4 rounded-lg transition-colors cursor-pointer"
          >
            Sign in as Candidate
          </button>
          <button 
            disabled={loading}
            onClick={() => handleLogin('recruiter')} 
            className="block w-full bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 font-semibold py-4 rounded-lg transition-colors cursor-pointer"
          >
            Sign in as Recruiter
          </button>
        </div>
      </div>
    </div>
  );
}

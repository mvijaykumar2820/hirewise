"use client";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">The Orchestrator</h1>
        <p className="text-gray-500 mb-8">Please select your role to continue.</p>
        
        <div className="space-y-4">
          <Link href="/candidate" className="block w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold py-4 rounded-lg transition-colors">
            I am a Candidate
          </Link>
          <Link href="/recruiter" className="block w-full bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 font-semibold py-4 rounded-lg transition-colors">
            I am a Recruiter
          </Link>
        </div>
      </div>
    </div>
  );
}

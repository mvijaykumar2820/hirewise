"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, Briefcase, Home as HomeIcon, LogOut, Plus, Users, CheckCircle, Clock } from "lucide-react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import gsap from "react-gsap"; 
// Note: real GSAP requires import gsap from "gsap"; let's stick to simple react state if GSAP fails but we will try.
import { Canvas, useFrame } from "@react-three/fiber";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// -- Three.js Background Component --
const AbstractShapes = () => {
  const meshRef = useRef<any>(null);
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.15;
      meshRef.current.rotation.y += delta * 0.2;
    }
  });
  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[2.5, 0]} />
      <meshBasicMaterial color="#e2e8f0" wireframe />
    </mesh>
  );
};

// -- Mock Data --
const MOCK_JOBS = [
  { id: 1, title: "Senior Frontend Engineer", salary: "$140k - $160k", applicants: 45, passed: 12, rejected: 33 },
  { id: 2, title: "AI Product Manager", salary: "$130k - $170k", applicants: 89, passed: 24, rejected: 65 },
  { id: 3, title: "Data Scientist", salary: "$150k - $180k", applicants: 112, passed: 18, rejected: 94 },
];

export default function RecruiterDashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  
  // Create Job Form State
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", salary: "", description: "" });

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title) return;
    setJobs([...jobs, { 
      id: jobs.length + 1, 
      title: newJob.title, 
      salary: newJob.salary || "TBD", 
      applicants: 0, 
      passed: 0, 
      rejected: 0 
    }]);
    setShowCreateJob(false);
    setNewJob({ title: "", salary: "", description: "" });
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Chart Data
  const barChartData = {
    labels: ['Applied', 'Passed Initial', 'Rejected'],
    datasets: [{
      label: 'Candidates',
      data: selectedJob ? [selectedJob.applicants, selectedJob.passed, selectedJob.rejected] : [0,0,0],
      backgroundColor: ['#3b82f6', '#22c55e', '#ef4444'],
      borderRadius: 4,
    }]
  };

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">HireWise</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Recruiter Panel</p>
          </div>
          <nav className="p-4 space-y-2">
            <button onClick={() => {setActiveTab("home"); setSelectedJobId(null);}} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === "home" ? "bg-white border border-gray-200 shadow-sm text-blue-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <HomeIcon size={20} /> <span>Home</span>
            </button>
            <button onClick={() => {setActiveTab("applications"); setSelectedJobId(null);}} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === "applications" ? "bg-white border border-gray-200 shadow-sm text-blue-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <Briefcase size={20} /> <span>Applications</span>
            </button>
            <button onClick={() => {setActiveTab("dashboard"); setSelectedJobId(null);}} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === "dashboard" ? "bg-white border border-gray-200 shadow-sm text-blue-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <LayoutDashboard size={20} /> <span>Dashboard</span>
            </button>
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200">
          <Link href="/" className="flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium w-full">
            <LogOut size={20} /> <span>Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-white">
        
        {/* Decorative subtle 3D background for Home */}
        {activeTab === "home" && (
          <div className="absolute top-0 right-0 w-96 h-96 opacity-40 pointer-events-none">
            <Canvas>
              <AbstractShapes />
            </Canvas>
          </div>
        )}

        <div className="p-10 max-w-6xl mx-auto relative z-10">
          
          {/* HOME TAB */}
          {activeTab === "home" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header>
                <h2 className="text-4xl font-bold tracking-tight text-gray-900">Welcome Back</h2>
                <p className="text-gray-500 mt-2 text-lg">Here is a quick overview of your recruitment pipeline today.</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Briefcase size={24} /></div>
                    <h3 className="text-lg font-semibold text-gray-700">Active Jobs</h3>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{jobs.length}</p>
                </div>
                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Users size={24} /></div>
                    <h3 className="text-lg font-semibold text-gray-700">Total Applicants</h3>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{jobs.reduce((acc, curr) => acc + curr.applicants, 0)}</p>
                </div>
                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><CheckCircle size={24} /></div>
                    <h3 className="text-lg font-semibold text-gray-700">Passed Candidates</h3>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{jobs.reduce((acc, curr) => acc + curr.passed, 0)}</p>
                </div>
              </div>
            </div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === "applications" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="flex justify-between items-end border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-gray-900">Job Applications</h2>
                  <p className="text-gray-500 mt-1">Manage postings and review candidates.</p>
                </div>
                <button onClick={() => setShowCreateJob(!showCreateJob)} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors">
                  <Plus size={18} /> <span>Create New Job</span>
                </button>
              </header>

              {showCreateJob && (
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl mb-8">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Post a New Role</h3>
                  <form onSubmit={handleCreateJob} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                        <input value={newJob.title} onChange={e=>setNewJob({...newJob, title: e.target.value})} required type="text" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g. Senior Backend Engineer" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Salary Range</label>
                        <input value={newJob.salary} onChange={e=>setNewJob({...newJob, salary: e.target.value})} type="text" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g. $120k - $150k" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Description (Optional)</label>
                      <textarea value={newJob.description} onChange={e=>setNewJob({...newJob, description: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 h-24" placeholder="Briefly describe the requirements..."></textarea>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button type="button" onClick={() => setShowCreateJob(false)} className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">Cancel</button>
                      <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm">Post Job</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {jobs.map(job => (
                  <div key={job.id} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex items-center justify-between hover:border-gray-300 transition-colors">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 flex items-center"><Clock size={14} className="mr-1"/> Salary: {job.salary}</p>
                    </div>
                    <div className="flex space-x-6 text-sm">
                      <div className="text-center">
                        <span className="block font-bold text-xl text-gray-900">{job.applicants}</span>
                        <span className="text-gray-500">Applied</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-xl text-green-600">{job.passed}</span>
                        <span className="text-gray-500">Passed</span>
                      </div>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <p className="text-gray-500">No jobs posted yet.</p>}
              </div>
            </div>
          )}

          {/* DASHBOARD TAB (Analytics) */}
          {activeTab === "dashboard" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <header className="border-b border-gray-200 pb-4">
                  <h2 className="text-3xl font-bold tracking-tight text-gray-900">Recruitment Analytics</h2>
                  <p className="text-gray-500 mt-1">Select a job below and view AI Orchestrator performance.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Job List Panel */}
                <div className="col-span-1 bg-gray-50 rounded-xl border border-gray-200 p-4 h-max">
                  <h3 className="font-semibold text-gray-800 mb-4 px-2">Posted Roles ({jobs.length})</h3>
                  <div className="space-y-2">
                    {jobs.map(job => (
                      <button 
                        key={job.id} 
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${selectedJobId === job.id ? 'bg-white border-l-4 border-l-blue-600 border border-gray-200 shadow-sm text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        {job.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Analytics Panel */}
                <div className="col-span-2 space-y-6">
                  {!selectedJobId ? (
                    <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                      &larr; Select a job from the list to view its analytics
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6">
                        Pipeline: {selectedJob?.title}
                      </h3>
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-4">Pipeline Breakdown</p>
                          <Bar 
                            data={barChartData} 
                            options={{ maintainAspectRatio: true, plugins: { legend: { display:false }} }}
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500 font-medium">Yield Rate (Passed/Applied)</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                              {selectedJob?.applicants ? Math.round((selectedJob.passed / selectedJob.applicants) * 100) : 0}%
                            </p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500 font-medium">Total Rejected by Orchestrator</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{selectedJob?.rejected}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

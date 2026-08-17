'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Award, Calendar, BarChart3, TrendingUp, Activity } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { usePrograms, useTeams, useGroups, useParticipants, useInvalidate } from '@/lib/queries';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminDashboard() {
  const { data: programs = [] } = usePrograms();
  const { data: teams = [] } = useTeams();
  const { data: groups = [] } = useGroups();
  const { data: participants = [] } = useParticipants();
  const { invalidatePrograms } = useInvalidate();
  const refreshPrograms = invalidatePrograms;
  const loading = false;
  const participantCount = participants?.length ?? 0;
  
  // Local state for UI
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [isProgramsVisible, setIsProgramsVisible] = useState(true);

  const languages = ['All', 'Malayalam', 'Arabic', 'Urdu', 'English'];


  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await apiRequest(`/programs/${id}`, 'PATCH', { status: newStatus });
      refreshPrograms();
    } catch (e: any) {
        alert('Failed to update status');
    }
  };

  const activePrograms = programs.filter(p => {
    const matchesStatus = p.status !== 'completed';
    const matchesLanguage = selectedLanguage === 'All' || (p.language || 'English') === selectedLanguage;
    return matchesStatus && matchesLanguage;
  });



  const chartData = {
    labels: teams.map(t => t.name),
    datasets: [
      {
        label: 'Total Points',
        data: teams.map(t => t.totalScore),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)');
          return gradient;
        },
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#9CA3AF',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        displayColors: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(75, 85, 99, 0.1)' },
        ticks: { color: '#9CA3AF', font: { size: 11 } },
        border: { display: false }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 11 } },
        border: { display: false }
      }
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            Dashboard Overview
          </h1>
          <p className="text-gray-400 mt-1">Monitor real-time statistics and manage events</p>
        </div>
        <div className="flex gap-3">
            <button className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-900/20">
                <Activity size={16} />
                Live Report
            </button>
        </div>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Standings Section */}
        <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={100} />
          </div>
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-xl font-bold text-white">Team Standings</h2>
              <p className="text-sm text-gray-400">Current performance rankings</p>
            </div>
            <Award className="text-blue-500" size={24} />
          </div>

          <div className="relative z-10 overflow-hidden rounded-xl border border-[#2D283E] bg-[#13111C]/50 backdrop-blur-sm">
            <div className="w-full">
              {/* Desktop Header */}
              <div className="hidden md:flex border-b border-[#2D283E] text-gray-400 text-xs uppercase tracking-wider bg-[#13111C]">
                  <div className="p-4 w-24">Rank</div>
                  <div className="p-4 flex-1">Team</div>
                  <div className="p-4 text-right">Points</div>
              </div>

              <div className="divide-y divide-[#2D283E]">
                {teams.length > 0 ? (
                  teams.map((team: any, index: number) => (
                    <div key={team._id} className="flex items-center justify-between p-4 hover:bg-[#252236] transition-colors">
                      <div className="flex items-center gap-4">
                          <div className={`
                            flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0
                            ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 
                              index === 1 ? 'bg-gray-300/20 text-gray-300 border border-gray-300/30' : 
                              index === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' : 
                              'text-white bg-gray-800'}
                          `}>
                            {index + 1}
                          </div>
                          <span className="font-medium text-white text-lg md:text-base">{team.name}</span>
                      </div>
                      <div className="font-bold text-blue-400 text-lg md:text-base">{team.totalScore}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500 italic">No teams found.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Points Distribution Graph */}
        <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-2xl p-6 shadow-xl h-[400px] flex flex-col relative overflow-hidden">
           <div className="flex items-center justify-between mb-2">
             <div>
                <h2 className="text-xl font-bold text-white">Points Distribution</h2>
                <p className="text-sm text-gray-400">Score comparison across teams</p>
             </div>
             <BarChart3 className="text-purple-500" size={24} />
           </div>
           <div className="flex-1 min-h-0 w-full">
                <Bar options={chartOptions} data={chartData} />
           </div>
        </div>
      </div>



      <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-2xl shadow-xl overflow-hidden mb-20 md:mb-0 max-w-full">
        <div className="p-6 border-b border-[#2D283E] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Active Programs
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/30">
                  {programs.filter(p => p.status !== 'completed').length}
                </span>
              </h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="bg-[#13111C] p-1 rounded-lg border border-[#2D283E] flex w-full sm:w-auto overflow-x-auto">
                    {languages.map(lang => (
                        <button
                            key={lang}
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                                selectedLanguage === lang
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                                    : 'text-gray-400 hover:text-white hover:bg-[#252236]'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        
        {isProgramsVisible && (
            <div className="overflow-x-auto">
                {activePrograms.length > 0 ? (
                <ProgramCards programs={activePrograms} onStatusUpdate={handleStatusUpdate} />
                ) : (
                <div className="col-span-full text-center p-12 bg-[#13111C]/50 rounded-3xl border border-dashed border-[#2D283E] mx-4 mb-4 flex flex-col items-center gap-2">
                    <Calendar size={48} className="opacity-20 text-purple-500" />
                    <p className="text-gray-400">No active programs matching your filters</p>
                </div>
                )}
            </div>
        )}
      </div>

    </div>
  );
}

function ProgramCards({ programs, onStatusUpdate }: { programs: any[], onStatusUpdate: (id: string, status: string) => void }) {
  return (
    <div className="w-full">
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 border-b border-[#2D283E] text-gray-400 bg-[#13111C] text-xs uppercase tracking-wider p-4 pl-6">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Program Name</div>
            <div className="col-span-2">Language</div>
            <div className="col-span-2">Group</div>
            <div className="col-span-3 text-right pr-6">Status</div>
        </div>

      <div className="divide-y divide-[#2D283E]">
        {programs.map((program: any, index: number) => (
          <div key={program._id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 md:pl-6 hover:bg-[#252236] transition-colors group items-center">
            
            {/* Mobile: Row 1 - Icon + Name */}
            <div className="col-span-1 md:col-span-5 flex items-center gap-3 w-full">
                <span className="text-gray-500 font-mono text-sm hidden md:block w-6">{index + 1}</span>
                <div className={`p-2 rounded-lg shrink-0 ${program.status === 'ongoing' ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"}`}>
                    <Award size={18} />
                </div>
                 <div className="flex flex-col md:flex-row md:items-center gap-1">
                    <span className="font-medium text-white">{program.name}</span>
                    <span className="md:hidden text-xs text-gray-500">{program.language || 'English'} • {program.groupId?.name || 'N/A'}</span>
                 </div>
            </div>

            {/* Desktop: Language */}
             <div className="hidden md:block col-span-2">
               <span className="bg-[#13111C] text-gray-300 border border-[#2D283E] px-2.5 py-1 rounded-full text-xs font-medium">
                    {program.language || 'English'}
                </span>
            </div>

            {/* Desktop: Group */}
            <div className="hidden md:block col-span-2 text-gray-400 text-sm">{program.groupId?.name || 'N/A'}</div>

            {/* Status (Both) */}
            <div className="col-span-1 md:col-span-3 text-right flex justify-between md:justify-end items-center w-full mt-2 md:mt-0">
               {/* Mobile Rank Display */}
               <span className="md:hidden text-gray-500 font-mono text-sm">#{index + 1}</span>
               
                 <div className="relative inline-block">
                    <select 
                        value={program.status || 'upcoming'}
                        onChange={(e) => onStatusUpdate(program._id, e.target.value)}
                        className={`py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium bg-[#13111C] border outline-none cursor-pointer appearance-none transition-colors ${
                            program.status === 'ongoing' ? 'text-yellow-500 border-yellow-500/50 hover:border-yellow-500' :
                            program.status === 'completed' ? 'text-green-500 border-green-500/50 hover:border-green-500' :
                            'text-purple-400 border-purple-500/50 hover:border-purple-500'
                        }`}
                    >
                        <option value="upcoming" className="bg-[#13111C] text-gray-300">Upcoming</option>
                        <option value="ongoing" className="bg-[#13111C] text-yellow-500">Ongoing</option>
                        <option value="completed" className="bg-[#13111C] text-green-500">Completed</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                 </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

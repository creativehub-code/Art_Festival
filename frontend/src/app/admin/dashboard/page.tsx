'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Award, Calendar, BarChart3, TrendingUp, Activity, Users, Trophy, Star, ChevronRight, BarChart, ArrowRight, UserCheck, Layers, ChevronLeft, CalendarDays, CheckSquare, MapPin, Search, Bell, Trash2 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { usePrograms, useTeams, useGroups, useParticipants, useInvalidate } from '@/lib/queries';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

export default function AdminDashboard() {
  const { data: programs = [] } = usePrograms();
  const { data: teams = [] } = useTeams();
  const { data: groups = [] } = useGroups();
  const { data: participants = [] } = useParticipants();
  const { invalidatePrograms } = useInvalidate();
  const refreshPrograms = invalidatePrograms;
  const participantCount = participants?.length ?? 0;
  
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

  const activePrograms = programs.filter((p: any) => p.status !== 'completed');
  const filteredActivePrograms = activePrograms.filter((p: any) => {
    const matchesLanguage = selectedLanguage === 'All' || (p.language || 'English') === selectedLanguage;
    return matchesLanguage;
  });

  const sortedTeams = [...teams].sort((a: any, b: any) => (b.totalScore || 0) - (a.totalScore || 0));
  const leadingTeam = sortedTeams.length > 0 ? sortedTeams[0] : null;
  const totalPoints = teams.reduce((acc: number, t: any) => acc + (t.totalScore || 0), 0);

  const upcomingEvents = programs.filter((p: any) => p.status === 'upcoming').slice(0, 3);

  // Line Chart Data
  const lineChartData = {
    labels: sortedTeams.map(t => t.name.length > 10 ? t.name.substring(0, 10) + '...' : t.name),
    datasets: [
      {
        label: 'Points',
        data: sortedTeams.map(t => t.totalScore || 0),
        borderColor: '#A855F7', // purple-500
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
          gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
          return gradient;
        },
        borderWidth: 3,
        pointBackgroundColor: '#1E1B2E',
        pointBorderColor: '#A855F7',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4, // Smooth curve
      },
    ],
  };

  const lineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
         backgroundColor: '#13111C',
         titleColor: '#fff',
         bodyColor: '#A855F7',
         borderColor: '#2D283E',
         borderWidth: 1,
         padding: 12,
         displayColors: false,
         callbacks: {
           label: (context: any) => `${context.parsed.y} Points`
         }
      }
    },
    scales: {
      x: { display: false },
      y: { display: false, min: 0 }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    layout: {
      padding: { top: 20, bottom: 0, left: -10, right: -10 }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 max-w-[1600px] mx-auto">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 tracking-tight">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-4">
           {/* Mock Search Bar */}
           <div className="hidden sm:flex items-center bg-[#13111C] border border-[#2D283E] rounded-full px-4 py-2 w-64 focus-within:border-purple-500 transition-colors">
              <Search size={16} className="text-gray-500 mr-2" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-gray-500" />
           </div>
           {/* Mock Profile & Notifications */}
           <div className="flex items-center gap-3">
              <button className="w-10 h-10 rounded-full bg-[#13111C] border border-[#2D283E] flex items-center justify-center text-gray-400 hover:text-white transition-colors relative">
                 <Bell size={18} />
                 <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full border border-[#080A12]"></span>
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 border border-[#2D283E] flex items-center justify-center text-white font-bold shadow-lg overflow-hidden">
                 <img src={`https://ui-avatars.com/api/?name=Admin&background=random&color=fff`} alt="Admin" className="w-full h-full object-cover" />
              </div>
           </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left/Center Content Area */}
        <div className="xl:col-span-9 flex flex-col gap-6 min-w-0">
          
          {/* Top Row: Large Chart (2/3) + Stacked Cards (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Large Purple Chart Card */}
            <div className="lg:col-span-2 bg-gradient-to-b from-[#2A2346] to-[#1E1B2E] border border-purple-500/20 rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(168,85,247,0.05)] flex flex-col relative overflow-hidden group">
               {/* Background Glow */}
               <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none"></div>
               
               <div className="flex justify-between items-start mb-2 relative z-10">
                 <div>
                    <h2 className="text-white font-bold text-xl mb-1">Overview</h2>
                    <p className="text-purple-300/60 text-xs">Team performance trends</p>
                 </div>
                 <div className="bg-[#13111C]/50 border border-purple-500/20 rounded-full px-4 py-1.5 text-xs text-purple-300 font-medium flex items-center transition-colors">
                    {programs.filter((p: any) => p.status === 'ongoing').length} Ongoing
                 </div>
               </div>
               
               {/* Chart Area */}
               <div className="flex-1 min-h-[160px] relative z-10 w-full ml-[-10px]">
                  <Line data={lineChartData} options={lineChartOptions} />
                  {/* Floating Stat inside chart area (Mocking the 9.178 Steps bubble) */}
                  <div className="absolute top-1/4 left-1/3 bg-[#1E1B2E] border border-purple-500/30 rounded-xl px-3 py-1.5 shadow-xl hidden sm:flex items-center gap-2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                     <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                     <div>
                       <span className="block text-white font-bold text-sm leading-tight">{totalPoints}</span>
                       <span className="block text-gray-400 text-[10px] leading-tight">Total Pts</span>
                     </div>
                  </div>
               </div>

               {/* Bottom 3 Stats */}
               <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 relative z-10">
                  <div className="bg-[#13111C]/40 backdrop-blur-md border border-white/5 rounded-2xl p-3 sm:p-4 hover:border-purple-500/30 transition-colors flex flex-col items-center justify-center text-center">
                     <p className="text-purple-300/50 text-[10px] sm:text-xs font-semibold mb-1 uppercase tracking-wider">Total Programs</p>
                     <div className="flex items-baseline justify-center gap-1.5">
                       <h3 className="text-white font-bold text-lg sm:text-2xl leading-none">{programs.length}</h3>
                       <span className="text-gray-500 text-[10px] sm:text-xs mb-0.5 hidden sm:inline">Active</span>
                     </div>
                  </div>
                  <div className="bg-[#13111C]/40 backdrop-blur-md border border-white/5 rounded-2xl p-3 sm:p-4 hover:border-purple-500/30 transition-colors flex flex-col items-center justify-center text-center">
                     <p className="text-purple-300/50 text-[10px] sm:text-xs font-semibold mb-1 uppercase tracking-wider">Finished Events</p>
                     <div className="flex items-baseline justify-center gap-1.5">
                       <h3 className="text-white font-bold text-lg sm:text-2xl leading-none">{programs.filter((p: any) => p.status === 'completed').length}</h3>
                       <span className="text-gray-500 text-[10px] sm:text-xs mb-0.5 hidden sm:inline">Events</span>
                     </div>
                  </div>
                  <div className="bg-[#13111C]/40 backdrop-blur-md border border-purple-500/30 rounded-2xl p-3 sm:p-4 shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden flex flex-col items-center justify-center text-center">
                     <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent pointer-events-none"></div>
                     <p className="text-purple-300/80 text-[10px] sm:text-xs font-semibold mb-1 uppercase tracking-wider relative z-10">Upcoming</p>
                     <div className="flex items-baseline justify-center gap-1.5 relative z-10">
                       <h3 className="text-white font-bold text-lg sm:text-2xl leading-none">{programs.filter((p: any) => p.status === 'upcoming').length}</h3>
                       <span className="text-gray-400 text-[10px] sm:text-xs mb-0.5 hidden sm:inline">Progs</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Stacked Cards */}
            <div className="lg:col-span-1 flex flex-col gap-6">
               
               {/* Participants Card */}
               <div className="flex-1 bg-gradient-to-br from-[#2D2B52] to-[#1E1B2E] border border-indigo-500/20 rounded-[2rem] p-6 flex flex-col justify-between group hover:border-indigo-500/40 transition-all shadow-lg relative overflow-hidden min-h-[140px]">
                  <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                  <div className="flex items-start justify-between relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-[#13111C]/50 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                      <Users size={24} strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="relative z-10 flex items-end justify-between mt-4">
                    <p className="text-indigo-300/70 text-xs font-semibold uppercase tracking-wider mb-1 whitespace-nowrap">Participants</p>
                    <h3 className="text-white font-black text-5xl leading-none">
                      {participantCount}
                    </h3>
                  </div>
               </div>

               {/* Groups Card */}
               <div className="flex-1 bg-gradient-to-br from-[#4A2545] to-[#1E1B2E] border border-pink-500/20 rounded-[2rem] p-6 flex flex-col justify-between group hover:border-pink-500/40 transition-all shadow-lg relative overflow-hidden min-h-[140px]">
                  <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                  <div className="flex items-start justify-between relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-[#13111C]/50 border border-pink-500/20 flex items-center justify-center text-pink-400 shadow-inner">
                      <Layers size={24} strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="relative z-10 flex items-end justify-between mt-4">
                    <p className="text-pink-300/70 text-xs font-semibold uppercase tracking-wider mb-1 whitespace-nowrap">Active Groups</p>
                    <h3 className="text-white font-black text-5xl leading-none">
                      {groups.length}
                    </h3>
                  </div>
               </div>

            </div>
          </div>

          {/* Middle Row: Progress Cards (Top 3 Teams) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {sortedTeams.slice(0, 3).map((team, index) => {
               const maxScore = sortedTeams[0]?.totalScore || 1;
               const percentage = Math.round(((team.totalScore || 0) / maxScore) * 100);
               const icons = [Award, Trophy, Star];
               const Icon = icons[index % icons.length];
               
               return (
                 <div key={team._id} className="bg-[#1E1B2E] border border-[#2D283E] rounded-[2rem] p-6 shadow-xl flex flex-col hover:border-purple-500/30 transition-colors group">
                    <div className="flex justify-between items-start mb-6">
                       <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-lg ${
                         index === 0 ? 'bg-indigo-500 text-white shadow-indigo-500/30' : 
                         index === 1 ? 'bg-purple-500 text-white shadow-purple-500/30' : 
                         'bg-[#2D283E] text-white shadow-black/20'
                       }`}>
                          <Icon size={22} strokeWidth={1.5} />
                       </div>
                       <div className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                          <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                          <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                       </div>
                    </div>
                    
                    <h3 className="text-white font-bold text-base mb-1 truncate w-full" title={team.name}>{team.name}</h3>
                    <p className="text-gray-500 text-xs font-medium mb-6">{team.totalScore} Points</p>
                    
                    <div className="w-full mt-auto">
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-2">
                        <span className="uppercase tracking-wider">Progress</span>
                        <span className={index === 0 ? 'text-indigo-400' : index === 1 ? 'text-purple-400' : 'text-gray-300'}>{percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#13111C] rounded-full overflow-hidden">
                         <div className={`h-full rounded-full transition-all duration-1000 ${
                           index === 0 ? 'bg-indigo-500' : 
                           index === 1 ? 'bg-purple-500' : 
                           'bg-gray-400'
                         }`} style={{ width: `${percentage}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-500 mt-2">
                        <span>{team.totalScore} / {maxScore} max</span>
                        <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-white/70">Rank #{index + 1}</span>
                      </div>
                    </div>
                 </div>
               );
            })}
            
            {sortedTeams.length === 0 && (
               <div className="col-span-3 text-center py-10 bg-[#1E1B2E] border border-[#2D283E] rounded-[2rem]">
                  <p className="text-gray-500">No team data available for progress cards.</p>
               </div>
            )}
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-3 flex flex-col gap-6 shrink-0">
           
           {/* Teams Standings (Like "Friends" list) */}
           <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-[2rem] p-6 shadow-xl h-fit">
              <div className="flex items-center mb-4">
                <h2 className="text-white font-bold text-lg">Top Teams</h2>
              </div>
              
              <div className="divide-y divide-[#2D283E]">
                {sortedTeams.slice(0, 6).map((team, index) => {
                  const initial = team.name.substring(0, 1).toUpperCase();
                  const colors = [
                    'from-indigo-500 to-blue-500',
                    'from-purple-500 to-pink-500',
                    'from-rose-500 to-orange-500',
                    'from-teal-500 to-emerald-500',
                    'from-amber-500 to-yellow-500',
                    'from-gray-500 to-gray-600',
                  ];
                  const bgClass = colors[index % colors.length];

                  return (
                  <div key={team._id} className="flex items-center gap-3 group py-3">
                     {/* Avatar */}
                     <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${bgClass} p-[1px] shrink-0`}>
                       <div className="w-full h-full bg-[#1E1B2E] rounded-full flex items-center justify-center">
                         <span className="text-white font-bold text-sm bg-clip-text text-transparent bg-gradient-to-br border-white">{initial}</span>
                       </div>
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="text-white text-sm font-bold truncate group-hover:text-purple-400 transition-colors cursor-default" title={team.name}>{team.name}</h4>
                       <p className="text-gray-500 text-[10px] font-medium">{team.totalScore} Points</p>
                     </div>
                     <div className="w-6 h-6 rounded-lg bg-[#13111C] border border-[#2D283E] flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:border-purple-500/30 transition-colors">
                       {index + 1}
                     </div>
                  </div>
                  );
                })}
                {sortedTeams.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500">No teams available.</div>
                )}
              </div>
           </div>

           {/* Upcoming Events (Like "Live Map") */}
           <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                 <MapPin size={120} />
              </div>
              <div className="flex justify-between items-center mb-5 relative z-10">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" />
                  <h2 className="text-white font-bold text-sm">Upcoming Events</h2>
                </div>
                <span className="text-[10px] text-gray-500 cursor-pointer hover:text-white transition-colors font-medium">View Map</span>
              </div>
              
              <div className="space-y-3 relative z-10">
                 {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                   <div key={event._id} className="flex gap-3 items-center group bg-[#13111C]/50 p-2.5 rounded-xl border border-[#2D283E] hover:border-purple-500/30 transition-colors">
                     <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                        <CalendarDays size={14} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-gray-300 text-xs font-bold truncate group-hover:text-white transition-colors">{event.name}</p>
                       <p className="text-gray-500 text-[9px] mt-0.5">{event.language || 'English'} • {event.groupId?.name || 'N/A'}</p>
                     </div>
                   </div>
                 )) : (
                   <div className="text-center py-4 bg-[#13111C]/30 rounded-xl border border-dashed border-[#2D283E]">
                     <p className="text-[10px] text-gray-500">No upcoming events.</p>
                   </div>
                 )}
              </div>
           </div>

        </div>
      </div>

      {/* Bottom Row: Active Programs (Moved to full width, no outer box) */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Active Programs
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-[#1E1B2E] text-purple-300 text-xs font-bold border border-[#2D283E]">
                {activePrograms.length}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="bg-[#1E1B2E] p-1 rounded-xl border border-[#2D283E] flex w-full sm:w-auto overflow-x-auto custom-scrollbar">
                    {languages.map(lang => (
                        <button
                            key={lang}
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                selectedLanguage === lang
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        
        {isProgramsVisible && (
            <div>
                {filteredActivePrograms.length > 0 ? (
                  <ProgramCards programs={filteredActivePrograms} onStatusUpdate={handleStatusUpdate} />
                ) : (
                <div className="col-span-full text-center p-12 bg-[#1E1B2E]/50 rounded-2xl border border-dashed border-[#2D283E] flex flex-col items-center gap-2">
                    <Calendar size={40} className="opacity-20 text-purple-500 mb-2" />
                    <p className="text-gray-400 text-sm">No active programs matching your filters</p>
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
    <div className="w-full py-2">
      <div className="relative pl-6 sm:pl-8 space-y-3">
        {/* Timeline Line */}
        <div className="absolute left-2.5 sm:left-3.5 top-4 bottom-4 w-0.5 bg-purple-500/30 rounded-full"></div>

        {programs.map((program: any) => {
          const isOngoing = program.status === 'ongoing';

          return (
            <div key={program._id} className="relative flex items-center group">
              {/* Timeline Node Ring */}
              <div className="absolute -left-6 sm:-left-8 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                {isOngoing ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 bg-[#1E1B2E] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,1)]"></div>
                  </div>
                ) : (
                  <div className="w-3 h-3 rounded-full border-2 border-purple-500/30 bg-[#1E1B2E]"></div>
                )}
              </div>

              {/* Card Container - Compact parallel row */}
              <div className={`w-full rounded-2xl px-4 py-3 bg-[#131629] border ${
                isOngoing ? 'border-purple-500/50 bg-[#181b36] shadow-lg shadow-purple-900/20' : 'border-white/[0.06] hover:border-purple-500/30 hover:bg-[#161830]'
              } transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/card`}>
                
                {/* Parallel Items (Heading + Group Badge + Program/Language Badge) */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm sm:text-base tracking-wide truncate max-w-[220px] sm:max-w-none">
                    {program.name}
                  </h3>

                  <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-xs font-semibold border border-purple-500/20 whitespace-nowrap">
                    {program.groupId?.name || 'General'}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-md bg-white/[0.04] text-gray-400 text-xs font-medium border border-white/[0.06] whitespace-nowrap">
                    {program.language || 'English'}
                  </span>
                </div>

                {/* Right Side Controls (Status Select Pill + Actions) */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative inline-block group/select">
                    <select 
                      value={program.status || 'upcoming'}
                      onChange={(e) => onStatusUpdate(program._id, e.target.value)}
                      className={`py-1 pl-3 pr-7 rounded-lg text-[10px] font-bold bg-[#0F1120] border outline-none cursor-pointer appearance-none transition-all uppercase tracking-wider ${
                        program.status === 'ongoing' ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' :
                        program.status === 'completed' ? 'text-green-400 border-green-500/40 bg-green-500/10' :
                        'text-purple-400 border-purple-500/30 bg-purple-500/10'
                      }`}
                    >
                      <option value="upcoming" className="bg-[#13111C] text-gray-300">UPCOMING</option>
                      <option value="ongoing" className="bg-[#13111C] text-yellow-500">ONGOING</option>
                      <option value="completed" className="bg-[#13111C] text-green-500">COMPLETED</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        program.status === 'ongoing' ? 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.8)]' :
                        program.status === 'completed' ? 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)]' : 
                        'bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.8)]'
                      }`}></div>
                    </div>
                  </div>

                  <button 
                    className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/10 opacity-0 group-hover/card:opacity-100"
                    onClick={() => {/* Mock delete action */}}
                    title="Delete Program"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

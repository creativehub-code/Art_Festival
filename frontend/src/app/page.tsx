'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';

interface Team {
  _id: string;
  name: string;
  totalScore: number;
}

interface Program {
  _id: string;
  name: string;
  status: string;
  updatedAt: string;
}

interface ParticipantResult {
  participantId: string;
  name: string;
  chestNumber: string;
  teamName: string;
  totalScore: number;
}

export default function PublicViewer() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [latestResult, setLatestResult] = useState<{ programName: string, results: ParticipantResult[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch public team leaderboard
        const teamsData = await apiRequest('/public/teams/leaderboard');
        setTeams(teamsData);

        // 2. Fetch public programs list to find the latest completed one
        const programsData: Program[] = await apiRequest('/public/programs');
        
        if (programsData.length > 0) {
          const lastProgram = programsData[0]; // Already sorted by updatedAt desc in backend
          
          // 3. Fetch public results for the last program
          const resultsData = await apiRequest(`/public/results/${lastProgram._id}`);

          // Map the ProgramResult schema to our ParticipantResult interface
          const mappedResults: ParticipantResult[] = resultsData.flatMap((res: any) => {
            if (res.participantIds && res.participantIds.length > 0) {
              return res.participantIds.map((p: any) => ({
                participantId: p._id || 'N/A',
                name: p.name || 'N/A',
                chestNumber: p.chestNumber || 'N/A',
                teamName: res.teamId?.name || p.teamId?.name || 'No Team',
                totalScore: res.positionPoints || 0
              }));
            }
            return [{
              participantId: res.participantId?._id || 'N/A',
              name: res.participantId?.name || 'N/A',
              chestNumber: res.participantId?.chestNumber || 'N/A',
              teamName: res.teamId?.name || 'No Team',
              totalScore: res.positionPoints || 0
            }];
          });

          setLatestResult({
            programName: lastProgram.name,
            results: mappedResults.slice(0, 15) // slice to 15 in case of big groups

          });
        } else {
          setLatestResult(null);
        }

        setLoading(false);
      } catch (err) {
        console.error('Public View Data Error:', err);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s for "Live" updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Art Festival 2026
          </h1>
          <p className="text-gray-400 text-sm tracking-widest uppercase">Live Results</p>
        </div>
        <Link href="/login" className="px-4 py-2 border border-gray-700 hover:border-purple-500 rounded-full text-xs font-bold transition duration-300 text-gray-300 hover:text-white hover:bg-purple-500/10">
          Admin / Judge Login
        </Link>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-12">
        
        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Team Leaderboard - 3D Bar Chart */}
          <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
            <h2 className="text-3xl font-bold flex items-center justify-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              <span className="text-4xl filter drop-shadow-lg">🏆</span> Team Standings
            </h2>
            
            <section className="bg-gray-900/40 p-8 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md relative min-h-[500px] flex flex-col justify-end">
              {loading ? (
                <div className="flex items-end justify-center gap-8 h-64 animate-pulse w-full">
                  {[1,2,3,4].map(i => <div key={i} className="w-24 bg-gray-800 rounded-t-lg" style={{height: ['40%', '75%', '55%', '90%'][i-1]}}></div>)}
                </div>
              ) : (
                <div className="flex-1 flex items-end justify-center gap-4 sm:gap-8 md:gap-12 pb-10 perspective-[1000px]">
                  {teams.map((team, index) => {
                    const maxScore = Math.max(...teams.map(t => t.totalScore), 10); // Minimum 10 scale
                    const percentage = Math.max((team.totalScore / maxScore) * 100, 5); // Minimum 5% height
                    
                    // Check for tie for 1st place
                    const isTieForFirst = teams.length > 1 && teams[0].totalScore === teams[1].totalScore;
                    const showLeader = index === 0 && !isTieForFirst;

                    // Color palettes for ranks
                    const gradients = [
                      'from-yellow-400 to-orange-600', // 1st
                      'from-emerald-400 to-green-600', // 2nd
                      'from-purple-400 to-indigo-600', // 3rd
                      'from-pink-400 to-rose-600',     // 4th
                      'from-blue-400 to-cyan-600'      // 5th+
                    ];
                    const gradient = gradients[index] || gradients[4];
                    const shadowColor = index === 0 ? 'bg-orange-500' : index === 1 ? 'bg-green-500' : index === 2 ? 'bg-indigo-500' : index === 3 ? 'bg-rose-500' : 'bg-cyan-500';

                    return (
                      <div key={team._id} className="relative group flex flex-col items-center justify-end h-full w-20 sm:w-28">
                        
                        {/* 3D Bar Structure */}
                        <div className="relative w-16 sm:w-20" style={{ height: `${percentage * 3}px`, maxHeight: '300px' }}>
                          
                          {/* Score Bubble */}
                          <div className="absolute -right-8 top-4 z-20 bg-white text-gray-900 font-extrabold text-sm py-1 px-3 rounded-lg shadow-xl transform rotate-3">
                             {team.totalScore}
                             <div className="absolute top-1/2 -left-1 w-2 h-2 bg-white transform -translate-y-1/2 rotate-45"></div>
                          </div>

                          {/* Front Face */}
                          <div className={`absolute inset-0 bg-gradient-to-b ${gradient} rounded-lg shadow-2xl z-10 opacity-90`}></div>
                          
                          {/* Top Face (Pseudo-3D) */}
                          <div className={`absolute -top-3 left-0 w-full h-3 ${shadowColor} opacity-50 rounded-t-sm transform skew-x-12 origin-bottom`}></div>
                          
                          {/* Side Face (Pseudo-3D) */}
                          <div className={`absolute top-0 -right-3 w-3 h-full ${shadowColor} opacity-70 rounded-r-sm transform skew-y-12 origin-left`}></div>

                          {/* Glossy Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent rounded-lg z-10"></div>
                        </div>

                        {/* Reflection */}
                        <div className="absolute top-full mt-2 w-16 sm:w-20 h-16 opacity-30 pointer-events-none overflow-hidden">
                           <div className={`w-full h-full bg-gradient-to-b ${gradient} blur-sm transform scale-y-[-1] mask-image-gradient`}></div>
                        </div>
                        
                        {/* Floor Shadow */}
                        <div className={`absolute bottom-0 w-24 h-4 ${shadowColor} blur-xl opacity-20 rounded-full translate-y-1/2`}></div>

                        {/* Team Name Header - Moved Below */}
                        <div className="mt-8 text-center z-20 relative w-max max-w-[150%]">
                           <span className={`block text-lg font-bold uppercase tracking-wider ${index === 0 ? 'text-yellow-400' : 'text-gray-300'}`}>{team.name}</span>
                           {showLeader && <span className="text-xs text-yellow-500 font-semibold">Leader</span>}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Last Published Program Result */}
          <section className="col-span-1 md:col-span-2 bg-gray-900/40 p-6 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-sm">
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="text-pink-400 text-3xl">📢</span> Result: {latestResult?.programName || 'Waiting...'}
            </h2>
            {loading ? (
               <div className="animate-pulse space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-800 rounded"></div>)}
              </div>
            ) : latestResult ? (
              <div className="space-y-4">
                {latestResult.results.map((result, index) => (
                  <div key={result.participantId} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border-l-4 border-l-pink-500/50 hover:bg-gray-800 transition-all">
                    <div className="flex items-center gap-3">
                         <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold bg-gray-700 text-gray-300`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{result.name}</p>
                        <p className="text-xs text-gray-400">{result.teamName} • Chest #{result.chestNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-xl text-pink-300">{result.totalScore} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
                <div className="text-gray-500 text-center py-10">No results published yet.</div>
            )}
          </section>

          {/* Last Published Program Result */}
          <section className="bg-gray-900/40 p-6 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-sm">
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="text-pink-400 text-3xl">📢</span> Result: {latestResult?.programName || 'Waiting...'}
            </h2>
            {loading ? (
               <div className="animate-pulse space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-800 rounded"></div>)}
              </div>
            ) : latestResult ? (
              <div className="space-y-4">
                {latestResult.results.map((result, index) => (
                  <div key={result.participantId} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border-l-4 border-l-pink-500/50 hover:bg-gray-800 transition-all">
                    <div className="flex items-center gap-3">
                         <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold bg-gray-700 text-gray-300`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{result.name}</p>
                        <p className="text-xs text-gray-400">{result.teamName} • Chest #{result.chestNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-xl text-pink-300">{result.totalScore} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
                <div className="text-gray-500 text-center py-10">No results published yet.</div>
            )}
          </section>
        </div>

        {/* Footer/Marquee or updates */}
        <div className="text-center text-gray-500 text-xs">
          Auto-refreshing every 10 seconds • Designed for Art Festival 2026
        </div>

      </main>
    </div>
  );
}

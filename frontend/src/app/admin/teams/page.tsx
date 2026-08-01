'use client';

import { useEffect, useState } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import { X, Trash2, Shield, Users, Trophy, Plus, ChevronRight } from 'lucide-react';
import { useAdminData } from '../AdminContext';

export default function TeamsPage() {
  const { teams, participants, refreshTeams } = useAdminData();
  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [filterGroup, setFilterGroup] = useState('All');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [viewParticipant, setViewParticipant] = useState<any>(null);

  // Sync selectedTeam whenever context teams refresh (e.g. after verify & calculate)
  // This keeps the detail panel's totalScore up to date without the admin re-clicking.
  useEffect(() => {
    if (!selectedTeam) return;
    const fresh = teams.find((t: any) => t._id === selectedTeam._id);
    if (fresh && fresh.totalScore !== selectedTeam.totalScore) {
      setSelectedTeam(fresh);
    }
  }, [teams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/teams', 'POST', { name });
      refreshTeams();
      setName('');
    } catch(e) { alert('Error creating team'); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent opening the details section
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await apiRequest(`/teams/${id}`, 'DELETE');
      refreshTeams();
      if (selectedTeam?._id === id) setSelectedTeam(null);
    } catch (e: any) { alert(e.message); }
  };

  const teamParticipants = participants.filter((p: any) => 
      (p.teamId?._id || p.teamId) === selectedTeam?._id
  );

  const filteredParticipants = teamParticipants.filter((p: any) => {
      if (filterGroup === 'All') return true;
      const gName = p?.groupId?.name || '';
      return gName.trim().toLowerCase() === filterGroup.toLowerCase();
  });

  const displayedParticipants = filteredParticipants.slice(0, displayLimit);
  const hasMoreParticipants = filteredParticipants.length > displayLimit;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500">
      
      {/* Header & Create Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="text-3xl font-bold text-white tracking-tight">Teams</h2>
           <p className="text-gray-500 mt-1 text-sm">Create teams and track their overall standing.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full md:w-auto p-1 bg-[#0F1120] border border-white/[0.07] rounded-xl flex shadow-lg">
            <div className="relative flex-1 md:w-64">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="New Team Name" 
                    className="w-full pl-10 pr-4 py-2.5 bg-transparent text-white focus:outline-none placeholder:text-gray-600 font-medium text-sm" 
                    required 
                />
            </div>
            <button className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-purple-900/20 flex items-center gap-2 text-sm">
                <Plus size={16} /> Add
            </button>
        </form>
      </div>

      {/* Modern Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {teams.map((t, index) => (
          <div 
            key={t._id} 
            onClick={() => { 
              setSelectedTeam(t);
              setFilterGroup('All');
              setDisplayLimit(20);
            }}
            className={`
                group relative bg-[#0F1120] rounded-xl p-4 border
                hover:border-purple-500/40 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/10 hover:-translate-y-1
                ${selectedTeam?._id === t._id ? 'ring-2 ring-purple-500/60 border-transparent' : 'border-white/[0.07]'}
            `}
          >
            {/* Background Gradient Blob */}
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-500"></div>

            <div className="relative z-10 flex flex-col h-full justify-between gap-3">
                <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-900/80 to-indigo-900/80 flex items-center justify-center border border-white/10 font-bold text-lg text-white">
                        {t.name.charAt(0)}
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.07] text-[10px] text-gray-500 font-mono">
                        #{index + 1}
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-bold text-white mb-0.5 group-hover:text-purple-300 transition-colors truncate">{t.name}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users size={12} /> {t.participantIds?.length || 0}</span>
                    </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between mt-1">
                     <span className="flex items-center gap-1.5 text-purple-400 font-bold text-sm">
                        <Trophy size={14} className="text-purple-500" />
                        {t.totalScore}
                     </span>
                     
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                             onClick={(e) => handleDelete(e, t._id)}
                             className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                         >
                             <Trash2 size={14} />
                         </button>
                         <button className="p-1.5 text-gray-500 hover:text-white bg-white/[0.06] rounded-md">
                             <ChevronRight size={14} />
                         </button>
                     </div>
                </div>
            </div>
          </div>
        ))}
        {teams.length === 0 && (
            <div className="col-span-full text-center p-16 bg-[#0F1120]/50 rounded-3xl border border-dashed border-white/[0.07] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/[0.07] group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-900/10">
                    <Trophy size={32} className="text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No teams yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Create your first team to track points and organize participants.</p>
            </div>
        )}
      </div>

      {/* Expanded Team Details Section */}
      {selectedTeam && (
        <div className="mt-8 bg-[#0F1120] border border-white/[0.07] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl shadow-black/60 w-full">
            {/* Header - matches reference photo */}
            <div className="px-6 py-5 border-b border-white/[0.06] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-purple-900/40 flex-shrink-0">
                     {selectedTeam.name.charAt(0)}
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold text-white">{selectedTeam.name}</h2>
                    <div className="flex items-center gap-3 text-sm mt-1">
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <Users size={13} />
                          <span>{teamParticipants.length} Members</span>
                        </span>
                        <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                        <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                          <Trophy size={13} />
                          <span>{selectedTeam.totalScore} Points</span>
                        </span>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                {/* Pill Filter - matches reference photo */}
                <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/[0.06] gap-0.5">
                   {['All', 'Senior', 'Junior', 'SubJunior'].map(filter => (
                      <button
                        key={filter}
                        onClick={() => { setFilterGroup(filter); setDisplayLimit(20); }}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                           filterGroup === filter 
                           ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40' 
                           : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {filter}
                      </button>
                   ))}
                </div>

                <button 
                    onClick={() => setSelectedTeam(null)}
                    className="p-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl text-gray-500 hover:text-white transition-colors border border-white/[0.06] flex-shrink-0"
                >
                    <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-2">
                  {/* Desktop - Exact card-row style from reference photo */}
                  <div className="hidden md:block space-y-2">
                      {displayedParticipants.map((p: any, index: number) => (
                        <div
                          key={p._id || index}
                          onClick={() => setViewParticipant(p)}
                          className="flex items-center gap-4 px-5 py-4 bg-[#131629] border border-white/[0.07] rounded-xl cursor-pointer hover:border-purple-500/30 hover:bg-[#161830] transition-all duration-200 group"
                        >
                          {/* Chest Number Badge */}
                          <div className="flex-shrink-0">
                            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#0F1120] border border-white/[0.1] text-purple-300 font-mono text-sm font-bold min-w-[80px] text-center">
                              {p.chestNumber}
                            </div>
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-100 group-hover:text-white transition-colors text-base truncate block">
                              {p.name}
                            </span>
                          </div>

                          {/* Group Badge */}
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                              p.groupId?.name === 'Senior' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              p.groupId?.name === 'Junior' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {p.groupId?.name || '-'}
                            </span>
                          </div>

                          {/* Events */}
                          <div className="flex-shrink-0 w-44">
                            {p.programs?.length > 0 ? (
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span>
                                {p.programs.length} Events Registered
                              </div>
                            ) : (
                              <span className="text-gray-600 text-sm">No events</span>
                            )}
                          </div>

                          {/* 3-dot menu */}
                          <div className="flex-shrink-0">
                            <button
                              onClick={e => e.stopPropagation()}
                              className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] rounded-lg transition-colors"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}

                      {hasMoreParticipants && (
                        <div className="pt-2 text-center">
                          <button
                            onClick={() => setDisplayLimit(prev => prev + 20)}
                            className="px-6 py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg font-medium transition-colors border border-purple-500/20"
                          >
                            Load More
                          </button>
                        </div>
                      )}
                      {filteredParticipants.length === 0 && (
                        <div className="py-16 text-center text-gray-600">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="p-4 rounded-full bg-white/[0.03] border border-white/[0.06]">
                              <Users className="opacity-30" size={32} />
                            </div>
                            <p>No participants found in this group.</p>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Mobile Card Grid View */}
                  <div className="md:hidden flex flex-col gap-3 p-1">
                          <>
                            {displayedParticipants.map((p: any, index: number) => (
                                    <div
                                      key={p._id || index}
                                      onClick={() => setViewParticipant(p)}
                                      className="bg-[#13111C] rounded-xl p-4 border border-[#2D283E] flex items-center justify-between shadow-sm relative overflow-hidden cursor-pointer hover:border-purple-500/40 transition-colors"
                                    >
                                         {/* Content */}
                                        <div className="flex flex-col gap-1 z-10 relative max-w-[70%]">
                                             <div className="flex items-center gap-2 mb-1">
                                                <span className="text-purple-400 font-mono text-xs font-bold bg-[#1E1B2E] px-1.5 py-0.5 rounded border border-[#2D283E]">
                                                    #{p.chestNumber}
                                                </span>
                                                 <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                                                    p.groupId?.name === 'Senior' ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' :
                                                    p.groupId?.name === 'Junior' ? 'text-green-400 border-green-500/20 bg-green-500/10' :
                                                    'text-orange-400 border-orange-500/20 bg-orange-500/10'
                                                 }`}>
                                                    {p.groupId?.name || '-'}
                                                </span>
                                             </div>
                                            <h3 className="text-white font-bold text-base leading-tight truncate">{p.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                 <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                 {p.programs?.length || 0} Events
                                            </div>
                                        </div>
                                        
                                         {/* Image */}
                                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-[#2D283E] bg-gray-800 shrink-0 z-10">
                                             <img 
                                                src={`${API_BASE_URL}/participants/${p._id}/photo`} 
                                                alt={p.name} 
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        </div>
                                    </div>
                                ))
                            }
                             {hasMoreParticipants && (
                                <button 
                                  onClick={() => setDisplayLimit(prev => prev + 20)}
                                  className="w-full mt-2 py-3 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-xl font-medium transition-colors border border-purple-500/20"
                                >
                                  Load More
                                </button>
                             )}
                             {filteredParticipants.length === 0 && (
                                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                                     <Users className="opacity-20 mb-2" size={24} />
                                     <p className="text-sm">No participants found.</p>
                                </div>
                            )}
                          </>
                  </div>
            </div>
        </div>
      )}

      {/* Participant Programs Modal */}
      {viewParticipant && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setViewParticipant(null)}
        >
          <div
            className="bg-[#1E1B2E] border border-[#2D283E] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 p-6 flex items-center gap-4 border-b border-[#2D283E]">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg flex-shrink-0 relative overflow-hidden">
                <span className="z-10">{viewParticipant.name.charAt(0)}</span>
                <img
                  src={`${API_BASE_URL}/participants/${viewParticipant._id}/photo`}
                  alt={viewParticipant.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white truncate">{viewParticipant.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-mono text-purple-300 text-xs bg-black/30 px-2 py-0.5 rounded border border-purple-500/20">
                    #{viewParticipant.chestNumber}
                  </span>
                  {viewParticipant.groupId?.name && (
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                      viewParticipant.groupId.name === 'Senior' ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' :
                      viewParticipant.groupId.name === 'Junior' ? 'text-green-400 border-green-500/20 bg-green-500/10' :
                      'text-orange-400 border-orange-500/20 bg-orange-500/10'
                    }`}>
                      {viewParticipant.groupId.name}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setViewParticipant(null)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Programs List */}
            <div className="p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-gray-700"></span>
                Assigned Programs ({viewParticipant.programs?.length || 0})
                <span className="flex-1 h-px bg-gray-700"></span>
              </h4>

              {viewParticipant.programs?.length > 0 ? (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                  {viewParticipant.programs.map((prog: any, i: number) => {
                    const lang = prog.language?.toLowerCase();
                    const langStyle =
                      lang === 'arabic'    ? { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20',  dot: 'bg-green-400'  } :
                      lang === 'english'   ? { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20',   dot: 'bg-blue-400'   } :
                      lang === 'malayalam' ? { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400' } :
                      lang === 'urdu'      ? { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400' } :
                                            { bg: 'bg-gray-700/40',   text: 'text-gray-300',   border: 'border-gray-600',      dot: 'bg-gray-400'   };
                    return (
                      <div
                        key={prog._id || i}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${langStyle.bg} ${langStyle.border}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${langStyle.dot}`}></span>
                        <span className="font-semibold text-white flex-1 truncate">{prog.name}</span>
                        <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded border ${langStyle.border} ${langStyle.bg} ${langStyle.text}`}>
                          {prog.language}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-600">
                  <Trophy size={36} className="opacity-20 mb-3" />
                  <p className="text-sm">No programs assigned yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

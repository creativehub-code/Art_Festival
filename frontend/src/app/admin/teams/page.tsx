'use client';

import { useEffect, useState } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import { X, Trash2, Shield, Users, Trophy, Plus, ChevronRight } from 'lucide-react';
import { useTeams, useTeamParticipants, useInvalidate } from '@/lib/queries';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/useToast';

export default function TeamsPage() {
  const { data: teams = [] as any[] } = useTeams();
  const { invalidateTeams } = useInvalidate();
  const { toasts, addToast, dismissToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [viewParticipant, setViewParticipant] = useState<any>(null);

  const { data: teamParticipantsData } = useTeamParticipants(selectedTeam?._id, 1, displayLimit);
  const teamParticipants = teamParticipantsData?.participants || [];
  const totalTeamParticipants = teamParticipantsData?.total || 0;
  const hasMoreParticipants = teamParticipants.length < totalTeamParticipants;

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
      invalidateTeams();
      setName('');
      addToast({ title: 'Success', message: 'Team created successfully!', type: 'success' });
    } catch(e: any) { 
      addToast({ title: 'Error', message: e.message || 'Error creating team', type: 'error' }); 
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent opening the details section
    setDeleteConfirmId(id);
  };

  const confirmDeleteTeam = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/teams/${deleteConfirmId}`, 'DELETE');
      invalidateTeams();
      if (selectedTeam?._id === deleteConfirmId) setSelectedTeam(null);
      addToast({ title: 'Team Deleted', message: 'Team deleted successfully.', type: 'info' });
    } catch (e: any) { 
      addToast({ title: 'Delete Failed', message: e.message || 'Failed to delete team', type: 'error' }); 
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const displayedParticipants = teamParticipants;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500">
      
      {/* Header & Create Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">Teams</h2>
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

      {/* Circular Cards Horizontal Layout */}
      <div className="relative w-full overflow-x-auto pb-0 pt-8 custom-scrollbar">
        <div 
          className="grid grid-flow-col gap-x-4 md:gap-x-8 px-4 pb-0"
          style={{ gridAutoColumns: 'minmax(180px, 1fr)' }}
        >
        {teams.map((t, index) => {
          const colors = [
            'from-red-500 to-pink-500',
            'from-orange-400 to-red-500',
            'from-purple-500 to-indigo-500',
            'from-purple-400 to-pink-500',
            'from-cyan-400 to-blue-500'
          ];
          const colorClass = colors[index % colors.length];
          const isSelected = selectedTeam?._id === t._id;
          
          return (
            <div key={t._id} className="relative flex flex-col items-center w-full group">
                
                {/* Connecting Line to next item */}
                {index < teams.length - 1 && (
                  <div className="absolute top-[3rem] left-1/2 w-[calc(100%+1rem)] md:w-[calc(100%+2rem)] h-2 -translate-y-1/2 pointer-events-none z-0">
                      <svg className="overflow-visible" width="100%" height="100%">
                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#4B5563" strokeWidth="2" strokeDasharray="6 6" />
                        <circle cx="50%" cy="50%" r="6" fill="#0F1120" stroke="#4B5563" strokeWidth="2" />
                        <circle cx="50%" cy="50%" r="2.5" fill="#9CA3AF" />
                      </svg>
                  </div>
                )}

                {/* Circle */}
                <div 
                  onClick={() => { setSelectedTeam(t); setDisplayLimit(20); }}
                  className={`relative w-24 h-24 rounded-full bg-[#0F1120] border flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-xl z-10
                    ${isSelected ? 'border-purple-400 shadow-purple-500/40' : 'border-white/[0.07] hover:border-purple-500/50'}
                  `}
                >
                  <div className="absolute -inset-2 rounded-full border border-dashed border-gray-600/40 group-hover:border-purple-500/50 transition-colors duration-500 hover:animate-spin-slow"></div>
                  <span className={`text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br ${colorClass}`}>
                      {t.name.charAt(0)}
                  </span>
                  <div className={`absolute bottom-0 w-full h-1/2 rounded-b-full bg-gradient-to-br ${colorClass} opacity-10 blur-md`}></div>
                </div>

                {/* Text Below */}
                <div className="text-center px-2 mt-6 z-10 w-full">
                  <h3 className={`text-sm font-bold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r ${colorClass} truncate`}>{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    {t.totalScore} Points<br/>
                    {t.memberCount || 0} Members
                  </p>
                  
                  <div className="flex gap-2 justify-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleDelete(e, t._id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                          <Trash2 size={14} />
                      </button>
                      <button onClick={() => { setSelectedTeam(t); setDisplayLimit(20); }} className="p-1.5 text-gray-500 hover:text-white bg-white/[0.06] rounded-md">
                          <ChevronRight size={14} />
                      </button>
                  </div>
                </div>
            </div>
          )
        })}
        {teams.length === 0 && (
            <div className="col-span-full w-full text-center p-16 bg-[#0F1120]/50 rounded-3xl border border-dashed border-white/[0.07] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/[0.07] group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-900/10">
                    <Trophy size={32} className="text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No teams yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Create your first team to track points and organize participants.</p>
            </div>
        )}
        </div>
      </div>
      {/* Expanded Team Details Section */}
      {selectedTeam && (
        <div className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="p-4 space-y-2">
                <div className="flex justify-end">
                    <button 
                        onClick={() => setSelectedTeam(null)}
                        className="p-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl text-gray-500 hover:text-white transition-colors border border-white/[0.06] flex-shrink-0"
                        title="Close Details"
                    >
                        <X size={18} />
                    </button>
                </div>
                  {/* Desktop - Exact card-row style from reference photo */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 mb-2 text-gray-500 text-[11px] font-bold uppercase tracking-wider items-center">
                    <div className="col-span-1">#</div>
                    <div className="col-span-2">Code</div>
                    <div className="col-span-4">Participant Name</div>
                    <div className="col-span-2">Group</div>
                    <div className="col-span-2">Events</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>

                  <div className="hidden md:block space-y-2.5">
                      {displayedParticipants.map((p: any, index: number) => {
                        const formattedIndex = String(index + 1).padStart(2, '0');
                        const borderAccents = [
                          'border-l-purple-500',
                          'border-l-purple-500',
                          'border-l-amber-500',
                          'border-l-amber-500',
                          'border-l-blue-500',
                          'border-l-blue-500',
                          'border-l-indigo-500',
                          'border-l-indigo-500',
                        ];
                        const leftBorderClass = borderAccents[index % borderAccents.length];

                        return (
                        <div
                          key={p._id || index}
                          onClick={() => setViewParticipant(p)}
                          className={`card-animate grid grid-cols-12 gap-4 items-center px-6 py-3.5 bg-[#131629] border-t border-r border-b border-white/[0.06] border-l-2 ${leftBorderClass} rounded-xl cursor-pointer hover:border-purple-500/40 hover:bg-[#161830] transition-all duration-200 group shadow-sm`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {/* # Index */}
                          <div className="col-span-1 flex items-center">
                            <span className="text-gray-400 font-mono text-xs font-bold">{formattedIndex}</span>
                          </div>

                          {/* Code */}
                          <div className="col-span-2 flex items-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-purple-900/30 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold tracking-wide">
                              {p.chestNumber}
                            </span>
                          </div>

                          {/* Avatar + Name */}
                          <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <div className="relative w-8 h-8 flex-shrink-0">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow">
                                {p.name.charAt(0)}
                              </div>
                              <img
                                src={`${API_BASE_URL}/participants/${p._id}/photo`}
                                alt={p.name}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full rounded-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                            <span className="font-semibold text-gray-200 group-hover:text-white transition-colors text-sm truncate uppercase tracking-tight">
                              {p.name}
                            </span>
                          </div>

                          {/* Group Badge */}
                          <div className="col-span-2 flex items-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/30 uppercase tracking-wider">
                              <Users size={13} />
                              <span className="truncate">{p.groupId?.name || 'No Group'}</span>
                            </span>
                          </div>

                          {/* Events */}
                          <div className="col-span-2 flex items-center">
                            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                              <div className="flex flex-col text-[10px] leading-tight">
                                <span className="text-gray-300 font-medium whitespace-nowrap">
                                  {p.programs?.length > 0 ? `${p.programs.length} Events` : 'No events'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions / 3-dot Menu */}
                          <div className="col-span-1 flex items-center justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] rounded-lg transition-colors"
                              title="Actions"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                            </button>
                          </div>
                        </div>
                      )})}

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
                      {displayedParticipants.length === 0 && (
                        <div className="py-16 text-center text-gray-600">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="p-4 rounded-full bg-white/[0.03] border border-white/[0.06]">
                              <Users className="opacity-30" size={32} />
                            </div>
                            <p>No participants found in this team.</p>
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
                             {displayedParticipants.length === 0 && (
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
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Team"
        message="Are you sure you want to delete this team? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteTeam}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Trash2, X, Shield, Plus, Users, ChevronRight, Layers } from 'lucide-react';
import { useGroups, useGroupParticipants, useInvalidate } from '@/lib/queries';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/useToast';

export default function GroupsPage() {
  const { data: groups = [] as any[] } = useGroups();
  const { invalidateGroups } = useInvalidate();
  const { toasts, addToast, dismissToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [displayLimit, setDisplayLimit] = useState(20);

  const { data: groupParticipantsData } = useGroupParticipants(selectedGroup?._id, 1, displayLimit);
  const groupParticipants = groupParticipantsData?.participants || [];
  const totalGroupParticipants = groupParticipantsData?.total || 0;
  const hasMoreParticipants = groupParticipants.length < totalGroupParticipants;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/groups', 'POST', { name });
      invalidateGroups();
      setName('');
      addToast({ title: 'Success', message: 'Group created successfully!', type: 'success' });
    } catch(e: any) { 
      addToast({ title: 'Error', message: e.message || 'Error creating group', type: 'error' }); 
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/groups/${deleteConfirmId}`, 'DELETE');
      invalidateGroups();
      if (selectedGroup?._id === deleteConfirmId) setSelectedGroup(null);
      addToast({ title: 'Group Deleted', message: 'Group deleted successfully.', type: 'info' });
    } catch (e: any) { 
      addToast({ title: 'Delete Failed', message: e.message || 'Failed to delete group', type: 'error' }); 
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500">
      
      {/* Header & Create Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">Groups</h2>
           <p className="text-gray-500 mt-1 text-sm">Organize participants into competition categories.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full md:w-auto p-1 bg-[#0F1120] border border-white/[0.07] rounded-xl flex shadow-lg">
            <div className="relative flex-1 md:w-64">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="New Group Name" 
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
        {groups.map((g, index) => {
          const colors = [
            'from-red-500 to-pink-500',
            'from-orange-400 to-red-500',
            'from-purple-500 to-indigo-500',
            'from-purple-400 to-pink-500',
            'from-cyan-400 to-blue-500'
          ];
          const colorClass = colors[index % colors.length];
          const isSelected = selectedGroup?._id === g._id;
          
          return (
            <div key={g._id} className="relative flex flex-col items-center w-full group">
                
                {/* Connecting Line to next item */}
                {index < groups.length - 1 && (
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
                  onClick={() => { setSelectedGroup(g); setDisplayLimit(20); }}
                  className={`relative w-24 h-24 rounded-full bg-[#0F1120] border flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-xl z-10
                    ${isSelected ? 'border-purple-400 shadow-purple-500/40' : 'border-white/[0.07] hover:border-purple-500/50'}
                  `}
                >
                  <div className="absolute -inset-2 rounded-full border border-dashed border-gray-600/40 group-hover:border-purple-500/50 transition-colors duration-500 hover:animate-spin-slow"></div>
                  <span className={`text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br ${colorClass}`}>
                      {g.name.charAt(0)}
                  </span>
                  <div className={`absolute bottom-0 w-full h-1/2 rounded-b-full bg-gradient-to-br ${colorClass} opacity-10 blur-md`}></div>
                </div>

                {/* Text Below */}
                <div className="text-center px-2 mt-6 z-10 w-full">
                  <h3 className={`text-sm font-bold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r ${colorClass} truncate`}>{g.name}</h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    Category<br/>
                    {g.memberCount || 0} Members
                  </p>
                  
                  <div className="flex gap-2 justify-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleDelete(g._id, e)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                          <Trash2 size={14} />
                      </button>
                      <button onClick={() => { setSelectedGroup(g); setDisplayLimit(20); }} className="p-1.5 text-gray-500 hover:text-white bg-white/[0.06] rounded-md">
                          <ChevronRight size={14} />
                      </button>
                  </div>
                </div>
            </div>
          )
        })}
        {groups.length === 0 && (
            <div className="col-span-full w-full text-center p-16 bg-[#0F1120]/50 rounded-3xl border border-dashed border-white/[0.07] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/[0.07] group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-900/10">
                    <Shield size={32} className="text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No groups yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Create your first group to organize participants into competition categories.</p>
            </div>
        )}
        </div>
      </div>
      {/* Group Details Bottom Section */}
      {selectedGroup && (
        <div className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 space-y-2">
                <div className="flex justify-end">
                    <button 
                        onClick={() => setSelectedGroup(null)}
                        className="p-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl text-gray-500 hover:text-white transition-colors border border-white/[0.06]"
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
                 <div className="col-span-2">Team</div>
                 <div className="col-span-2">Events</div>
                 <div className="col-span-1 text-right">Actions</div>
               </div>

               <div className="hidden md:block space-y-2.5">
                 {groupParticipants.map((p: any, index: number) => {
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
                     key={p._id}
                     className={`card-animate grid grid-cols-12 gap-4 items-center px-6 py-3.5 bg-[#131629] border-t border-r border-b border-white/[0.06] border-l-2 ${leftBorderClass} rounded-xl hover:border-purple-500/30 hover:bg-[#161830] transition-all duration-200 group shadow-sm`}
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
                       </div>
                       <span className="font-semibold text-gray-200 group-hover:text-white transition-colors text-sm truncate uppercase tracking-tight">
                         {p.name}
                       </span>
                     </div>

                     {/* Team Badge */}
                     <div className="col-span-2 flex items-center">
                       <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border bg-purple-500/10 text-purple-400 border-purple-500/30 uppercase tracking-wider">
                         <span className="truncate">{p.teamId?.name || 'No Team'}</span>
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

                     {/* 3-dot menu */}
                     <div className="col-span-1 flex items-center justify-end">
                       <button
                         onClick={e => e.stopPropagation()}
                         className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] rounded-lg transition-colors"
                       >
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                       </button>
                     </div>
                   </div>
                 )})}
                 {groupParticipants.length === 0 && (
                   <div className="py-16 text-center text-gray-600">
                     <div className="flex flex-col items-center justify-center gap-3">
                       <div className="p-4 rounded-full bg-white/[0.03] border border-white/[0.06]">
                         <Users className="opacity-30" size={32} />
                       </div>
                       <p>No participants assigned to this group yet.</p>
                     </div>
                   </div>
                 )}
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
               </div>
               {/* Mobile */}
               <div className="md:hidden space-y-2">
                 {groupParticipants.map((p: any) => (
                   <div key={p._id} className="flex items-center gap-3 px-4 py-3 bg-[#131629] border border-white/[0.07] rounded-xl">
                     <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#0F1120] border border-white/[0.1] text-purple-300 font-mono text-xs font-bold">
                       {p.chestNumber}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="font-semibold text-gray-200 text-sm truncate">{p.name}</p>
                       <p className="text-gray-500 text-xs mt-0.5">{p.teamId?.name || '-'}</p>
                     </div>
                   </div>
                 ))}
                 {hasMoreParticipants && (
                    <button 
                      onClick={() => setDisplayLimit(prev => prev + 20)}
                      className="w-full mt-2 py-3 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-xl font-medium transition-colors border border-purple-500/20"
                    >
                      Load More
                    </button>
                 )}
               </div>
            </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Group"
        message="Are you sure you want to delete this group? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteGroup}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

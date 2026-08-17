'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Trash2, X, Shield, Plus, Users, ChevronRight, Layers } from 'lucide-react';
import { useGroups, useInvalidate } from '@/lib/queries';

export default function GroupsPage() {
  const { data: groups = [] as any[] } = useGroups();
  const { invalidateGroups } = useInvalidate();
  const [name, setName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/groups', 'POST', { name });
      invalidateGroups();
      setName('');
    } catch(e) { alert('Error creating group'); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      await apiRequest(`/groups/${id}`, 'DELETE');
      invalidateGroups();
      if (selectedGroup?._id === id) setSelectedGroup(null);
    } catch (e: any) { alert(e.message); }
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

       {/* Modern Grid */}
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {groups.map((g, index) => (
          <div 
            key={g._id} 
            onClick={() => setSelectedGroup(g)}
            className={`
                group relative bg-[#0F1120] rounded-xl p-4 border
                hover:border-purple-500/40 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/10 hover:-translate-y-1
                ${selectedGroup?._id === g._id ? 'ring-2 ring-purple-500/60 border-transparent' : 'border-white/[0.07]'}
            `}
          >
            {/* Background Gradient Blob */}
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-500"></div>

            <div className="relative z-10 flex flex-col h-full justify-between gap-3">
                <div className="flex justify-between items-start">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 font-bold text-lg text-white ${
                        g.name === 'Senior' ? 'bg-gradient-to-br from-blue-900/80 to-blue-800/80' :
                        g.name === 'Junior' ? 'bg-gradient-to-br from-emerald-900/80 to-emerald-800/80' :
                        'bg-gradient-to-br from-purple-900/80 to-indigo-900/80'
                    }`}>
                        {g.name.charAt(0)}
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.07] text-[10px] text-gray-500 font-mono">
                        #{index + 1}
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-bold text-white mb-0.5 group-hover:text-purple-300 transition-colors truncate">{g.name}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users size={12} /> {g.participantIds?.length || 0}</span>
                    </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between mt-1">
                     <span className="flex items-center gap-1.5 text-purple-400 font-bold text-xs uppercase tracking-wider">
                        <Layers size={14} className="text-purple-500" />
                        Category
                     </span>
                     
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                             onClick={(e) => handleDelete(g._id, e)}
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
        {groups.length === 0 && (
            <div className="col-span-full text-center p-16 bg-[#0F1120]/50 rounded-3xl border border-dashed border-white/[0.07] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/[0.07] group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-900/10">
                    <Shield size={32} className="text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No groups yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Create your first group to organize participants into competition categories.</p>
            </div>
        )}
      </div>

      {/* Group Details Bottom Section */}
      {selectedGroup && (
        <div className="mt-8 bg-[#0F1120] border border-white/[0.07] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/[0.06] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-purple-900/40 flex-shrink-0">
                     {selectedGroup.name.charAt(0)}
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold text-white">{selectedGroup.name} Participants</h2>
                    <div className="flex items-center gap-3 text-sm mt-1">
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <Users size={13} />
                          <span>{selectedGroup.participantIds?.length || 0} Members</span>
                        </span>
                    </div>
                 </div>
              </div>

               <button 
                    onClick={() => setSelectedGroup(null)}
                    className="p-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl text-gray-500 hover:text-white transition-colors border border-white/[0.06]"
                >
                    <X size={18} />
                </button>
            </div>
            
            <div className="p-4 space-y-2">
               {/* Desktop - Exact card-row style from reference photo */}
               <div className="hidden md:block space-y-2">
                 {selectedGroup.participantIds?.map((p: any) => (
                   <div
                     key={p._id}
                     className="flex items-center gap-4 px-5 py-4 bg-[#131629] border border-white/[0.07] rounded-xl hover:border-purple-500/30 hover:bg-[#161830] transition-all duration-200 group"
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

                     {/* Team */}
                     <div className="flex-shrink-0 w-40">
                       <span className="text-gray-500 text-sm">{p.teamId?.name || '-'}</span>
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
                 {(!selectedGroup.participantIds || selectedGroup.participantIds.length === 0) && (
                   <div className="py-16 text-center text-gray-600">
                     <div className="flex flex-col items-center justify-center gap-3">
                       <div className="p-4 rounded-full bg-white/[0.03] border border-white/[0.06]">
                         <Users className="opacity-30" size={32} />
                       </div>
                       <p>No participants assigned to this group yet.</p>
                     </div>
                   </div>
                 )}
               </div>
               {/* Mobile */}
               <div className="md:hidden space-y-2">
                 {selectedGroup.participantIds?.map((p: any) => (
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
               </div>
            </div>
        </div>
      )}
    </div>
  );
}

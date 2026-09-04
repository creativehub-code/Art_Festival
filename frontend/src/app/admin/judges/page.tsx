'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { Plus, Trash2, Users, X, UserMinus, Edit3, Globe, ChevronDown, Layers } from 'lucide-react';
import { usePrograms, useJudgeGroups, useLanguages, useInvalidate } from '@/lib/queries';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/useToast';

export default function JudgeGroupsPage() {
  const { data: programs = [] as any[] } = usePrograms();
  const { data: judgeGroups = [] as any[] } = useJudgeGroups();
  const { data: dbLanguages = [] as any[] } = useLanguages();
  const judgeCategories = dbLanguages.map(l => l.name);
  const { invalidateJudgeGroups, invalidateJudges } = useInvalidate();
  const { toasts, addToast, dismissToast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedGroupId(prev => (prev === id ? null : id));
  };

  // Form State
  const [groupName, setGroupName] = useState('');
  const [judgesInput, setJudgesInput] = useState([{ name: '', email: '', password: '' }]);
  const [assignedProgramIds, setAssignedProgramIds] = useState<string[]>([]);
  const [langFilter, setLangFilter] = useState(''); // '' = All
  
  // Search States
  const [panelSearchQ, setPanelSearchQ] = useState('');
  const [programSearchQ, setProgramSearchQ] = useState('');

  // Compute assigned programs to disable/sort them
  const programAssignmentStatus = useMemo(() => {
    const assignedToMap = new Map<string, string>(); // programId -> groupName
    judgeGroups.forEach((group: any) => {
        group.assignedPrograms?.forEach((p: any) => {
            assignedToMap.set(p._id, group.name);
        });
    });

    return programs.map((p: any) => ({
        ...p,
        assignedToGroupName: assignedToMap.get(p._id) || null
    })).sort((a: any, b: any) => {
        // Sort unassigned first, assigned last
        if (a.assignedToGroupName && !b.assignedToGroupName) return 1;
        if (!a.assignedToGroupName && b.assignedToGroupName) return -1;
        return a.name.localeCompare(b.name);
    });
  }, [programs, judgeGroups]);

  const handleAddJudgeInput = () => {
    setJudgesInput([...judgesInput, { name: '', email: '', password: '' }]);
  };

  const handleRemoveJudgeInput = (index: number) => {
    setJudgesInput(judgesInput.filter((_, i) => i !== index));
  };

  const handleJudgeInputChange = (index: number, field: string, value: string) => {
    const newInputs = [...judgesInput];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setJudgesInput(newInputs);
  };

  const handleCreateJudgeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Basic validation
      if (judgesInput.length === 0) {
          addToast({ title: 'Validation Error', message: 'At least one judge must be added to the group.', type: 'warning' });
          return;
      }
      
      await apiRequest('/judgeGroups', 'POST', {
        name: groupName,
        judges: judgesInput,
        assignedProgramIds
      });
      
      setShowModal(false);
      setGroupName('');
      setJudgesInput([{ name: '', email: '', password: '' }]);
      setAssignedProgramIds([]);
      setLangFilter('');
      setProgramSearchQ('');
      invalidateJudgeGroups(); // Refresh global list
      invalidateJudges(); // Also refresh judges list
      addToast({ title: 'Success', message: 'Judge group created successfully!', type: 'success' });
    } catch (error: any) {
      addToast({ title: 'Creation Error', message: error.message || 'Failed to create judge group', type: 'error' });
    }
  };

  const handleDeleteGroup = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteJudgeGroup = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/judgeGroups/${deleteConfirmId}`, 'DELETE');
      invalidateJudgeGroups();
      invalidateJudges();
      addToast({ title: 'Judge Group Deleted', message: 'Judge group deleted successfully.', type: 'info' });
    } catch (error: any) {
       addToast({ title: 'Delete Failed', message: error.message || 'Failed to delete judge group', type: 'error' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openEditModal = (group: any) => {
      setEditingGroupId(group._id);
      setAssignedProgramIds(group.assignedPrograms?.map((p: any) => p._id) || []);
      setProgramSearchQ('');
      setShowEditModal(true);
  };

  const handleUpdatePrograms = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingGroupId) return;

      try {
          await apiRequest(`/judgeGroups/${editingGroupId}`, 'PATCH', {
              assignedProgramIds
          });
          setShowEditModal(false);
          setEditingGroupId(null);
          setAssignedProgramIds([]);
          setLangFilter('');
          setProgramSearchQ('');
          invalidateJudgeGroups(); // Refresh global list
          addToast({ title: 'Programs Updated', message: 'Assigned programs updated successfully!', type: 'success' });
      } catch(error: any) {
          addToast({ title: 'Update Error', message: error.message || 'Failed to update programs', type: 'error' });
      }
  };

  return (
    <div className="relative">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal 
          isOpen={!!deleteConfirmId}
          onCancel={() => setDeleteConfirmId(null)}
          onConfirm={confirmDeleteJudgeGroup}
          title="Delete Judge Group"
          message="Are you sure you want to delete this judge group? All associated judges and their access will be removed."
      />
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl tracking-tight font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-400">
            Judge Groups (Panels)
          </h1>
          <div className="text-gray-400 mt-2 flex items-center gap-2">
             <div className="w-8 h-px bg-gradient-to-r from-purple-500/50 to-transparent" />
             Create and manage judging panels for programs
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setProgramSearchQ(''); }}
          className="group relative flex items-center gap-2 bg-[#13111C] hover:bg-[#1A1825] border border-gray-800 hover:border-purple-500/50 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-xl overflow-hidden"
        >
          {/* Button Hover gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <Users size={20} className="text-purple-400 group-hover:scale-110 transition-transform duration-300" />
          <span className="relative z-10">Add Judge Group</span>
        </button>
      </div>

      {/* Main Panel Search */}
      <div className="mb-6 relative max-w-md">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
              type="text"
              placeholder="Search Judge Panels..."
              value={panelSearchQ}
              onChange={e => setPanelSearchQ(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#13111C]/80 border border-gray-800 rounded-xl text-white focus:border-purple-500 focus:outline-none transition-colors"
          />
      </div>

      {judgeGroups.length === 0 ? (
        <div className="text-gray-500 text-center py-12">Loading judge groups...</div>
      ) : (
        <div className="space-y-3.5 relative z-10">
          {judgeGroups
            .filter(g => g.name.toLowerCase().includes(panelSearchQ.toLowerCase()))
            .map((group) => {
              const isExpanded = expandedGroupId === group._id;
              const judgesCount = group.judges?.length || 0;
              const programsCount = group.assignedPrograms?.length || 0;

              return (
                <div 
                  key={group._id} 
                  className={`group relative bg-[#13111C]/90 backdrop-blur-xl rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                    isExpanded 
                      ? 'border-purple-500/40 shadow-xl shadow-purple-900/10 bg-[#161324]' 
                      : 'border-white/5 hover:border-purple-500/30 hover:bg-[#161324]/60 shadow-sm'
                  }`}
                  onClick={() => toggleExpand(group._id)}
                >
                  {/* Decorative side accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-pink-500 transition-opacity duration-200 ${
                    isExpanded ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'
                  }`} />

                  {/* Summary Bar (Default Collapsed State) */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Group Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <Users size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors truncate">
                          {group.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-300 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            {judgesCount} {judgesCount === 1 ? 'Judge' : 'Judges'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-pink-300 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20 font-medium">
                            <Layers size={12} className="text-pink-400" />
                            {programsCount} {programsCount === 1 ? 'Program assigned' : 'Programs assigned'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Buttons & Expand Icon */}
                    <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(group); }}
                        className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-white/5"
                        title="Edit Assigned Programs"
                      >
                        <Edit3 size={13} className="text-pink-400" />
                        <span>Edit</span>
                      </button>

                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group._id); }}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                        title="Delete Group"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(group._id); }}
                        className="p-1.5 text-gray-400 group-hover:text-purple-300 rounded-lg hover:bg-white/5 transition-all"
                        aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
                      >
                        <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-purple-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content Drawer */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
                      <div className="grid md:grid-cols-2 gap-6 pt-2">
                        {/* Panel Members List */}
                        <div>
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" /> Panel Members ({judgesCount})
                          </h4>
                          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            {group.judges?.map((judge: any) => (
                              <div key={judge._id} className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 font-bold text-xs">
                                  {judge.name ? judge.name.charAt(0).toUpperCase() : <Users size={14} />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-gray-200 truncate">{judge.name}</span>
                                  <span className="text-[10px] text-gray-400 truncate">{judge.email}</span>
                                </div>
                              </div>
                            ))}
                            {(!group.judges || group.judges.length === 0) && (
                              <div className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center font-medium">
                                Judges Not Assigned
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Assigned Programs List */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-pink-500" /> Assigned Programs ({programsCount})
                            </h4>
                          </div>
                          <div className="max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            <div className="flex flex-wrap gap-2">
                              {group.assignedPrograms?.map((p: any) => (
                                <div key={p._id} className="flex items-center gap-1.5 bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full shadow-sm hover:bg-pink-500/20 transition-colors cursor-default">
                                  <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                                  <span className="text-xs font-semibold text-pink-200 tracking-wide truncate max-w-[220px]">
                                    {p.name}
                                  </span>
                                </div>
                              ))}
                              {(!group.assignedPrograms || group.assignedPrograms.length === 0) && (
                                <div className="text-xs text-gray-500 italic p-3 bg-white/5 rounded-xl border border-white/5 text-center w-full">
                                  No Programs Assigned
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {judgeGroups.length === 0 && (
            <div className="text-center p-12 bg-[#13111C]/50 rounded-3xl border border-dashed border-gray-800 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-800 group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-900/10">
                    <Users size={28} className="text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No judge panels yet</h3>
                <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">Create your first panel of judges to assign them specific programs for marking.</p>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 inline-flex items-center gap-2"
                >
                    <Plus size={16} className="text-purple-400" />
                    Create First Panel
                </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#13111C]/95 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar shadow-purple-900/20">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-bold mb-8 text-white flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 rounded-xl text-purple-400 border border-purple-500/20">
                    <Users size={24} /> 
                </div>
                Create Judge Group
            </h2>
            
            <form onSubmit={handleCreateJudgeGroup} className="space-y-8">
              
              {/* Group Name */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-400 tracking-wide uppercase">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder-gray-600 font-medium"
                  placeholder="e.g., Quran Memorization Panel A"
                />
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Judges Section */}
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                      <label className="block text-sm font-bold text-gray-400 tracking-wide uppercase">Panel Members</label>
                      <button 
                          type="button" 
                          onClick={handleAddJudgeInput}
                          className="text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors border border-purple-500/20"
                      >
                          <Plus size={14} /> Add Judge
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      {judgesInput.map((judge, idx) => (
                          <div key={idx} className="bg-black/20 p-5 rounded-2xl border border-white/5 relative group hover:border-purple-500/30 transition-colors">
                             {judgesInput.length > 1 && (
                                <button 
                                    type="button"
                                    onClick={() => handleRemoveJudgeInput(idx)}
                                    className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-400 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                                    title="Remove Judge"
                                >
                                    <X size={14} strokeWidth={3} />
                                </button>
                             )}
                             <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5 ml-1">Name</label>
                                    <input
                                        type="text" required
                                        value={judge.name}
                                        onChange={e => handleJudgeInputChange(idx, 'name', e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl p-2.5 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                        placeholder="Judge Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5 ml-1">Email</label>
                                    <input
                                        type="email" required
                                        value={judge.email}
                                        onChange={e => handleJudgeInputChange(idx, 'email', e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl p-2.5 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                        placeholder="judge@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5 ml-1">Password</label>
                                    <input
                                        type="text" required
                                        value={judge.password}
                                        onChange={e => handleJudgeInputChange(idx, 'password', e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl p-2.5 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                        placeholder="secret123"
                                    />
                                </div>
                             </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              {/* Programs Assignment */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <label className="block text-sm font-bold text-gray-400 tracking-wide uppercase">Assign Programs</label>
                    <span className="text-[11px] font-bold bg-white/10 text-gray-300 px-2.5 py-1 rounded-md border border-white/5">
                        {assignedProgramIds.length} <span className="text-gray-500">Selected</span>
                    </span>
                </div>
                {/* Search & Language Filter Pills */}
                <div className="flex flex-col gap-3">
                  <input 
                      type="text"
                      placeholder="Search programs by name..."
                      value={programSearchQ}
                      onChange={e => setProgramSearchQ(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none transition-all placeholder-gray-600"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['', ...judgeCategories].map(lang => (
                      <button
                        key={lang || 'all'}
                        type="button"
                        onClick={() => setLangFilter(lang)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          langFilter === lang
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {lang || 'All'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-2xl p-2 max-h-64 overflow-y-auto custom-scrollbar space-y-1 relative">
                  {programAssignmentStatus.filter((p: any) => (!langFilter || p.language === langFilter) && p.name.toLowerCase().includes(programSearchQ.toLowerCase())).length === 0 ? (
                      <div className="text-sm text-gray-500 italic text-center py-8">No programs available</div>
                  ) : (
                      programAssignmentStatus.filter((p: any) => (!langFilter || p.language === langFilter) && p.name.toLowerCase().includes(programSearchQ.toLowerCase())).map((p: any) => {
                        const isAlreadyAssigned = !!p.assignedToGroupName;
                        return (
                        <label key={p._id} className={`flex items-center gap-4 py-3 px-4 rounded-xl transition-all duration-200 ${isAlreadyAssigned ? 'opacity-50 cursor-not-allowed bg-red-900/5 border border-red-500/10' : 'cursor-pointer hover:bg-white/5 group border border-transparent hover:border-white/5'}`}>
                            <div className="relative flex items-center justify-center shrink-0">
                                <input
                                type="checkbox"
                                disabled={isAlreadyAssigned}
                                checked={assignedProgramIds.includes(p._id)}
                                onChange={e => {
                                    if (e.target.checked) setAssignedProgramIds([...assignedProgramIds, p._id]);
                                    else setAssignedProgramIds(assignedProgramIds.filter(id => id !== p._id));
                                }}
                                className="peer appearance-none w-6 h-6 border-2 border-gray-600 rounded-lg bg-black/50 checked:bg-purple-500 checked:border-purple-500 transition-all disabled:cursor-not-allowed cursor-pointer"
                                />
                                <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-2">
                                    <span className={`truncate ${assignedProgramIds.includes(p._id) ? "text-purple-300 font-bold" : "text-gray-300 font-medium group-hover:text-white transition-colors"}`}>
                                        {p.name}
                                    </span>
                                    {isAlreadyAssigned && (
                                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-md border border-red-500/20 whitespace-nowrap font-bold uppercase tracking-wider shrink-0">
                                            Assigned to: {p.assignedToGroupName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    {p.language && (
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                            Language: <span className="text-gray-400">{p.language}</span>
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                        Group: <span className="text-purple-400">{p.groupId?.name || judgeGroups.find((g: any) => g._id === p.groupId)?.name || 'Unknown'}</span>
                                    </span>
                                </div>
                            </div>
                        </label>
                      )})
                  )}
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-6 mt-8 border-t border-white/10 sticky bottom-0 bg-[#13111C]/95 backdrop-blur-xl pb-2">
                  <button
                    type="submit"
                    className="w-full relative group overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl shadow-lg transition-all transform flex justify-center items-center gap-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-80 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                        <Users size={20} /> Deploy Judge Panel
                    </span>
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Programs Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#13111C]/95 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl w-full max-w-xl shadow-2xl relative max-h-[90vh] flex flex-col shadow-purple-900/20">
            <button 
              onClick={() => {
                  setShowEditModal(false);
                  setEditingGroupId(null);
                  setAssignedProgramIds([]);
              }}
              className="absolute top-6 right-6 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <div className="p-2.5 bg-pink-500/20 rounded-xl text-pink-400 border border-pink-500/20">
                    <Edit3 size={24} /> 
                </div>
                Edit Assigned Programs
            </h2>
            
            <form onSubmit={handleUpdatePrograms} className="flex flex-col flex-1 min-h-0 space-y-6">
               <p className="text-sm text-gray-400 mb-2 leading-relaxed">
                   Update the programs that this Judge Panel is authorized to evaluate. Changes take effect <strong className="text-white">immediately</strong>.
               </p>

              <div className="bg-black/20 border border-white/5 rounded-2xl p-2 overflow-y-auto custom-scrollbar space-y-1 flex-1 relative">
                  {/* Search & Language Filter Pills */}
                  <div className="flex flex-col gap-3 p-2 pb-3 border-b border-white/5 mb-1">
                    <input 
                        type="text"
                        placeholder="Search programs by name..."
                        value={programSearchQ}
                        onChange={e => setProgramSearchQ(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-pink-500 outline-none transition-all placeholder-gray-600"
                    />
                    <div className="flex flex-wrap gap-2">
                      {['', ...judgeCategories].map(lang => (
                        <button
                          key={lang || 'all'}
                          type="button"
                          onClick={() => setLangFilter(lang)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            langFilter === lang
                              ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-900/30'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {lang || 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {programAssignmentStatus.filter((p: any) => (!langFilter || p.language === langFilter) && p.name.toLowerCase().includes(programSearchQ.toLowerCase())).length === 0 ? (
                      <div className="text-sm text-gray-500 italic text-center py-8">No programs available</div>
                  ) : (
                      programAssignmentStatus.filter((p: any) => (!langFilter || p.language === langFilter) && p.name.toLowerCase().includes(programSearchQ.toLowerCase())).map((p: any) => {
                        // In edit mode, we only disable if it's assigned to a DIFFERENT group
                        const editingGroup = judgeGroups.find(g => g._id === editingGroupId);
                        const isAssignedToOtherGroup = p.assignedToGroupName && p.assignedToGroupName !== editingGroup?.name;

                        return (
                        <label key={p._id} className={`flex items-center gap-4 py-3 px-4 rounded-xl transition-all duration-200 ${isAssignedToOtherGroup ? 'opacity-50 cursor-not-allowed bg-red-900/5 border border-red-500/10' : 'cursor-pointer hover:bg-white/5 group border border-transparent hover:border-white/5'}`}>
                            <div className="relative flex items-center justify-center shrink-0">
                                <input
                                type="checkbox"
                                disabled={isAssignedToOtherGroup}
                                checked={assignedProgramIds.includes(p._id)}
                                onChange={e => {
                                    if (e.target.checked) setAssignedProgramIds([...assignedProgramIds, p._id]);
                                    else setAssignedProgramIds(assignedProgramIds.filter(id => id !== p._id));
                                }}
                                className="peer appearance-none w-6 h-6 border-2 border-gray-600 rounded-lg bg-black/50 checked:bg-pink-500 checked:border-pink-500 transition-all disabled:cursor-not-allowed cursor-pointer"
                                />
                                <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-2">
                                    <span className={`truncate ${assignedProgramIds.includes(p._id) ? "text-pink-300 font-bold" : "text-gray-300 font-medium group-hover:text-white transition-colors"}`}>
                                        {p.name}
                                    </span>
                                </div>
                             </div>
                          </label>
                        );
                      })
                  )}
                </div>

              {/* Submit Action */}
              <div className="pt-6 mt-8 border-t border-white/10 sticky bottom-0 bg-[#13111C]/95 backdrop-blur-xl pb-2">
                  <button
                    type="submit"
                    className="w-full relative group overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl shadow-lg transition-all transform flex justify-center items-center gap-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-80 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                        <Users size={20} /> Deploy Judge Panel
                    </span>
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Programs Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#13111C]/95 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl w-full max-w-xl shadow-2xl relative max-h-[90vh] flex flex-col shadow-purple-900/20">
            <button 
              onClick={() => {
                  setShowEditModal(false);
                  setEditingGroupId(null);
                  setAssignedProgramIds([]);
              }}
              className="absolute top-6 right-6 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <div className="p-2.5 bg-pink-500/20 rounded-xl text-pink-400 border border-pink-500/20">
                    <Edit3 size={24} /> 
                </div>
                Edit Assigned Programs
            </h2>
            
            <form onSubmit={handleUpdatePrograms} className="flex flex-col flex-1 min-h-0 space-y-6">
               <p className="text-sm text-gray-400 mb-2 leading-relaxed">
                   Update the programs that this Judge Panel is authorized to evaluate. Changes take effect <strong className="text-white">immediately</strong>.
               </p>

              <div className="bg-black/20 border border-white/5 rounded-2xl p-2 overflow-y-auto custom-scrollbar space-y-1 flex-1 relative">
                  {/* Search & Language Filter Pills */}
                  <div className="flex flex-col gap-3 p-2 pb-3 border-b border-white/5 mb-1">
                    <input 
                        type="text"
                        placeholder="Search programs by name..."
                        value={programSearchQ}
                        onChange={e => setProgramSearchQ(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-pink-500 outline-none transition-all placeholder-gray-600"
                    />
                    <div className="flex flex-wrap gap-2">
                      {['', ...judgeCategories].map(lang => (
                        <button
                          key={lang || 'all'}
                          type="button"
                          onClick={() => setLangFilter(lang)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            langFilter === lang
                              ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-900/30'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {lang || 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {programAssignmentStatus.filter((p: any) => (!langFilter || p.language === langFilter) && p.name.toLowerCase().includes(programSearchQ.toLowerCase())).length === 0 ? (
                      <div className="text-sm text-gray-500 italic text-center py-8">No programs available</div>
                  ) : (
                      programAssignmentStatus.filter((p: any) => (!langFilter || p.language === langFilter) && p.name.toLowerCase().includes(programSearchQ.toLowerCase())).map((p: any) => {
                        // In edit mode, we only disable if it's assigned to a DIFFERENT group
                        const editingGroup = judgeGroups.find(g => g._id === editingGroupId);
                        const isAssignedToOtherGroup = p.assignedToGroupName && p.assignedToGroupName !== editingGroup?.name;

                        return (
                        <label key={p._id} className={`flex items-center gap-4 py-3 px-4 rounded-xl transition-all duration-200 ${isAssignedToOtherGroup ? 'opacity-50 cursor-not-allowed bg-red-900/5 border border-red-500/10' : 'cursor-pointer hover:bg-white/5 group border border-transparent hover:border-white/5'}`}>
                            <div className="relative flex items-center justify-center shrink-0">
                                <input
                                type="checkbox"
                                disabled={isAssignedToOtherGroup}
                                checked={assignedProgramIds.includes(p._id)}
                                onChange={e => {
                                    if (e.target.checked) setAssignedProgramIds([...assignedProgramIds, p._id]);
                                    else setAssignedProgramIds(assignedProgramIds.filter(id => id !== p._id));
                                }}
                                className="peer appearance-none w-6 h-6 border-2 border-gray-600 rounded-lg bg-black/50 checked:bg-pink-500 checked:border-pink-500 transition-all disabled:cursor-not-allowed cursor-pointer"
                                />
                                <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-2">
                                    <span className={`truncate ${assignedProgramIds.includes(p._id) ? "text-pink-300 font-bold" : "text-gray-300 font-medium group-hover:text-white transition-colors"}`}>
                                        {p.name}
                                    </span>
                                    {isAssignedToOtherGroup && (
                                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-md border border-red-500/20 whitespace-nowrap font-bold uppercase tracking-wider shrink-0">
                                            Assigned to: {p.assignedToGroupName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    {p.language && (
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                            Language: <span className="text-gray-400">{p.language}</span>
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                        Group: <span className="text-purple-400">{p.groupId?.name || judgeGroups.find((g: any) => g._id === p.groupId)?.name || 'Unknown'}</span>
                                    </span>
                                </div>
                            </div>
                        </label>
                      )})
                  )}
              </div>

              <div className="pt-6 border-t border-white/10 mt-auto bg-[#13111C]/95 backdrop-blur-xl">
                  <button
                    type="submit"
                    className="w-full relative group overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl shadow-lg transition-all transform flex justify-center items-center gap-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                        Save Changes
                    </span>
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Judge Group"
        message="Are you sure you want to delete this judge group? All associated judges and their access will be removed."
        confirmText="Delete"
        onConfirm={confirmDeleteJudgeGroup}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

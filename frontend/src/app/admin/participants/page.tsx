'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import { Trash2, Plus, X, User, Users, Flag, Save, Layers, Grid, FileText, Globe, Image, Upload, Search, ChevronDown, List } from 'lucide-react';
import { useGroups, useTeams, usePrograms, useParticipants, useInvalidate } from '@/lib/queries';

// Memoized Row Component to prevent full table re-renders on hover
const ParticipantRow = React.memo(({ p, index, displayIndex, hoveredParticipant, setHoveredParticipant, setViewParticipant, setSelectedParticipantForProgram, setShowAddProgramModal, handleDelete }: any) => {
    return (
        <tr 
            className="hover:bg-[#252236] transition-colors group cursor-pointer"
            onMouseEnter={() => setHoveredParticipant(p._id)}
            onMouseLeave={() => setHoveredParticipant(null)}
            onClick={() => setViewParticipant(p)}
        >
            <td className="p-4 text-gray-600">{displayIndex}</td>
            <td className="p-4 font-mono text-purple-300 font-bold">{p.chestNumber}</td>
            <td className="p-4">
            <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white border-2 border-white/10">
                        {p.name.charAt(0)}
                    </div>
                    <img 
                        src={`${API_BASE_URL}/participants/${p._id}/photo`} 
                        alt={p.name} 
                        loading="lazy"
                        className="absolute inset-0 w-full h-full rounded-full object-cover border-2 border-purple-500/30"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>
                <span className="font-semibold text-gray-200">{p.name}</span>

            </div>
            </td>
            <td className="p-4">
            <div className="flex flex-col text-sm">
                <span className="text-gray-300 font-medium">{p.teamId?.name || 'No Team'}</span>
                <span className="text-gray-500 text-xs">{p.groupId?.name || 'No Group'}</span>
            </div>
            </td>
            <td className="p-4">
            <div className="flex flex-wrap gap-1">
                {p.programs?.length > 0 ? (
                    p.programs.slice(0, 2).map((prog: any) => (
                        <span key={prog._id || prog} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                            {prog.name || 'Program'}
                        </span>
                    ))
                ) : (
                    <span className="text-xs text-gray-600 italic">None</span>
                )}
                {p.programs?.length > 2 && (
                        <span className="text-xs bg-gray-800 text-gray-500 px-2 py-1 rounded border border-gray-700">+{p.programs.length - 2}</span>
                )}
            </div>
            </td>
            <td className="p-4 relative">
            <button 
                onClick={(e) => {
                e.stopPropagation();
                handleDelete(p._id);
                }}
                className="text-gray-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Delete"
            >
                <Trash2 size={18} />
            </button>
            </td>
        </tr>
    );
});
ParticipantRow.displayName = 'ParticipantRow';

// Modern Custom Select Component
const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, disabled = false, className = '' }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((o: any) => String(o.value) === String(value));

    return (
        <div 
            className={`relative group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`} 
            ref={wrapperRef}
        >
            {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-purple-400 transition-colors z-10 pointer-events-none" size={18} />}
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full p-3.5 ${Icon ? 'pl-11' : 'pl-4'} pr-10 rounded-xl bg-[#0F0D15] border border-gray-700/50 hover:border-gray-600 focus:border-purple-500 cursor-pointer transition-all flex items-center min-h-[50px] shadow-inner font-medium`}
            >
                <span title={selectedOption ? selectedOption.label : placeholder} className={`block truncate flex-1 min-w-0 ${selectedOption ? "text-gray-200" : "text-gray-500"}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-purple-400 transition-colors z-10">
                <ChevronDown size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-purple-400' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-[#1A1825] border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/30 max-h-64 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col py-2">
                    <div 
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        className="px-4 py-3 text-gray-500 hover:bg-white/5 cursor-pointer italic text-sm border-b border-white/5 transition-colors"
                    >
                        {placeholder}
                    </div>
                    {options.length === 0 ? (
                        <div className="px-4 py-8 text-gray-500 italic text-sm text-center flex flex-col items-center gap-2">
                            <Grid size={24} className="opacity-20" />
                            No options available
                        </div>
                    ) : (
                        options.map((opt: any) => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`px-4 py-3 cursor-pointer transition-all text-sm flex items-center gap-2 ${
                                    String(value) === String(opt.value) 
                                        ? 'bg-purple-500/10 text-purple-300 font-bold border-l-[3px] border-purple-500' 
                                        : 'text-gray-300 border-l-[3px] border-transparent hover:bg-white/5 hover:text-white hover:border-gray-500'
                                }`}
                            >
                                <span title={opt.label} className="truncate flex-1 min-w-0">{opt.label}</span>
                                {String(value) === String(opt.value) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default function ParticipantsPage() {
  const { data: groups = [] as any[] } = useGroups();
  const { data: teams = [] as any[] } = useTeams();
  const { data: programs = [] as any[] } = usePrograms();
  const { data: participants = [] as any[] } = useParticipants();
  const { invalidateParticipants } = useInvalidate();
  const [form, setForm] = useState<{
    name: string;
    chestNumber: string;
    teamId: string;
    groupId: string;
    selectedPrograms: string[];
    language: string;
    programId: string;
    image: string;
  }>({ name: '', chestNumber: '', teamId: '', groupId: '', selectedPrograms: [], language: '', programId: '', image: '' });
  
  const [search, setSearch] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewParticipant, setViewParticipant] = useState<any>(null);
  const [showAddProgramModal, setShowAddProgramModal] = useState(false);
  const [selectedParticipantForProgram, setSelectedParticipantForProgram] = useState<any>(null);
  const [programForm, setProgramForm] = useState<{
    language: string; 
    programId: string;
    selectedPrograms: string[];
  }>({ language: '', programId: '', selectedPrograms: [] });

  // Derive unique languages from programs
  const languages = useMemo(() => Array.from(new Set(programs.map(p => p.language))), [programs]);
  
  // Filter programs based on selected language & chosen group in main form
  const filteredProgramsMain = useMemo(() => {
    console.log('--- FILTERING PROGRAMS ---');
    console.log('Participant form state:');
    console.log('- form.language:', form.language);
    console.log('- form.groupId:', form.groupId);
    console.log('- form.groupId type:', typeof form.groupId);
    console.log('- programs.length:', programs.length);
    
    programs.forEach(p => {
        if(p.name === 'DEBUG_PROGRAM_002') {
            console.log('--- DEBUG_PROGRAM_002 RUNTIME VALUES ---');
            console.log('Program state:');
            console.log('- name:', p.name);
            console.log('- language:', p.language);
            console.log('- groupId:', p.groupId);
            console.log('- groupId type:', typeof p.groupId);
            console.log('- populated groupId._id if present:', p.groupId?._id);
            console.log('--- EXACT FILTER LOGIC TRACE ---');
            console.log('- p.language:', p.language);
            console.log('- form.language:', form.language);
            console.log('- p.groupId:', p.groupId);
            console.log('- p.groupId._id:', p.groupId?._id);
            console.log('- form.groupId:', form.groupId);
            console.log('- String(p.groupId?._id):', String(p.groupId?._id));
            console.log('- String(form.groupId):', String(form.groupId));
            console.log('Condition 1 (p.language === form.language):', p.language === form.language);
            console.log('Condition 2 (p.groupId?._id === form.groupId):', p.groupId?._id === form.groupId);
            console.log('Condition 3 (p.groupId === form.groupId):', p.groupId === form.groupId);
            console.log('Overall Match:', p.language === form.language && (p.groupId?._id === form.groupId || p.groupId === form.groupId));
        }
    });

    if (!form.language || !form.groupId) return [];
    
    const afterLanguage = programs.filter(p => p.language === form.language);
    console.log('-> after language filter:', afterLanguage.length);
    const afterGroup = afterLanguage.filter(p => (p.groupId?._id === form.groupId || p.groupId === form.groupId));
    console.log('-> after group filter:', afterGroup.length);
    return afterGroup;
  }, [programs, form.language, form.groupId]);

  // Filter programs based on selected language & participant's group in modal
  const filteredProgramsModal = useMemo(() => {
    const targetParticipant = viewParticipant || selectedParticipantForProgram;
    if (!programForm.language || !targetParticipant) return [];
    const pGroupId = targetParticipant.groupId?._id || targetParticipant.groupId;
    return programs.filter(p => 
      p.language === programForm.language && 
      (p.groupId?._id === pGroupId || p.groupId === pGroupId)
    );
  }, [programs, programForm.language, viewParticipant, selectedParticipantForProgram]);

  const [partnerSearchQ, setPartnerSearchQ] = useState('');
  const [partnerResults, setPartnerResults] = useState<any[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<any[]>([]);
  const [officialChestId, setOfficialChestId] = useState<string>('');
  const [isSearchingPartner, setIsSearchingPartner] = useState(false);

  // Determine if the selected program in the modal is a conversation program
  const selectedModalProgramOb = useMemo(() => {
    return programs.find(p => p._id === programForm.programId);
  }, [programForm.programId, programs]);

  const [partnerSearchError, setPartnerSearchError] = useState<string>('');

  useEffect(() => {
    if (!selectedModalProgramOb?.isConversation || !viewParticipant?._id) {
        setPartnerResults([]);
        setPartnerSearchError('');
        return;
    }
    
    // Clear error on new search attempt
    setPartnerSearchError('');

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingPartner(true);
      try {
        const safeQuery = encodeURIComponent(partnerSearchQ.trim());
        const data = await apiRequest(`/participants/search-eligible?q=${safeQuery}&primaryId=${viewParticipant._id}`);
        // Filter out already selected partners
        const filtered = data.filter((p: any) => !selectedPartners.some(sp => sp._id === p._id));
        setPartnerResults(filtered);
      } catch (e: any) {
        console.error(e);
        setPartnerResults([]);
        
        // Map backend 400 message to existing UI error message
        if (e.message && e.message.includes("Primary participant must have a Team and Group assigned")) {
            setPartnerSearchError("Please save the participant's Team and Group changes before assigning a Pair/Group program.");
        } else {
            setPartnerSearchError(e.message || "Unable to load eligible participants. Please try again.");
        }
      } finally {
        setIsSearchingPartner(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [partnerSearchQ, selectedModalProgramOb, viewParticipant, selectedPartners]);

  const [isAddingProgramMode, setIsAddingProgramMode] = useState(false);

  // Reset add mode when opening new participant
  useEffect(() => {
    if (viewParticipant?._id) {
       setIsAddingProgramMode(false);
    }
  }, [viewParticipant?._id]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit
        alert("Image size must be less than 500KB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalPrograms = [...form.selectedPrograms];
      if (form.programId && !finalPrograms.includes(form.programId)) {
          finalPrograms.push(form.programId);
      }

      await apiRequest('/participants', 'POST', {
        name: form.name,
        chestNumber: form.chestNumber,
        teamId: form.teamId,
        groupId: form.groupId,
        programs: finalPrograms,
        image: form.image
      });
      invalidateParticipants();
      // Keep teamId and groupId for faster entry, reset others
      setForm(prev => ({ ...prev, name: '', chestNumber: '', selectedPrograms: [], programId: '', language: '', image: '' }));
      alert('Participant added!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = React.useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this participant?')) return;
    try {
      await apiRequest(`/participants/${id}`, 'DELETE');
      invalidateParticipants();
    } catch (e: any) { alert(e.message); }
  }, [invalidateParticipants]);

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 60;

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterGroupId, filterTeamId]);

  // Memoized filtered participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.chestNumber.toLowerCase().includes(search.toLowerCase());
      const matchGroup = filterGroupId === '' || p.groupId?._id === filterGroupId || p.groupId === filterGroupId;
      const matchTeam = filterTeamId === '' || p.teamId?._id === filterTeamId || p.teamId === filterTeamId;
      return matchSearch && matchGroup && matchTeam;
    });
  }, [participants, search, filterGroupId, filterTeamId]);

  // Slice for current page
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">Participants</h2>
           <p className="text-gray-500 text-sm mt-0.5">Register new artists, manage teams, and assign programs.</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all text-sm"
        >
          {showCreateForm ? <X size={18} /> : <Plus size={18} />}
          {showCreateForm ? 'Close Form' : 'Add Participant'}
        </button>
      </div>

      {/* Main Form Card */}
      {showCreateForm && (
      <div className="bg-[#1E1B2E] rounded-3xl border border-[#2D283E] p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
          
          {/* Identity Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-purple-300">
               <User className="text-purple-500" size={24} /> Identity
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden bg-[#0F0D15] relative group">
                        {form.image ? (
                            <img src={form.image} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="text-gray-600" size={40} />
                        )}
                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Upload className="text-white" size={24} />
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                    </div>
                    <p className="text-xs text-gray-500">Max 500KB</p>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 content-center">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">Artist/Participant Name</label>
                        <input 
                            placeholder="Enter full name" 
                            value={form.name} 
                            onChange={e => setForm({...form, name: e.target.value})}
                            className="w-full p-4 rounded-xl bg-[#13111C] border border-gray-700/50 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">Chest Number</label>
                        <input 
                            placeholder="E.g. CH-101" 
                            value={form.chestNumber} 
                            onChange={e => setForm({...form, chestNumber: e.target.value})}
                            className="w-full p-4 rounded-xl bg-[#13111C] border border-gray-700/50 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600"
                            required
                        />
                    </div>
                </div>
            </div>
          </div>

          <div className="h-px bg-gray-800/50 w-full" />

          {/* Affiliation Section (Narrative replacement) */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-purple-300">
               <Users className="text-purple-500" size={24} /> Affiliation & Grouping
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Select Team</label>
                  <CustomSelect 
                      value={form.teamId}
                      onChange={(val: string) => setForm({...form, teamId: val})}
                      options={teams.map(t => ({ value: t._id, label: t.name }))}
                      placeholder="Select a Team..."
                      icon={Flag}
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Assign Group</label>
                  <CustomSelect 
                      value={form.groupId}
                      onChange={(val: string) => setForm({...form, groupId: val})}
                      options={groups.map(g => ({ value: g._id, label: g.name }))}
                      placeholder="Select a Group..."
                      icon={Layers}
                  />
               </div>
            </div>
          </div>

          <div className="h-px bg-gray-800/50 w-full" />

          {/* Media & Portfolio Section (Programs) */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-purple-300">
               <Image className="text-purple-500" size={24} /> Participation & Programs
            </h3>
            <p className="text-sm text-gray-500 -mt-4 mb-4">Select programs this participant will compete in.</p>
            
            <div className="p-8 border-2 border-dashed border-gray-700/50 rounded-2xl bg-[#13111C]/50 flex flex-col gap-6">
                
                {/* Program Selectors */}
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Filter Language</label>
                        <CustomSelect 
                            value={form.language}
                            onChange={(val: string) => setForm({...form, language: val, programId: ''})}
                            options={languages.map(l => ({ value: l, label: l }))}
                            placeholder="All Languages"
                            icon={Globe}
                        />
                    </div>
                    <div className="flex-[2] w-full space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Select Program</label>
                        <CustomSelect 
                            value={form.programId}
                            onChange={(val: string) => setForm({...form, programId: val})}
                            options={filteredProgramsMain.map((p: any) => ({ value: p._id, label: p.name }))}
                            placeholder="Choose a program..."
                            icon={List}
                            disabled={!form.language}
                        />
                    </div>
                    <button 
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           if (form.programId && !form.selectedPrograms.includes(form.programId)) {
                             setForm(prev => ({
                               ...prev,
                               selectedPrograms: [...prev.selectedPrograms, prev.programId],
                               programId: ''
                             }));
                           }
                         }}
                         disabled={!form.programId}
                         className="h-[50px] px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Plus size={18} /> Add
                    </button>
                </div>

                {/* Chips Display */}
                {form.selectedPrograms.length > 0 ? (
                    <div className="flex flex-wrap gap-3 mt-2">
                        {form.selectedPrograms.map(progId => {
                            const prog = programs.find(p => p._id === progId);
                            return (
                                <div key={progId} className="flex items-center gap-2 bg-purple-900/30 text-purple-200 border border-purple-500/30 px-4 py-2 rounded-lg text-sm group hover:border-purple-400 transition-colors">
                                    <span className="font-medium">{prog?.name || 'Unknown Program'}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setForm(prev => ({ ...prev, selectedPrograms: prev.selectedPrograms.filter(id => id !== progId) }))}
                                        className="text-purple-400 hover:text-white transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-600 flex flex-col items-center gap-2">
                        <Grid size={40} className="opacity-20" />
                        <p>No programs added yet.</p>
                    </div>
                )}

            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-6 border-t border-gray-800 flex justify-end gap-4">
             <button 
                type="button"
                onClick={() => {
                    setForm({ name: '', chestNumber: '', teamId: '', groupId: '', selectedPrograms: [], language: '', programId: '', image: '' });
                    setShowCreateForm(false);
                }}
                className="px-6 py-3 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition-colors"
             >
                Cancel
             </button>
             <button 
                type="submit" 
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all transform active:scale-95"
             >
                 <Save size={18} /> Save Participant
             </button>
          </div>

        </form>
      </div>
      )}

      {/* List Section Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-4">
         <h2 className="text-xl font-bold text-white whitespace-nowrap">All Participants <span className="text-gray-600 text-sm font-normal">({filteredParticipants.length})</span></h2>
         <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
             <CustomSelect 
                 value={filterGroupId}
                 onChange={(val: string) => setFilterGroupId(val)}
                 options={groups.map(g => ({ value: g._id, label: g.name }))}
                 placeholder="All Groups"
                 className="w-full md:w-48 text-sm"
                 icon={Users}
             />
             <CustomSelect 
                 value={filterTeamId}
                 onChange={(val: string) => setFilterTeamId(val)}
                 options={teams.map(t => ({ value: t._id, label: t.name }))}
                 placeholder="All Teams"
                 className="w-full md:w-48 text-sm"
                 icon={Flag}
             />
             <div className="relative w-full md:w-64">
                 <input 
                    placeholder="Search participants..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 h-[50px] rounded-xl bg-[#0F1120] border border-white/[0.07] text-white focus:outline-none focus:border-purple-500 w-full transition-all text-sm shadow-inner"
                 />
                 <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 </div>
             </div>
         </div>
      </div>

      {/* Participant List (Table) */}
      {/* Participant List (Table & Mobile Cards) */}
      {filteredParticipants.length === 0 ? (
            <div className="col-span-full text-center p-16 bg-[#0F1120]/50 rounded-3xl border border-dashed border-white/[0.07] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/[0.07] group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-900/10">
                    <Users size={32} className="text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No participants found</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Try adding a new participant, or check your search term if you're filtering.</p>
            </div>
      ) : (
       <div className="bg-[#0F1120] rounded-2xl border border-white/[0.07] overflow-hidden shadow-xl">
        
        {/* Desktop - Exact card-row style from reference photo */}
        <div className="hidden md:block p-4 space-y-2">
          {paginatedParticipants.map((p, index) => {
            const absoluteIndex = (currentPage - 1) * itemsPerPage + index;
            const displayIndex = filteredParticipants.length - absoluteIndex; 
            return (
              <div
                key={p._id}
                className="flex items-center gap-4 px-5 py-4 bg-[#131629] border border-white/[0.07] rounded-xl cursor-pointer hover:border-purple-500/30 hover:bg-[#161830] transition-all duration-200 group"
                onMouseEnter={() => setHoveredParticipant(p._id)}
                onMouseLeave={() => setHoveredParticipant(null)}
                onClick={() => setViewParticipant(p)}
              >
                {/* Chest Number Badge */}
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#0F1120] border border-white/[0.1] text-purple-300 font-mono text-sm font-bold min-w-[80px] text-center">
                    {p.chestNumber}
                  </div>
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
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
                  <span className="font-semibold text-gray-100 group-hover:text-white transition-colors text-base truncate">
                    {p.name}
                  </span>
                </div>

                {/* Group Badge */}
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                    p.groupId?.name === 'Senior' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    p.groupId?.name === 'Junior' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    p.groupId?.name ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-white/[0.06] text-gray-500 border-white/[0.08]'
                  }`}>
                    {p.groupId?.name || 'No Group'}
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

                {/* Delete / 3-dot menu */}
                <div className="flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p._id); }}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {filteredParticipants.length === 0 && (
            <div className="py-8 text-center text-gray-600">No participants found.</div>
          )}
        </div>

        {/* Mobile Card Grid View */}
        <div className="md:hidden flex flex-col gap-3 p-1 bg-[#0F0D15]">
            {paginatedParticipants.map((p) => (
                <div key={p._id} className="bg-[#1E1B2E] rounded-xl p-3 border border-[#2D283E] flex items-center justify-between shadow-lg relative overflow-hidden">
                    {/* Content */}
                    <div className="flex flex-col gap-1 z-10 relative max-w-[60%]">
                        <span className="text-purple-400 text-xs font-bold tracking-wider uppercase mb-1">
                            {p.teamId?.name || 'No Team'}
                        </span>
                        <h3 className="text-white font-bold text-lg leading-tight truncate">{p.name}</h3>
                        <p className="text-gray-400 text-sm">Chest #{p.chestNumber}</p>
                        
                        <button 
                            onClick={() => setViewParticipant(p)}
                            className="mt-3 bg-[#2D283E] hover:bg-purple-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 w-max"
                        >
                            View Profile <Users size={12} />
                        </button>
                    </div>

                    {/* Image */}
                    <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-[#2D283E] bg-gray-800 shrink-0 z-10">
                         <img 
                            src={`${API_BASE_URL}/participants/${p._id}/photo`} 
                            alt={p.name} 
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>

                    {/* Background Decorative Gradient */}
                    <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                </div>
            ))}
             {filteredParticipants.length === 0 && (
                <div className="text-center py-10 text-gray-500">No participants found.</div>
            )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-white/[0.04] flex justify-between items-center">
                <span className="text-gray-600 text-sm">
                  Showing <span className="text-gray-400">{(currentPage-1)*itemsPerPage+1}</span> to <span className="text-gray-400">{Math.min(currentPage*itemsPerPage, filteredParticipants.length)}</span> of {filteredParticipants.length} entries
                </span>
                <div className="flex items-center gap-2">
                  <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.1] transition"
                  >
                      ‹
                  </button>
                  {Array.from({length: Math.min(totalPages, 5)}, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                        currentPage === page 
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40' 
                          : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
                      }`}
                    >{page}</button>
                  ))}
                  {totalPages > 5 && <span className="text-gray-600">...</span>}
                  <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.1] transition"
                  >
                      ›
                  </button>
                </div>
            </div>
        )}
      </div>
      )}

     {/* Add Program Modal (kept mostly functional/same but styled) */}
    {showAddProgramModal && selectedParticipantForProgram && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#1E1B2E] p-8 rounded-3xl border border-[#2D283E] w-full max-w-3xl relative shadow-2xl">
                <button 
                    onClick={() => { setShowAddProgramModal(false); setProgramForm({ language: '', programId: '', selectedPrograms: [] }); }}
                    className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
                <h3 className="text-2xl font-bold mb-2 text-white">Manage Programs</h3>
                <p className="text-gray-400 mb-8 border-b border-gray-800 pb-4">Adding programs for <span className="text-purple-400 font-bold">{selectedParticipantForProgram.name}</span></p>
                
                <div className="space-y-6">
                    {/* Selectors organized horizontally */}
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filter Language</label>
                            <CustomSelect 
                                value={programForm.language}
                                onChange={(val: string) => setProgramForm(prev => ({ ...prev, language: val, programId: '' }))}
                                options={languages.map(l => ({ value: l, label: l }))}
                                placeholder="Select Language"
                                icon={Globe}
                            />
                        </div>
                        
                        <div className="flex-[2] w-full space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Select Program</label>
                            <CustomSelect 
                                value={programForm.programId}
                                onChange={(val: string) => setProgramForm(prev => ({ ...prev, programId: val }))}
                                options={filteredProgramsModal.map((p: any) => ({ value: p._id, label: p.name }))}
                                placeholder="Select Program"
                                icon={List}
                                disabled={!programForm.language}
                            />
                        </div>

                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                if (programForm.programId && !programForm.selectedPrograms.includes(programForm.programId)) {
                                    setProgramForm(prev => ({
                                        ...prev,
                                        selectedPrograms: [...prev.selectedPrograms, prev.programId],
                                        programId: ''
                                    }));
                                }
                            }}
                            disabled={!programForm.programId}
                            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold h-[56px] w-[56px] shrink-0 flex items-center justify-center shadow-lg hover:shadow-purple-900/30 transition-all duration-300"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    {/* Selected Programs Chips in Modal */}
                    {programForm.selectedPrograms.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-[#13111C] rounded-xl border border-dashed border-gray-700/50 max-h-40 overflow-y-auto">
                        {programForm.selectedPrograms.map(progId => {
                            const prog = programs.find(p => p._id === progId);
                            return (
                            <div key={progId} className="flex items-center gap-2 bg-purple-500/10 text-purple-200 border border-purple-500/20 px-3 py-1.5 rounded-lg text-sm">
                                {prog?.name || 'Unknown Program'}
                                <button 
                                type="button" 
                                onClick={() => setProgramForm(prev => ({ ...prev, selectedPrograms: prev.selectedPrograms.filter(id => id !== progId) }))}
                                className="hover:text-white"
                                >
                                <X size={14} />
                                </button>
                            </div>
                            );
                        })}
                        </div>
                    )}

                    <button 
                        onClick={async () => {
                            if(programForm.selectedPrograms.length === 0 && !programForm.programId) return alert("Select at least one program");
                            
                            // Add currently selected program if not in list
                            const finalProgramsToAdd = [...programForm.selectedPrograms];
                            if (programForm.programId && !finalProgramsToAdd.includes(programForm.programId)) {
                                finalProgramsToAdd.push(programForm.programId);
                            }

                            try {
                                const newPrograms = selectedParticipantForProgram.programs 
                                    ? [...selectedParticipantForProgram.programs.map((p:any) => p._id || p), ...finalProgramsToAdd] 
                                    : [...finalProgramsToAdd];

                                // Removing duplicates just in case
                                const uniquePrograms = Array.from(new Set(newPrograms));

                                await apiRequest(`/participants/${selectedParticipantForProgram._id}`, 'PUT', {
                                    ...selectedParticipantForProgram,
                                    programs: uniquePrograms,
                                    teamId: selectedParticipantForProgram.teamId?._id, // Ensure we send IDs not objects
                                    groupId: selectedParticipantForProgram.groupId?._id 
                                });
                                
                                alert("Programs added!");
                                setShowAddProgramModal(false);
                                setProgramForm({ language: '', programId: '', selectedPrograms: [] });
                                invalidateParticipants();
                            } catch(e:any) {
                                alert(e.message);
                            }
                        }}
                        className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold shadow-xl shadow-green-900/20 text-lg mt-4"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    )}
      {/* View Participant Modal */}
      {viewParticipant && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setViewParticipant(null)}>
            <div 
                className={`bg-[#1E1B2E] p-0 rounded-[40px] border border-[#2D283E] w-full ${isAddingProgramMode ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col relative shadow-2xl overflow-hidden transition-all duration-300 ease-in-out`}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header with Gradient */}
                <div className={`bg-gradient-to-r from-purple-900/50 to-indigo-900/50 relative transition-all duration-300 ${isAddingProgramMode ? 'p-4' : 'p-8'}`}>
                   <button 
                        onClick={() => setViewParticipant(null)}
                        className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                    
                    <div className={`flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left transition-all duration-300 ${isAddingProgramMode ? 'gap-4' : 'gap-6'}`}>
                        {/* Avatar */}
                        <div className={`rounded-full border-4 border-[#1E1B2E] shadow-xl overflow-hidden bg-gray-800 flex-shrink-0 relative transition-all duration-300 ${isAddingProgramMode ? 'w-16 h-16 border-2' : 'w-32 h-32 border-4'}`}>
                             {/* We use specific timestamp to bust cache if needed, or just ID */}
                             <img 
                                key={viewParticipant._id}
                                src={`${API_BASE_URL}/participants/${viewParticipant._id}/photo`} 
                                alt={viewParticipant.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement?.classList.add('fallback-visible');
                                }}
                                onLoad={(e) => {
                                    e.currentTarget.style.display = 'block';
                                }}
                             />
                             {/* Fallback Initial - hidden by default unless image fails or is hidden */}
                             <div className={`absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white -z-10 ${isAddingProgramMode ? 'text-xl' : 'text-4xl'}`}>
                                {viewParticipant.name.charAt(0)}
                             </div>
                        </div>
                        
                        <div className={`space-y-2 mt-2 transition-all duration-300 ${isAddingProgramMode ? 'mt-0 space-y-1' : 'mt-2 space-y-2'}`}>
                             {!isAddingProgramMode && (
                                <div className="inline-block px-3 py-1 rounded-full bg-black/30 border border-white/10 text-xs font-mono text-purple-300 mb-1">
                                    {viewParticipant.chestNumber}
                                </div>
                             )}
                             <h3 className={`font-extrabold text-white transition-all duration-300 ${isAddingProgramMode ? 'text-xl' : 'text-3xl'}`}>
                                {viewParticipant.name}
                                {isAddingProgramMode && <span className="ml-2 text-sm font-normal text-purple-300 font-mono">({viewParticipant.chestNumber})</span>}
                             </h3>
                             <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-gray-300">
                                <span className="flex items-center gap-1.5"><Flag size={14} className="text-purple-400" /> {viewParticipant.teamId?.name || 'No Team'}</span>
                                <span className="flex items-center gap-1.5"><Layers size={14} className="text-indigo-400" /> {viewParticipant.groupId?.name || 'No Group'}</span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Modal Body */}
                <div className={`${isAddingProgramMode ? 'p-4' : 'p-8'} space-y-6 overflow-y-auto custom-scrollbar`}>
                    {isAddingProgramMode ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Plus size={16} className="text-purple-400" /> Add New Programs
                            </h4>
                            
                            <div className="space-y-4 bg-[#13111C] p-4 rounded-2xl border border-[#2D283E]">
                                {/* Selectors organized horizontally */}
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full space-y-2">
                                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filter Language</label>
                                        <CustomSelect 
                                            value={programForm.language}
                                            onChange={(val: string) => setProgramForm(prev => ({ ...prev, language: val, programId: '' }))}
                                            options={languages.map(l => ({ value: l, label: l }))}
                                            placeholder="Select Language"
                                            icon={Globe}
                                        />
                                    </div>
                                    
                                    <div className="flex-[2] w-full space-y-2">
                                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Select Program</label>
                                        <CustomSelect 
                                            value={programForm.programId}
                                            onChange={(val: string) => {
                                                setProgramForm(prev => ({ ...prev, programId: val }));
                                                setPartnerSearchQ('');
                                                setSelectedPartners([]);
                                                setPartnerResults([]);
                                                setOfficialChestId('');
                                            }}
                                            options={filteredProgramsModal.map((p: any) => ({ value: p._id, label: p.name }))}
                                            placeholder="Select Program"
                                            icon={List}
                                            disabled={!programForm.language}
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (programForm.programId && !programForm.selectedPrograms.includes(programForm.programId)) {
                                                setProgramForm(prev => ({
                                                    ...prev,
                                                    selectedPrograms: [...prev.selectedPrograms, prev.programId],
                                                    programId: ''
                                                }));
                                            }
                                        }}
                                        disabled={!programForm.programId}
                                        className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold h-[56px] w-[56px] flex items-center justify-center shrink-0 shadow-lg hover:shadow-purple-900/30 transition-all duration-300"
                                    >
                                        <Plus size={24} />
                                    </button>
                                </div>

                                {/* Selected Programs Chips */}
                                {programForm.selectedPrograms.length > 0 && (
                                    <div className="flex flex-wrap gap-2 p-3 bg-[#1E1B2E] rounded-xl border border-dashed border-gray-700/50 max-h-40 overflow-y-auto">
                                    {programForm.selectedPrograms.map(progId => {
                                        const prog = programs.find(p => p._id === progId);
                                        return (
                                        <div key={progId} className="flex items-center gap-2 bg-purple-500/10 text-purple-200 border border-purple-500/20 px-3 py-1.5 rounded-lg text-sm">
                                            {prog?.name || 'Unknown Program'}
                                            <button 
                                            type="button" 
                                            onClick={() => setProgramForm(prev => ({ ...prev, selectedPrograms: prev.selectedPrograms.filter(id => id !== progId) }))}
                                            className="hover:text-white"
                                            >
                                            <X size={14} />
                                            </button>
                                        </div>
                                        );
                                    })}
                                    </div>
                                )}
                                
                                {selectedModalProgramOb?.isConversation && (
                                    <div className="bg-indigo-900/10 border border-indigo-500/30 p-4 rounded-xl mt-4 animate-in fade-in zoom-in-95 duration-300">
                                        <h5 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                            <Users size={16} /> Partner Required
                                        </h5>
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                            <input 
                                                type="text"
                                                placeholder="Search same-team partner by name or chest no..."
                                                value={partnerSearchQ}
                                                onChange={e => {
                                                    setPartnerSearchQ(e.target.value);
                                                }}
                                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:border-indigo-500 focus:outline-none placeholder-gray-600"
                                            />
                                            {isSearchingPartner && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                                        </div>

                                        {partnerSearchError && (
                                            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                                                <X size={16} className="mt-0.5 shrink-0" />
                                                <span>{partnerSearchError}</span>
                                            </div>
                                        )}
                                        
                                        {partnerResults.length > 0 && (
                                            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto mb-4 custom-scrollbar">
                                                {partnerResults.map(p => (
                                                    <div 
                                                        key={p._id} 
                                                        onClick={() => { 
                                                            setSelectedPartners(prev => [...prev, p]); 
                                                            setPartnerSearchQ(''); 
                                                            setPartnerResults([]);
                                                            if (!officialChestId) setOfficialChestId(viewParticipant._id); 
                                                        }}
                                                        className="p-3 bg-[#13111C] border border-[#2D283E] hover:border-indigo-500/50 rounded-lg cursor-pointer flex justify-between items-center transition-all group"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="text-white font-medium">{p.name}</span>
                                                            <span className="text-gray-500 text-xs">{p.teamId?.name || 'No Team'} · {p.groupId?.name || 'No Group'}</span>
                                                        </div>
                                                        <span className="text-indigo-400 font-mono text-xs font-bold bg-indigo-500/10 px-2 py-1 rounded">#{p.chestNumber}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {selectedPartners.length > 0 && (
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedPartners.map(p => (
                                                        <div key={p._id} className="group relative">
                                                            <div className="flex items-center gap-2 bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs">
                                                                <span className="font-bold">#{p.chestNumber}</span>
                                                                <span>{p.name}</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedPartners(prev => prev.filter(sp => sp._id !== p._id));
                                                                        if (officialChestId === p._id) setOfficialChestId(viewParticipant._id);
                                                                    }}
                                                                    className="text-indigo-400 hover:text-white"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="bg-[#13111C]/50 p-4 rounded-xl border border-indigo-500/20">
                                                    <p className="text-xs text-gray-400 mb-3 uppercase font-bold tracking-wider">Select Official Chest Number:</p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {[viewParticipant, ...selectedPartners].map(p => (
                                                            <label key={p._id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${officialChestId === p._id ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-[#181525] border-[#2D283E] text-gray-500 hover:border-gray-600'}`}>
                                                                <input type="radio" value={p._id} checked={officialChestId === p._id} onChange={() => setOfficialChestId(p._id)} className="hidden" />
                                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${officialChestId === p._id ? 'border-indigo-400' : 'border-gray-500'}`}>
                                                                    {officialChestId === p._id && <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
                                                                </div>
                                                                <span className="font-mono text-xs font-bold leading-none">
                                                                    {p.chestNumber}
                                                                    <span className="text-[10px] block font-normal opacity-60 truncate max-w-[60px]">{p.name.split(' ')[0]}</span>
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <button 
                                    onClick={async () => {
                                        if(programForm.selectedPrograms.length === 0 && !programForm.programId) return alert("Select at least one program");
                                        
                                        if (selectedModalProgramOb?.isConversation) {
                                            if (selectedPartners.length === 0) return alert("Please select at least one partner for this Conversation program.");
                                            if (!officialChestId) return alert("Please choose the official chest number for the group.");
                                        }

                                        try {
                                            if (selectedModalProgramOb?.isConversation) {
                                                await apiRequest('/conversation-pairs', 'POST', {
                                                    programId: selectedModalProgramOb._id,
                                                    participantIds: [viewParticipant._id, ...selectedPartners.map(p => p._id)],
                                                    primaryParticipantId: officialChestId
                                                });
                                            } else {
                                                const finalProgramsToAdd = [...programForm.selectedPrograms];
                                                if (programForm.programId && !finalProgramsToAdd.includes(programForm.programId)) {
                                                    finalProgramsToAdd.push(programForm.programId);
                                                }
                                                const newPrograms = viewParticipant.programs 
                                                    ? [...viewParticipant.programs.map((p:any) => p._id || p), ...finalProgramsToAdd] 
                                                    : [...finalProgramsToAdd];

                                                const uniquePrograms = Array.from(new Set(newPrograms));

                                                await apiRequest(`/participants/${viewParticipant._id}`, 'PUT', {
                                                    ...viewParticipant,
                                                    programs: uniquePrograms,
                                                    teamId: viewParticipant.teamId?._id || viewParticipant.teamId,
                                                    groupId: viewParticipant.groupId?._id || viewParticipant.groupId
                                                });
                                            }
                                            
                                            // Refresh view
                                            const updated = await apiRequest(`/participants/${viewParticipant._id}`);
                                            setViewParticipant((curr: any) => ({ ...updated, image: curr.image })); // Keep image URL
                                            
                                            alert(selectedModalProgramOb?.isConversation ? "Group registered and program added!" : "Programs added!");
                                            setIsAddingProgramMode(false);
                                            setProgramForm({ language: '', programId: '', selectedPrograms: [] });
                                            setSelectedPartners([]);
                                            setPartnerSearchQ('');
                                            setOfficialChestId('');
                                            invalidateParticipants();
                                        } catch(e:any) {
                                            alert(e.message);
                                        }
                                    }}
                                    disabled={selectedModalProgramOb?.isConversation && (selectedPartners.length === 0 || !officialChestId)}
                                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-xl shadow-green-900/20 text-lg flex items-center justify-center gap-2 mt-4"
                                >
                                    <Save size={18} /> {selectedModalProgramOb?.isConversation ? 'Save Conversation Pair' : 'Save & Add Programs'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Grid size={16} /> Registered Programs
                            </h4>
                            
                            {viewParticipant.programs?.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {viewParticipant.programs.map((prog: any) => (
                                        <div key={prog._id || prog} className="bg-[#13111C] p-3 rounded-xl border border-[#2D283E] flex items-center justify-between group hover:border-purple-500/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-bold">
                                                    {prog.language ? prog.language.substring(0,2).toUpperCase() : 'ALL'}
                                                </div>
                                                <span className="text-gray-200 text-sm font-medium">{prog.name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-[#13111C] rounded-2xl border border-dashed border-[#2D283E] text-gray-500">
                                    <p>No programs assigned yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-6 border-t border-[#2D283E] bg-[#13111C] flex justify-between">
                    {isAddingProgramMode ? (
                        <button 
                            onClick={() => setIsAddingProgramMode(false)}
                            className="px-6 py-2 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-lg font-bold transition-colors"
                        >
                            Cancel
                        </button>
                    ) : (
                         <button 
                            onClick={() => {
                                setIsAddingProgramMode(true);
                                setProgramForm({ language: '', programId: '', selectedPrograms: [] });
                                setSelectedPartners([]);
                            }}
                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all"
                        >
                            <Plus size={18} /> Add Programs
                        </button>
                    )}
                   
                    <button 
                        onClick={() => setViewParticipant(null)}
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import { FileDown, RefreshCw, Search, Trophy, CheckCircle, Clock, ChevronDown, Filter, Cloud, X, Edit } from 'lucide-react';
import { useReviewPrograms, useReviewProgramMarks, useGroups, useInvalidate, useSettings, useConversationPairs } from '@/lib/queries';
import ToastContainer, { type ToastData } from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';

const DEFAULT_SETTINGS = { firstPlacePoints: 5, secondPlacePoints: 3, thirdPlacePoints: 1 };

export default function MarksReviewPage() {
  const { data: programs = [] as any[] } = useReviewPrograms();
  const { data: groups = [] as any[] } = useGroups();
  const { invalidatePrograms, invalidateTeams, invalidateParticipants, invalidateReviewPrograms, invalidateReviewProgramMarks, invalidateIndividualRankings } = useInvalidate();
  const refreshPrograms = invalidatePrograms;
  const refreshTeams = invalidateTeams;
  const refreshParticipants = invalidateParticipants;
  const contextLoading = false;
  
  const [verifying, setVerifying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [verifiedPrograms, setVerifiedPrograms] = useState<Set<string>>(new Set());
  const [verifyResults, setVerifyResults] = useState<any[] | null>(null); // position results after verify
  const [showCalculateConfirm, setShowCalculateConfirm] = useState(false);

  
  // SSE connection ref — used to abort the stream on cleanup/program-change
  const sseAbortRef = useRef<AbortController | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, ...data }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  // Dropdown & Filter state
  const [viewMode, setViewMode] = useState<'dashboard' | 'details'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterLang, setSelectedFilterLang] = useState('All');
  const [selectedFilterGroup, setSelectedFilterGroup] = useState('All');
  const [filterSubmittedOnly, setFilterSubmittedOnly] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedProgramData, setSelectedProgramData] = useState<any>(null);

  // Pagination and search state for the program detail (marks) view
  const [marksPage, setMarksPage] = useState(1);
  const marksLimit = 50;
  const [detailSearch, setDetailSearch] = useState('');
  const [detailSearchInput, setDetailSearchInput] = useState('');

  // State for detailed mark viewing / editing modal
  const [activeMarkDetail, setActiveMarkDetail] = useState<{ mark: any; participant: any; judgeName: string; program: any } | null>(null);

  // Mark Action Handlers
  const handleMarkAction = async (
    markId: string, 
    action: 'approve' | 'reject' | 'edit', 
    newMarkValue?: number, 
    reason?: string,
    criteriaMarksPayload?: any[]
  ) => {
      try {
          if (action === 'edit') {
              if (!reason) {
                  return addToast({ title: 'Validation Error', message: "Reason for edit is required.", type: 'warning' });
              }
              const payload: any = { reason };
              if (criteriaMarksPayload && criteriaMarksPayload.length > 0) {
                payload.criteriaMarks = criteriaMarksPayload;
              } else if (newMarkValue !== undefined) {
                payload.newMark = newMarkValue;
              }
              await apiRequest(`/marks/${markId}`, 'PATCH', payload);
              addToast({ judgeName: 'System', programName: 'Mark updated successfully', language: '' });
          } else {
              const status = action === 'approve' ? 'approved' : 'rejected';
              await apiRequest(`/marks/${markId}/status`, 'PATCH', { status });
              addToast({ judgeName: 'System', programName: `Mark ${status} successfully`, language: '' });
          }
          // Targeted cache invalidation
          if (selectedProgram) {
            invalidateReviewProgramMarks(selectedProgram);
          }
          invalidateReviewPrograms();
          invalidateIndividualRankings();
          invalidateParticipants();
          invalidateTeams();
      } catch (e: any) {
          addToast({ title: 'Mark Action Failed', message: e.message, type: 'error' });
      }
  };

  // TanStack Query Hooks replacing local state
  const { data: serverSettings = DEFAULT_SETTINGS } = useSettings();
  const [settings, setSettings] = React.useState(serverSettings);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  
  React.useEffect(() => {
      setSettings(serverSettings);
  }, [serverSettings]);
  const { data: marksData, isLoading: marksLoading, refetch: refreshMarks } = useReviewProgramMarks(selectedProgram, marksPage, marksLimit, detailSearch);
  const { data: conversationPairs = [] as any[] } = useConversationPairs(selectedProgram, !!selectedProgramData?.isConversation);
  
  const marks = marksData?.marks || [];
  
  const assignedJudges = useMemo(() => {
      if (marksData?.assignedJudges && marksData.assignedJudges.length > 0) {
        return marksData.assignedJudges;
      } else if (marks && marks.length > 0) {
        const uniqueJudges = Array.from(new Set(marks.map((m: any) => m.judgeId?._id))).filter(Boolean);
        return uniqueJudges.map(jId => {
            const sampleMark = marks.find((m: any) => m.judgeId?._id === jId);
            return { _id: jId as string, name: sampleMark?.judgeId?.name || "Judge" };
        });
      }
      return [];
  }, [marksData, marks]);

  const handleProgramSelect = async (program: any) => {
    setSelectedProgram(program._id);
    setSelectedProgramData(program);
    setViewMode('details');
    setMarksPage(1);       // reset pagination when switching programs
    setDetailSearch('');   // reset server-side search
    setDetailSearchInput('');
  };

  // Debounce the detail search input — resets to page 1 on new search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDetailSearch(detailSearchInput);
      setMarksPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [detailSearchInput]);



  const groupedMarks = useMemo(() => {
    if (!marks.length) return [];
    
    const participantMap: Record<string, any> = {};
    
    // 1. Group by participant
    marks.forEach((m: any) => {
        let pId = m.participantId?._id;
        let participantObj = m.participantId;
        
        if (!pId) return;

        // If this is a conversation program, we group by the primary pair ID 
        // to merge the mirrored scores visually into one row.
        if (selectedProgramData?.isConversation && conversationPairs.length > 0) {
            const pair = conversationPairs.find((p: any) => p.participants?.some((part:any) => part._id === pId));
            if (pair) {
                // Determine if this is the primary or secondary
                const isPrimary = pair.primaryParticipantId?._id === pId;
                // If it's secondary, we completely ignore this mark because its exact duplicate is already processed
                // via the primary. This cleanly avoids doubling the score!
                if (!isPrimary) return;
                
                // Override the display ID and the visual participant object
                pId = pair.primaryParticipantId._id;
                participantObj = {
                    ...pair.primaryParticipantId,
                    name: pair.participants.map((part:any) => part.name).join(' & '),
                    teamId: participantObj.teamId // preserve the team info
                };
            }
        }

        if (!participantMap[pId]) {
            participantMap[pId] = {
                participant: participantObj,
                judgesMarks: [],
                totalScore: 0,
                rank: null
            };
        }
        
        participantMap[pId].judgesMarks.push({
            id: m._id,
            judgeName: m.judgeId?.name,
            judgeInitial: m.judgeId?.name?.charAt(0),
            mark: m.marksGiven,
            status: m.status || 'pending',
            criteriaMarks: m.criteriaMarks || [],
        });
        if (m.status === 'approved') {
            participantMap[pId].totalScore += m.marksGiven || 0;
        }
    });

    // 2. Convert to array and sort by total score descending
    const sortedParticipants = Object.values(participantMap).sort((a, b) => b.totalScore - a.totalScore);

    // 3. Assign true ranks (handling ties - dense ranking)
    let currentRank = 1;
    for (let i = 0; i < sortedParticipants.length; i++) {
        if (i > 0 && sortedParticipants[i].totalScore < sortedParticipants[i - 1].totalScore) {
            currentRank++;
        }
        sortedParticipants[i].rank = currentRank;
    }

    return sortedParticipants;
  }, [marks]);

  const handleCalculate = () => {
    setShowCalculateConfirm(true);
  };

  const confirmCalculateScores = async () => {
    setShowCalculateConfirm(false);
    setVerifying(true);
    setVerifyResults(null); // Clear previous results
    try {
       const result = await apiRequest(`/marks/calculate/${selectedProgram}`, 'POST');
       await refreshTeams();
       await refreshParticipants();
       invalidateIndividualRankings(); // Clear the caching for the main Ranking UI
       await refreshPrograms();
       
       // Update local selected program data to reflect the new state so it updates immediately
       setSelectedProgramData((prev: any) => ({ ...prev, status: 'completed' }));
       
       setVerifiedPrograms(prev => new Set([...Array.from(prev), selectedProgram as string]));
       
       // Show the rich results panel instead of a plain alert
       if (result?.positionResults?.length > 0) {
         setVerifyResults(result.positionResults);
       } else {
         addToast({ judgeName: 'System', programName: 'Scores recalculated', language: '' });
       }
    } catch(e: any) {
        addToast({ title: 'Calculation Error', message: e.message, type: 'error' });
    } finally {
        setVerifying(false);
    }
  };

  const downloadCSV = () => {
     if (!groupedMarks.length) return;
     const headers = "Participant,Chest No,Team,Total Score,Judges Breakdown";
     const rows = groupedMarks.map(m => {
        const breakdown = m.judgesMarks.map((jm: any) => `${jm.judgeName}: ${jm.mark}`).join(" | ");
        return `"${m.participant?.name || ''}","${m.participant?.chestNumber || ''}","${m.participant?.teamId?.name || ''}",${m.totalScore},"${breakdown}"`;
     }).join('\n');
     
     const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + rows;
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `marks_export_${selectedProgram}.csv`);
     document.body.appendChild(link);
     link.click();
  };
  
  const handleSyncGoogleSheets = async () => {
    if (!selectedProgram) return;
    setIsSyncing(true);
    try {
        const response = await apiRequest(`/marks/export-sheets/${selectedProgram}`, 'POST');
        addToast({ title: 'Sync Successful', message: response.message || 'Successfully synced with Google Sheets!', type: 'success' });
    } catch (e: any) {
        addToast({ title: 'Sync Error', message: e.message || 'Failed to sync with Google Sheets', type: 'error' });
    } finally {
        setIsSyncing(false);
    }
  };

  const saveSettings = async () => {
      setSavingSettings(true);
      try {
          await apiRequest('/settings', 'PUT', settings);
          setIsSettingsOpen(false);
          addToast({ title: 'Settings Saved', message: 'Points Configuration Saved!', type: 'success' });
      } catch (e: any) {
          addToast({ title: 'Save Error', message: e.message || 'Failed to save settings', type: 'error' });
      } finally {
          setSavingSettings(false);
      }
  };

  const getLangColor = (lang: string) => {
      switch(lang?.toLowerCase()) {
          case 'arabic': return 'bg-green-500/10 text-green-400 border-green-500/20';
          case 'english': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
          case 'malayalam': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
          case 'urdu': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
          default: return 'bg-gray-700 text-gray-300 border-gray-600';
      }
  };

  const filteredPrograms = programs.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLang = selectedFilterLang === 'All' || p.language === selectedFilterLang;
      const matchesGroup = selectedFilterGroup === 'All' || (p.groupId?._id === selectedFilterGroup || p.groupId === selectedFilterGroup);
      const matchesSubmission = !filterSubmittedOnly || p.hasMarks;
      return matchesSearch && matchesLang && matchesGroup && matchesSubmission;
  });

  // Group programs by category for visual organization
  const groupedPrograms = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredPrograms.forEach(p => {
        const catName = p.groupId?.name || 'Uncategorized';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(p);
    });
    return groups;
  }, [filteredPrograms]);

  const languages = ['All', ...Array.from(new Set(programs.map(p => p.language))).filter(Boolean)];

  if (contextLoading && programs.length === 0) {
    return (
        <div className="min-h-screen bg-[#0F0D15] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">Review Marks & Reports</h2>
               <p className="text-gray-400 mt-1">Verify judge submissions and publish final scores.</p>
            </div>
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-gray-700 shadow-lg"
            >
                <Trophy size={16} />
                Configure Prize Points
            </button>
        </div>
        
        {/* Controls Section */}
        <div className="bg-[#1E1B2E] p-6 rounded-2xl border border-[#2D283E] shadow-xl flex flex-col gap-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">Category</label>
                        <div className="relative">
                            <select
                                value={selectedFilterGroup}
                                onChange={(e) => setSelectedFilterGroup(e.target.value)}
                                className="appearance-none bg-[#13111C] text-gray-300 border border-gray-800 hover:border-gray-600 rounded-xl pl-4 pr-10 py-2 text-sm font-bold w-full min-w-[160px] focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                            >
                                <option value="All">All Categories</option>
                                {groups.map(g => (
                                    <option key={g._id} value={g._id}>{g.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">Language</label>
                        <div className="relative">
                            <select
                                value={selectedFilterLang}
                                onChange={(e) => setSelectedFilterLang(e.target.value)}
                                className="appearance-none bg-[#13111C] text-gray-300 border border-gray-800 hover:border-gray-600 rounded-xl pl-4 pr-10 py-2 text-sm font-bold w-full min-w-[160px] focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                            >
                                {languages.map(lang => (
                                    <option key={lang} value={lang}>
                                        {lang === 'All' ? 'All Languages' : lang}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-6">
                        <button
                            onClick={() => setFilterSubmittedOnly(!filterSubmittedOnly)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
                                filterSubmittedOnly 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/50 shadow-lg shadow-amber-900/10' 
                                : 'bg-[#13111C] text-gray-400 border-gray-800 hover:border-gray-600'
                            }`}
                        >
                            <Filter size={16} className={filterSubmittedOnly ? 'fill-current' : ''} />
                            {filterSubmittedOnly ? 'Submitted Only' : 'All States'}
                        </button>
                    </div>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                        className="w-full bg-[#13111C] border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all placeholder:text-gray-600"
                        placeholder="Search programs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {viewMode === 'details' && selectedProgramData && (
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between pt-4 border-t border-gray-800/50 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setViewMode('dashboard')}
                            className="bg-gray-800 hover:bg-gray-700 text-white p-2.5 rounded-xl transition-all border border-gray-700 shadow-lg group"
                            title="Back to Programs"
                        >
                            <ChevronDown className="rotate-90 group-hover:-translate-x-1 transition-transform" size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold text-white leading-tight">{selectedProgramData.name}</h3>
                                <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-black border tracking-wider ${getLangColor(selectedProgramData.language)}`}>
                                    {selectedProgramData.language}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-purple-400 font-bold uppercase tracking-wider">{selectedProgramData.groupId?.name || 'No Group'}</span>
                                <span className="text-gray-600 px-1">•</span>
                                <p className="text-sm text-gray-500 font-medium tracking-tight">#{selectedProgramData._id.slice(-6)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={handleCalculate}
                            disabled={!selectedProgram || verifying || (selectedProgram && verifiedPrograms.has(selectedProgram)) || selectedProgramData?.status === 'completed'}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-900/20 active:scale-95"
                        >
                            {(selectedProgram && verifiedPrograms.has(selectedProgram)) || selectedProgramData?.status === 'completed' ? <CheckCircle size={18} /> : <Trophy size={18} />}
                            {verifying ? 'Verifying...' : ((selectedProgram && verifiedPrograms.has(selectedProgram)) || selectedProgramData?.status === 'completed') ? 'Verified' : 'Verify & Calculate'}
                        </button> 

                        <button
                            onClick={() => refreshMarks()}
                            disabled={!marks.length || marksLoading}
                            className="p-3 bg-green-600/10 hover:bg-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-green-400 rounded-xl font-bold transition-all border border-green-500/20 active:scale-95 flex items-center gap-2"
                            title="Refresh Marks"
                        >
                            <RefreshCw size={20} className={marksLoading ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Refresh Marks</span>
                        </button>

                        <button
                            onClick={downloadCSV}
                            disabled={!marks.length}
                            className="p-3 bg-[#2D283E] hover:bg-[#352F4B] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all border border-gray-700 hover:border-gray-600 active:scale-95"
                            title="Export Results"
                        >
                            <FileDown size={20} />
                        </button>

                        <button
                            onClick={handleSyncGoogleSheets}
                            disabled={!marks.length || isSyncing}
                            className="p-3 bg-blue-600/10 hover:bg-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 rounded-xl font-bold transition-all border border-blue-500/20 active:scale-95"
                            title="Sync with Google Sheets"
                        >
                            {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <Cloud size={20} />}
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Dynamic Content */}
        <div className="relative min-h-[400px]">
            {viewMode === 'dashboard' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Desktop Header */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 mb-2 text-gray-500 text-[11px] font-bold uppercase tracking-wider items-center">
                        <div className="col-span-4">Program Name</div>
                        <div className="col-span-2">Language</div>
                        <div className="col-span-3">Judge Submissions</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {Object.keys(groupedPrograms).length > 0 ? (
                        Object.entries(groupedPrograms).map(([catName, progs]) => (
                            <div key={catName} className="space-y-2.5">
                                <div className="px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-500/50 mt-4 first:mt-0">
                                    {catName}
                                </div>
                                
                                <div className="hidden md:block space-y-2.5">
                                    {progs.map((p, index) => {
                                        const borderAccents = ['border-l-purple-500', 'border-l-amber-500', 'border-l-blue-500', 'border-l-indigo-500'];
                                        const leftBorderClass = borderAccents[index % borderAccents.length];
                                        return (
                                            <div 
                                                key={p._id} 
                                                onClick={() => handleProgramSelect(p)}
                                                className={`card-animate grid grid-cols-12 gap-4 items-center px-6 py-4 bg-[#131629] border-t border-r border-b border-white/[0.06] border-l-2 ${leftBorderClass} rounded-xl cursor-pointer hover:border-purple-500/40 hover:bg-[#161830] transition-all duration-200 group shadow-sm`}
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                {/* Program Name */}
                                                <div className="col-span-4">
                                                    <div className="font-bold text-white group-hover:text-purple-400 transition-colors text-lg uppercase tracking-tight leading-none truncate">{p.name}</div>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[10px] text-gray-500 font-mono">#{p._id.slice(-6)}</span>
                                                        {(p.participantCount ?? 0) > 0 && (
                                                          <span className="text-[10px] text-blue-400/60">· {p.participantCount} participants</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Language */}
                                                <div className="col-span-2 flex items-center">
                                                    <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-black border tracking-wider ${getLangColor(p.language)}`}>
                                                        {p.language}
                                                    </span>
                                                </div>

                                                {/* Submissions */}
                                                <div className="col-span-3 flex items-center">
                                                    <div className="flex items-center gap-3 w-full max-w-[200px]">
                                                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
                                                            <div 
                                                                className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-500"
                                                                style={{ width: `${(p.submittedCount / (p.totalAssigned || 1)) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-mono font-bold text-gray-300">
                                                            {p.submittedCount}/{p.totalAssigned || '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Status */}
                                                <div className="col-span-2 flex items-center">
                                                    {p.status === 'completed' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase tracking-wider">
                                                            <CheckCircle size={12} /> Verified
                                                        </span>
                                                    ) : p.hasMarks ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 uppercase tracking-wider">
                                                            <Clock size={12} /> Pending Review
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-500/10 text-gray-500 text-[10px] font-bold border border-gray-500/20 uppercase tracking-wider">
                                                            <Clock size={12} /> No Marks
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="col-span-1 flex items-center justify-end">
                                                    <button className="bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border border-purple-500/20 group-hover:scale-105 active:scale-95 shadow-sm">
                                                        REVIEW
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Mobile view mapping */}
                                <div className="md:hidden space-y-2">
                                    {progs.map((p, index) => (
                                        <div 
                                            key={p._id} 
                                            onClick={() => handleProgramSelect(p)}
                                            className="flex flex-col gap-3 px-4 py-3 bg-[#131629] border border-white/[0.07] rounded-xl cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-white text-sm uppercase">{p.name}</h4>
                                                    <span className="text-[10px] text-gray-500 font-mono block mt-0.5">#{p._id.slice(-6)}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black border tracking-wider ${getLangColor(p.language)}`}>
                                                    {p.language}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-gray-300">
                                                        {p.submittedCount}/{p.totalAssigned || '-'} Submissions
                                                    </span>
                                                </div>
                                                <button className="bg-purple-600/10 text-purple-400 px-3 py-1 rounded-lg text-[10px] font-black">
                                                    REVIEW
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
                            <div className="flex flex-col items-center gap-3">
                                <Search size={48} className="opacity-10" />
                                <p className="text-lg font-medium">No programs found matching your filters.</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-right-8 fade-in duration-500">

                    {/* Detail view participant/chest search — server-side filtered */}
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            className="w-full bg-[#1E1B2E] border border-gray-700 rounded-xl pl-12 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-all placeholder:text-gray-600"
                            placeholder="Search participants or chest no..."
                            value={detailSearchInput}
                            onChange={(e) => setDetailSearchInput(e.target.value)}
                        />
                    </div>

                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 mb-2 text-gray-500 text-[11px] font-bold uppercase tracking-wider items-center">
                        <div className="col-span-3">Participant</div>
                        <div className={assignedJudges.length > 0 ? "col-span-6 flex justify-between px-4" : "col-span-6 text-center"}>
                            {assignedJudges.length > 0 ? (
                                assignedJudges.map((judge: any) => (
                                    <div key={judge._id} className="text-center flex-1">{judge.name}</div>
                                ))
                            ) : (
                                "Judges Not Assigned"
                            )}
                        </div>
                        <div className="col-span-2 text-center">Total Score</div>
                        <div className="col-span-1 text-right">Rank</div>
                    </div>

                    <div className="hidden md:block space-y-2.5">
                        {marksLoading ? (
                            <div className="py-16 text-center text-purple-400 bg-[#13111C]/30 rounded-xl border border-white/[0.06] animate-pulse flex flex-col items-center justify-center gap-3">
                                <RefreshCw size={32} className="animate-spin" />
                                <span className="font-medium">Loading marks...</span>
                            </div>
                        ) : groupedMarks.length > 0 ? (
                            groupedMarks.map((m, index) => {
                                const borderAccents = ['border-l-purple-500', 'border-l-amber-500', 'border-l-blue-500', 'border-l-indigo-500'];
                                const leftBorderClass = borderAccents[index % borderAccents.length];
                                
                                return (
                                <div key={m.participant._id} className={`card-animate grid grid-cols-12 gap-4 items-center px-6 py-4 bg-[#131629] border-t border-r border-b border-white/[0.06] border-l-2 ${leftBorderClass} rounded-xl hover:bg-[#161830] transition-colors group shadow-sm`} style={{ animationDelay: `${index * 50}ms` }}>
                                    {/* Participant */}
                                    <div className="col-span-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[#111018] border border-gray-800 flex items-center justify-center text-sm font-bold text-gray-400 font-mono shadow-inner">
                                                {m.participant?.chestNumber}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-white group-hover:text-purple-300 transition-colors truncate">{m.participant?.name}</div>
                                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5 truncate">{m.participant?.teamId?.name || 'No Team'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Judges */}
                                    <div className={assignedJudges.length > 0 ? "col-span-6 flex justify-between px-4" : "col-span-6"}>
                                        {assignedJudges.length > 0 ? (
                                            assignedJudges.map((judge: any) => {
                                                const judgeMark = m.judgesMarks.find((jm: any) => jm.judgeName === judge.name);
                                                return (
                                                    <div key={judge._id} className="text-center flex-1">
                                                        {judgeMark ? (
                                                             <div className="flex flex-col items-center gap-1.5">
                                                                 <div className="flex items-center gap-2">
                                                                     <button 
                                                                         onClick={() => setActiveMarkDetail({ mark: judgeMark, participant: m.participant, judgeName: judge.name, program: selectedProgramData })}
                                                                         className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-600/20 text-purple-300 font-bold font-mono text-base shadow-inner hover:bg-purple-600/30 hover:border-purple-500 transition-all cursor-pointer"
                                                                         title="Click to view detailed breakdown"
                                                                     >
                                                                         {judgeMark.mark}
                                                                     </button>
                                                                     <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                                         judgeMark.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                                                         judgeMark.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                                                                         'bg-yellow-500/10 text-yellow-400'
                                                                     }`}>
                                                                         {judgeMark.status}
                                                                     </span>
                                                                 </div>
                                                                 {judgeMark.status === 'pending' && (
                                                                     <div className="flex gap-1 mt-1">
                                                                         <button onClick={() => handleMarkAction(judgeMark.id, 'approve')} className="text-[9px] font-bold uppercase bg-green-500/20 hover:bg-green-500/40 text-green-300 px-2 py-1 rounded transition-colors">Approve</button>
                                                                         <button onClick={() => handleMarkAction(judgeMark.id, 'reject')} className="text-[9px] font-bold uppercase bg-red-500/20 hover:bg-red-500/40 text-red-300 px-2 py-1 rounded transition-colors">Reject</button>
                                                                     </div>
                                                                 )}
                                                                 {judgeMark.status === 'approved' && (
                                                                     <button onClick={() => setActiveMarkDetail({ mark: judgeMark, participant: m.participant, judgeName: judge.name, program: selectedProgramData })} className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-3 py-1 rounded mt-0.5 transition-colors">Details / Edit</button>
                                                                 )}
                                                             </div>
                                                        ) : (
                                                            <span className="text-gray-700 font-bold font-mono">--</span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {m.judgesMarks.map((jm: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-1.5 bg-[#111018] border border-gray-800 rounded-lg px-2.5 py-1.5 shadow-inner">
                                                        <div className="w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center text-[9px] text-gray-400 font-bold">
                                                            {jm.judgeInitial}
                                                        </div>
                                                        <span className="text-xs text-gray-400 font-medium">{jm.judgeName}:</span>
                                                        <span className="text-sm font-bold text-yellow-500 font-mono">{jm.mark}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Total Score */}
                                    <div className="col-span-2 text-center">
                                        <span className="inline-block px-4 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-mono text-xl font-black shadow-inner">
                                            {m.totalScore}
                                        </span>
                                    </div>

                                    {/* Rank */}
                                    <div className="col-span-1 text-right">
                                        {m.rank === 1 && (
                                            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/30 text-xs gap-1.5">
                                                <Trophy size={12} /> 1st
                                            </span>
                                        )}
                                        {m.rank === 2 && (
                                            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gray-300/20 text-gray-300 font-bold border border-gray-400/30 text-xs gap-1.5">
                                                <Trophy size={12} /> 2nd
                                            </span>
                                        )}
                                        {m.rank === 3 && (
                                            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30 text-xs gap-1.5">
                                                <Trophy size={12} /> 3rd
                                            </span>
                                        )}
                                        {m.rank > 3 && (
                                            <span className="text-gray-500 font-bold font-mono text-lg pr-2">
                                                #{m.rank}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        ) : (
                            <div className="py-20 text-center text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
                                <div className="flex flex-col items-center justify-center gap-3">
                                    <Clock size={32} className="opacity-20" />
                                    <p>No marks submitted for this program yet.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Server-side pagination controls */}
                    {marksData && marksData.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 py-4">
                            <button
                                onClick={() => setMarksPage(p => Math.max(1, p - 1))}
                                disabled={marksPage <= 1}
                                className="px-5 py-2 text-sm font-bold bg-[#1E1B2E] border border-gray-700 hover:border-purple-500/50 hover:bg-[#252234] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all active:scale-95"
                            >
                                ← Previous
                            </button>
                            <span className="text-sm text-gray-400 font-medium min-w-[120px] text-center">
                                Page <span className="text-white font-bold">{marksPage}</span> of <span className="text-white font-bold">{marksData.totalPages}</span>
                            </span>
                            <button
                                onClick={() => setMarksPage(p => Math.min(marksData.totalPages, p + 1))}
                                disabled={marksPage >= marksData.totalPages}
                                className="px-5 py-2 text-sm font-bold bg-[#1E1B2E] border border-gray-700 hover:border-purple-500/50 hover:bg-[#252234] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all active:scale-95"
                            >
                                Next →
                            </button>
                        </div>
                    )}

                    {/* Mobile list view */}
                    <div className="md:hidden space-y-3">
                        {marksLoading ? (
                            <div className="py-16 text-center text-purple-400 bg-[#13111C]/30 rounded-xl border border-white/[0.06] animate-pulse flex flex-col items-center justify-center gap-3">
                                <RefreshCw size={32} className="animate-spin" />
                                <span className="font-medium">Loading...</span>
                            </div>
                        ) : groupedMarks.length > 0 ? (
                            groupedMarks.map((m) => (
                                <div key={m.participant._id} className="px-4 py-4 bg-[#131629] border border-white/[0.07] rounded-xl flex flex-col gap-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[#111018] border border-gray-800 flex items-center justify-center text-sm font-bold text-gray-400 font-mono shadow-inner">
                                                {m.participant?.chestNumber}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">{m.participant?.name}</div>
                                                <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">{m.participant?.teamId?.name || 'No Team'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-yellow-400 font-mono text-xl font-black">{m.totalScore}</div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold">Total</div>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Judges</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {m.judgesMarks.map((jm: any, idx: number) => (
                                                <div key={idx} className="bg-[#111018] border border-gray-800 rounded-lg p-2 shadow-inner">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] text-gray-400 font-bold truncate">{jm.judgeName}</span>
                                                        <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                                                            jm.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                                            jm.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                                                            'bg-yellow-500/10 text-yellow-400'
                                                        }`}>
                                                            {jm.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <button 
                                                            onClick={() => setActiveMarkDetail({ mark: jm, participant: m.participant, judgeName: jm.judgeName, program: selectedProgramData })}
                                                            className="text-sm font-bold text-white font-mono hover:text-purple-300 underline underline-offset-2"
                                                        >
                                                            {jm.mark}
                                                        </button>
                                                        {jm.status === 'pending' && (
                                                            <div className="flex gap-1">
                                                                <button onClick={() => handleMarkAction(jm.id, 'approve')} className="w-5 h-5 flex items-center justify-center rounded bg-green-500/20 text-green-300 font-bold text-[10px]">✓</button>
                                                                <button onClick={() => handleMarkAction(jm.id, 'reject')} className="w-5 h-5 flex items-center justify-center rounded bg-red-500/20 text-red-300 font-bold text-[10px]">✕</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
                                <p className="text-sm">No marks found.</p>
                            </div>
                        )}
                    </div>
                </div>
        )}
    </div>

        {/* Settings Modal */}
        {/* Verify Results Panel — shown after admin clicks Verify & Calculate */}
        {verifyResults && verifyResults.length > 0 && (
            <div className="bg-[#1E1B2E] border border-green-500/20 rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-500 relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                            <CheckCircle size={20} className="text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Scores Verified & Leaderboard Updated</h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Position points have been awarded based on your<span className="text-purple-400 font-semibold"> Configure Prize Points</span> settings.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setVerifyResults(null)}
                        className="text-gray-600 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                    >
                        ✕
                    </button>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {verifyResults.map((r: any) => {
                        const medal = r.position === 1 ? '🥇' : r.position === 2 ? '🥈' : '🥉';
                        const ringColor = r.position === 1
                            ? 'border-yellow-500/40 bg-yellow-500/5'
                            : r.position === 2
                            ? 'border-gray-300/30 bg-gray-300/5'
                            : 'border-orange-500/30 bg-orange-500/5';
                        const textColor = r.position === 1 ? 'text-yellow-400' : r.position === 2 ? 'text-gray-300' : 'text-orange-400';
                        return (
                            <div key={r._id} className={`flex items-center gap-4 p-4 rounded-xl border ${ringColor}`}>
                                <span className="text-3xl">{medal}</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-white truncate">{r.participantId?.name || '—'}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        #{r.participantId?.chestNumber} · {r.participantId?.teamId?.name || 'No Team'}
                                    </p>
                                </div>
                                <div className="ml-auto shrink-0 text-right">
                                    <p className={`text-xl font-black font-mono ${textColor}`}>+{r.positionPoints}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">pts</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer note */}
                <p className="text-xs text-gray-600 mt-4 text-center">
                    Team totals and participant scores have been recalculated. Visit the <span className="text-purple-400">Teams</span> or <span className="text-purple-400">Dashboard</span> tab to see updated standings.
                </p>

                {/* Decorative glow */}
                <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
            </div>
        )}

        {isSettingsOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
                <div className="bg-[#1E1B2E] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Trophy size={20} className="text-purple-400" />
                        Configure Position Points
                    </h3>
                    <p className="text-sm text-gray-400 mb-6">
                        Set how many points are awarded to the 1st, 2nd, and 3rd place winners of a program. These points are added to their total score.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">1st Place Points</label>
                            <input 
                                type="number" 
                                className="w-full bg-[#13111C] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
                                value={settings.firstPlacePoints}
                                onChange={(e) => setSettings({...settings, firstPlacePoints: Number(e.target.value) || 0})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">2nd Place Points</label>
                            <input 
                                type="number" 
                                className="w-full bg-[#13111C] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gray-400 transition-colors"
                                value={settings.secondPlacePoints}
                                onChange={(e) => setSettings({...settings, secondPlacePoints: Number(e.target.value) || 0})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">3rd Place Points</label>
                            <input 
                                type="number" 
                                className="w-full bg-[#13111C] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-700 transition-colors"
                                value={settings.thirdPlacePoints}
                                onChange={(e) => setSettings({...settings, thirdPlacePoints: Number(e.target.value) || 0})}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-8">
                        <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="flex-1 py-3 bg-transparent border border-gray-700 hover:bg-gray-800 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={saveSettings}
                            disabled={savingSettings}
                            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl text-white font-bold transition-all shadow-lg"
                        >
                            {savingSettings ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Live judge activity toasts — fixed bottom-right, above all content */}
        <ConfirmModal
          isOpen={showCalculateConfirm}
          title="Recalculate Scores"
          message="This will recalculate scores for all teams based on these marks. Continue?"
          confirmText="Calculate"
          variant="warning"
          onConfirm={confirmCalculateScores}
          onCancel={() => setShowCalculateConfirm(false)}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {activeMarkDetail && (
        <MarkDetailModal
          detail={activeMarkDetail}
          onClose={() => setActiveMarkDetail(null)}
          onSaveEdit={async (markId, payload) => {
            await handleMarkAction(markId, 'edit', payload.newMark, payload.reason, payload.criteriaMarks);
          }}
        />
      )}
    </div>
  );
}

function MarkDetailModal({
  detail,
  onClose,
  onSaveEdit,
}: {
  detail: {
    mark: any;
    participant: any;
    judgeName: string;
    program: any;
  } | null;
  onClose: () => void;
  onSaveEdit: (markId: string, payload: { newMark?: number; criteriaMarks?: any[]; reason: string }) => Promise<void>;
}) {
  if (!detail) return null;

  const { mark, participant, judgeName, program } = detail;
  const markCriteria = mark.criteriaMarks || [];
  
  // Resolve effective criteria list from program configuration or mark fallback
  const rawProgramCriteria = program?.criteria || [];
  const programCriteria = useMemo(() => {
    if (rawProgramCriteria.length > 0) return rawProgramCriteria;
    if (markCriteria.length > 0) {
      return markCriteria.map((cm: any) => ({
        _id: cm.criterionId?._id ? String(cm.criterionId._id) : (cm.criterionId ? String(cm.criterionId) : cm.title),
        title: cm.title || 'Criterion',
        maxMarks: cm.maxMarks || '-',
      }));
    }
    return [];
  }, [rawProgramCriteria, markCriteria]);

  const hasCriteria = Boolean(program?.criteriaEnabled || programCriteria.length > 0 || markCriteria.length > 0);

  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Initialize input state for criterion editing
  const [criteriaInputs, setCriteriaInputs] = useState<Record<string, number | ''>>(() => {
    const map: Record<string, number | ''> = {};
    programCriteria.forEach((crit: any) => {
      const critIdStr = String(crit._id);
      const existing = markCriteria.find((cm: any) => {
        const cId = cm.criterionId?._id ? String(cm.criterionId._id) : (cm.criterionId ? String(cm.criterionId) : null);
        if (cId && cId === critIdStr) return true;
        if (cm.title && crit.title && cm.title.trim().toLowerCase() === crit.title.trim().toLowerCase()) return true;
        return false;
      });

      if (existing && existing.marksGiven !== undefined && existing.marksGiven !== null) {
        map[critIdStr] = Number(existing.marksGiven);
      } else {
        map[critIdStr] = '';
      }
    });
    return map;
  });

  const [totalInput, setTotalInput] = useState<number>(mark.mark || 0);
  const [reasonInput, setReasonInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Automatically calculate total from individual criterion inputs
  const calculatedCriteriaTotal = useMemo(() => {
    if (!hasCriteria || programCriteria.length === 0) return totalInput;
    return Object.values(criteriaInputs).reduce<number>((sum, val) => {
      const num = Number(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [criteriaInputs, hasCriteria, programCriteria, totalInput]);

  const handleCriterionChange = (critIdStr: string, valStr: string) => {
    if (valStr === '') {
      setCriteriaInputs(prev => ({ ...prev, [critIdStr]: '' }));
      return;
    }
    const val = Number(valStr);
    if (isNaN(val)) return;
    setCriteriaInputs(prev => ({ ...prev, [critIdStr]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput.trim()) {
      setErrorMsg('Reason for editing is required.');
      return;
    }

    if (hasCriteria && programCriteria.length > 0) {
      // Validate every criterion
      for (const c of programCriteria) {
        const critIdStr = String(c._id);
        const val = criteriaInputs[critIdStr];
        if (val === '' || val === undefined || val === null || isNaN(Number(val))) {
          setErrorMsg(`Please enter a valid mark for criterion "${c.title}".`);
          return;
        }
        const numVal = Number(val);
        if (numVal < 0) {
          setErrorMsg(`Mark for criterion "${c.title}" cannot be negative.`);
          return;
        }
        if (typeof c.maxMarks === 'number' && numVal > c.maxMarks) {
          setErrorMsg(`Mark for criterion "${c.title}" (${numVal}) cannot exceed maximum mark of ${c.maxMarks}.`);
          return;
        }
      }

      setIsSaving(true);
      setErrorMsg('');
      try {
        const criteriaMarksPayload = programCriteria.map((c: any) => ({
          criterionId: String(c._id),
          title: c.title,
          marksGiven: Number(criteriaInputs[String(c._id)]),
        }));
        await onSaveEdit(mark.id, {
          criteriaMarks: criteriaMarksPayload,
          reason: reasonInput.trim(),
        });
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to save edit.');
      } finally {
        setIsSaving(false);
      }
    } else {
      if (isNaN(totalInput) || totalInput < 0) {
        setErrorMsg('Total mark must be a non-negative number.');
        return;
      }
      if (program?.maxMarks && totalInput > program.maxMarks) {
        setErrorMsg(`Total mark cannot exceed maximum mark of ${program.maxMarks}.`);
        return;
      }

      setIsSaving(true);
      setErrorMsg('');
      try {
        await onSaveEdit(mark.id, {
          newMark: Number(totalInput),
          reason: reasonInput.trim(),
        });
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to save edit.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1A1828] border border-[#2D283E] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 text-left">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#2D283E] flex justify-between items-start bg-[#13111C]">
          <div>
            <div className="flex items-center gap-2">
              {participant?.chestNumber && (
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold">
                  #{participant.chestNumber}
                </span>
              )}
              <h3 className="text-base font-bold text-white">{participant?.name || 'Participant Evaluation'}</h3>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Evaluated by <span className="text-purple-300 font-bold">{judgeName}</span> ({program?.name})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {!isEditing ? (
            /* Detailed Breakdown View Mode */
            <div className="space-y-4">
              {/* Total Score Summary Card */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300 block">Total Score</span>
                  <span className="text-[10px] text-gray-400 font-medium">Evaluated Mark</span>
                </div>
                <span className="font-mono text-2xl font-black text-white">
                  {mark.mark} <span className="text-gray-400 text-sm font-normal">/ {program?.maxMarks || 100}</span>
                </span>
              </div>

              {hasCriteria ? (
                <div className="space-y-2">
                  {/* Collapsible Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between p-3 bg-[#13111C] border border-gray-800 hover:border-purple-500/40 rounded-xl text-xs font-bold text-gray-300 transition-all group"
                  >
                    <span className="flex items-center gap-2 text-purple-300">
                      <ChevronDown size={16} className={`transition-transform duration-200 ${showDetails ? 'rotate-180 text-purple-400' : ''}`} />
                      <span>Detailed Criteria Details</span>
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                      {programCriteria.length} criteria
                    </span>
                  </button>

                  {/* Expanded Criteria Breakdown */}
                  {showDetails && (
                    <div className="bg-[#13111C] rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800/60 animate-in fade-in duration-200">
                      {programCriteria.map((crit: any) => {
                        const critIdStr = String(crit._id);
                        const cm = markCriteria.find((item: any) => {
                          const cId = item.criterionId?._id ? String(item.criterionId._id) : (item.criterionId ? String(item.criterionId) : null);
                          if (cId && cId === critIdStr) return true;
                          if (item.title && crit.title && item.title.trim().toLowerCase() === crit.title.trim().toLowerCase()) return true;
                          return false;
                        });

                        const hasValue = cm && cm.marksGiven !== undefined && cm.marksGiven !== null;
                        const scoreDisplay = hasValue ? cm.marksGiven : '-';

                        return (
                          <div key={crit._id} className="p-3.5 flex justify-between items-center text-xs">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-200">{crit.title}</span>
                              <span className="text-[10px] text-gray-500 font-medium">Judge Mark</span>
                            </div>
                            <div className="font-mono font-bold text-white text-sm">
                              <span className={hasValue ? "text-purple-300 font-black" : "text-gray-500"}>
                                {scoreDisplay}
                              </span>
                              <span className="text-gray-500 font-normal text-xs ml-1">/ {crit.maxMarks}</span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Total Breakdown Row */}
                      <div className="p-3.5 bg-purple-500/5 flex justify-between items-center text-xs font-bold border-t border-purple-500/20">
                        <span className="text-purple-300 uppercase tracking-wider text-[11px]">Total</span>
                        <span className="font-mono text-sm text-white font-black">
                          {mark.mark} <span className="text-gray-400 text-xs font-normal">/ {program?.maxMarks || 100}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[#13111C] rounded-xl border border-gray-800 text-center">
                  <p className="text-xs text-gray-400">This program uses Total Mark Only evaluation.</p>
                </div>
              )}

              {mark.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-xs rounded-xl border border-blue-500/30 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Edit size={15} /> Edit Approved Mark
                </button>
              )}
            </div>
          ) : (
            /* Editing View Mode */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
                  <Edit size={14} /> Edit Evaluation
                </h4>
                <span className="text-[10px] text-gray-500 font-mono">
                  {hasCriteria ? 'Criteria-wise Marking' : 'Total Mark Only'}
                </span>
              </div>

              {hasCriteria && programCriteria.length > 0 ? (
                <div className="space-y-3">
                  {programCriteria.map((crit: any) => {
                    const critIdStr = String(crit._id);
                    const currentVal = criteriaInputs[critIdStr];
                    return (
                      <div key={crit._id} className="flex items-center justify-between p-3 bg-[#13111C] rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-gray-200 block">{crit.title}</span>
                          <span className="text-[10px] text-gray-500">Max Mark: {crit.maxMarks}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={crit.maxMarks}
                            step="any"
                            value={currentVal}
                            onChange={(e) => handleCriterionChange(critIdStr, e.target.value)}
                            className="w-20 bg-[#0B0914] border border-gray-700 focus:border-purple-500 text-center font-mono text-white text-sm p-2 rounded-lg outline-none transition-colors"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-400 font-mono font-bold">/ {crit.maxMarks}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Dynamic Calculated Total */}
                  <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-300 block">Calculated Total</span>
                      <span className="text-[10px] text-gray-400">Sum of criteria marks</span>
                    </div>
                    <span className="font-mono text-lg font-black text-white">
                      {calculatedCriteriaTotal} <span className="text-gray-400 text-xs font-normal">/ {program?.maxMarks || 100}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase block">New Total Mark</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={program?.maxMarks || 100}
                      value={totalInput}
                      onChange={(e) => setTotalInput(Number(e.target.value))}
                      className="w-full bg-[#13111C] border border-gray-700 focus:border-purple-500 font-mono text-white text-sm p-2.5 rounded-xl outline-none"
                    />
                    <span className="text-xs text-gray-400 font-mono font-bold">/ {program?.maxMarks || 100}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 font-bold uppercase block mb-1">
                  Reason for Change <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Required reason for audit log (e.g., Criteria re-evaluation after admin review)"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="w-full bg-[#13111C] border border-gray-700 focus:border-purple-500 text-white text-xs p-2.5 rounded-xl outline-none placeholder-gray-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setErrorMsg(''); }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 font-bold"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

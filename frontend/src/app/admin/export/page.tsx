'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { usePrograms, useGroups, useParticipants, useExportData } from '@/lib/queries';
import {
  Search, ChevronDown, ChevronUp, User,
  Award, X, RefreshCw, Users, BookOpen, Trophy, 
  Crown, Medal, Star
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Mark {
  _id: string;
  marksGiven: number;
  judgeId: { _id: string; name: string };
  participantId: {
    _id: string;
    name: string;
    chestNumber: string;
    teamId?: { name: string };
  };
}

interface ParticipantRow {
  id: string;
  name: string;
  chestNumber: string;
  team: string;
  group: string;
  totalScore: number;
  marks: { programName: string; judgeName: string; marksGiven: number }[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function IndividualMarksPage() {
  const { data: programs = [] as any[] } = usePrograms();
  const { data: groups = [] as any[] } = useGroups();
  const { data: cachedParticipants = [] as any[] } = useParticipants();

  const [allMarks, setAllMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup]     = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All'); // stores program _id or 'All'
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'chest'>('score');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Modal state: null = closed
  const [modalInfo, setModalInfo] = useState<{
    title: string;
    subtitle: string;
    items: { label: string; sub?: string; value?: string | number; accent?: string; rank?: number }[];
  } | null>(null);

  const [allResults, setAllResults] = useState<Record<string, any>>({});

  // Fetch marks and results via TanStack Query (Cached)
  const { data: exportData, isLoading: exportLoading } = useExportData();

  useEffect(() => {
      setLoading(exportLoading);
      if (exportData && programs.length > 0) {
          // Map marks to include program details from context
          const processedMarks = (exportData.allMarks || []).map((m: any) => {
            const pId = typeof m.programId === 'object' ? m.programId._id || m.programId : m.programId;
            const prog = programs.find((p: any) => p._id === pId) || {};
            return {
              ...m,
              programId: pId, // Keep ID for result lookups
              programName: prog.name || 'Unknown Program',
              programGroup: prog.groupId?.name || 'N/A',
            };
          });
          setAllMarks(processedMarks);

          // Group results by programId
          const resMap: Record<string, any> = {};
          (exportData.allResults || []).forEach((r: any) => {
            const pId = typeof r.programId === 'object' ? r.programId._id || r.programId : r.programId;
            if (!resMap[pId]) resMap[pId] = [];
            resMap[pId].push(r);
          });
          setAllResults(resMap);
      }
  }, [exportData, exportLoading, programs]);

  // Build participant rows aggregating all their marks
  const participantRows = useMemo<ParticipantRow[]>(() => {
    const map: Record<string, ParticipantRow> = {};

    // Seed from cached participants to include even those with 0 marks
    cachedParticipants.forEach((p: any) => {
      map[p._id] = {
        id: p._id,
        name: p.name,
        chestNumber: p.chestNumber || '—',
        team: p.teamId?.name || '—',
        group: p.groupId?.name || '—',
        totalScore: p.totalScore || 0,
        marks: [],
      };
    });

    // Fold in mark entries
    allMarks.forEach((m: any) => {
      const pid = m.participantId?._id;
      if (!pid || !map[pid]) return;
      map[pid].marks.push({
        programName: m.programName,
        judgeName: m.judgeId?.name || 'Unknown Judge',
        marksGiven: m.marksGiven ?? 0,
      });
    });

    return Object.values(map);
  }, [allMarks, cachedParticipants]);

  // ── Filter option derivations ──────────────────────────────────────────────
  // Group dropdown
  const groupOptions = ['All', ...groups.map((g: any) => g.name)];

  // Language dropdown — unique languages extracted from programs
  const languageOptions = useMemo(() => {
    const langs = new Set<string>();
    programs.forEach((p: any) => { if (p.language) langs.add(p.language); });
    return ['All', ...Array.from(langs).sort()];
  }, [programs]);

  // Program dropdown — filtered by selected language
  // Use { id, label } so programs with identical names (different languages) get unique keys/values
  const programOptions = useMemo(() => {
    const filteredProgs = programs.filter((p: any) =>
      filterLanguage === 'All' || p.language === filterLanguage
    );
    return [
      { id: 'All', label: 'All' },
      ...filteredProgs.map((p: any) => ({
        id: p._id,
        label: filterLanguage === 'All' && p.language ? `${p.name} (${p.language})` : p.name,
      })),
    ];
  }, [programs, filterLanguage]);

  // When language changes, reset program selection
  const handleLanguageChange = (lang: string) => {
    setFilterLanguage(lang);
    setFilterProgram('All');
  };

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return participantRows
      .filter(p => {
        if (filterGroup !== 'All' && p.group !== filterGroup) return false;
        // Language filter: participant must have at least one mark from a program in that language
        if (filterLanguage !== 'All') {
          const langPrograms = new Set(
            programs
              .filter((pr: any) => pr.language === filterLanguage)
              .map((pr: any) => pr.name)
          );
          const hasLangMark = p.marks.some(m => langPrograms.has(m.programName));
          if (!hasLangMark) return false;
        }
        if (filterProgram !== 'All') {
          // filterProgram holds a program _id; find the program's name to match against marks
          const selectedProg = programs.find((pr: any) => pr._id === filterProgram);
          if (!selectedProg || !p.marks.some(m => m.programName === selectedProg.name)) return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.chestNumber.toLowerCase().includes(q) ||
            p.team.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'score') cmp = (b.totalScore || 0) - (a.totalScore || 0);
        else if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortBy === 'chest') cmp = a.chestNumber.localeCompare(b.chestNumber);
        return sortDir === 'asc' ? -cmp : cmp;
      });
  }, [participantRows, filterGroup, filterLanguage, filterProgram, programs, search, sortBy, sortDir]);

  const activeFilters = [
    filterGroup    !== 'All' && { label: `Group: ${filterGroup}`,    clear: () => setFilterGroup('All') },
    filterLanguage !== 'All' && { label: `Lang: ${filterLanguage}`,  clear: () => handleLanguageChange('All') },
    filterProgram  !== 'All' && {
      label: `Program: ${programOptions.find(o => o.id === filterProgram)?.label ?? filterProgram}`,
      clear: () => setFilterProgram('All'),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const toggleSort = (col: 'score' | 'name' | 'chest') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col
      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <ChevronDown size={12} className="opacity-30" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            Individual Marks
          </h1>
          <p className="text-gray-400 mt-1">
            All participant marks broken down by program and judge
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg font-semibold">
            {filtered.length} participants
          </span>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <RefreshCw size={12} className="animate-spin" /> Loading marks…
            </span>
          )}
        </div>
      </div>

      {/* ── Search + Dropdown Filters ── */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-purple-400" />
          <input
            type="text"
            placeholder="Search by name, chest no., or team…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#13111C] border border-[#2D283E] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 transition-all shadow-inner"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Row 2: Dropdown filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Group dropdown */}
          <div className="relative group">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 ml-1">Group</label>
            <div className="relative">
              <select
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
                className="w-full appearance-none bg-[#13111C] border border-[#2D283E] text-sm text-gray-200 rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:border-purple-500 cursor-pointer transition-all hover:border-gray-600 shadow-inner"
              >
                {groupOptions.map(g => (
                  <option key={g} value={g} className="bg-[#1A1825]">{g}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-purple-400 pointer-events-none transition-transform" />
            </div>
          </div>

          {/* Language dropdown */}
          <div className="relative group">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 ml-1">Language</label>
            <div className="relative">
              <select
                value={filterLanguage}
                onChange={e => handleLanguageChange(e.target.value)}
                className="w-full appearance-none bg-[#13111C] border border-[#2D283E] text-sm text-gray-200 rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:border-purple-500 cursor-pointer transition-all hover:border-gray-600 shadow-inner"
              >
                {languageOptions.map(l => (
                  <option key={l} value={l} className="bg-[#1A1825]">{l}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-purple-400 pointer-events-none transition-transform" />
            </div>
          </div>

          {/* Program dropdown — filtered by language */}
          <div className="relative group">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 ml-1">
              Program {filterLanguage !== 'All' && <span className="text-purple-400 normal-case ml-1 font-medium">({filterLanguage})</span>}
            </label>
            <div className="relative">
              <select
                value={filterProgram}
                onChange={e => setFilterProgram(e.target.value)}
                className="w-full appearance-none bg-[#13111C] border border-[#2D283E] text-sm text-gray-200 rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:border-purple-500 cursor-pointer transition-all hover:border-gray-600 shadow-inner"
              >
                {programOptions.map(opt => (
                  <option key={opt.id} value={opt.id} className="bg-[#1A1825]">{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-purple-400 pointer-events-none transition-transform" />
            </div>
          </div>
        </div>
      </div>



      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
              {f.label}
              <button onClick={f.clear}><X size={11} /></button>
            </span>
          ))}
          <button
            onClick={() => { setFilterGroup('All'); handleLanguageChange('All'); }}
            className="text-xs text-gray-500 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 px-3 py-1 rounded-full transition-all"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-2xl overflow-hidden shadow-xl">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 px-6 border-b border-[#2D283E] bg-[#13111C] text-[11px] uppercase tracking-widest font-bold text-gray-400">
          <div className="col-span-1">#</div>
          <button className="col-span-3 flex items-center gap-1 hover:text-purple-400 transition text-left" onClick={() => toggleSort('name')}>
            Name <SortIcon col="name" />
          </button>
          <button className="col-span-2 flex items-center gap-1 hover:text-purple-400 transition" onClick={() => toggleSort('chest')}>
            Chest <SortIcon col="chest" />
          </button>
          <div className="col-span-2">Team / Group</div>
          <div className="col-span-2 text-center">Programs Scored</div>
          <button className="col-span-2 flex items-center gap-1 hover:text-purple-400 transition justify-end" onClick={() => toggleSort('score')}>
            Total Pts <SortIcon col="score" />
          </button>
        </div>

        {/* Rows */}
        {loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600">
            <RefreshCw size={40} className="animate-spin mb-4 text-purple-500/30" />
            <p className="font-medium tracking-wide">Fetching mark data from server…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600">
            <Users size={48} className="mb-4 text-purple-500/20" />
            <p className="font-medium tracking-wide">No participants match your criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2D283E]">
            {filtered.map((p, idx) => (
              <div key={p.id}>
                {/* Main row */}
                <div
                  className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4 p-4 px-6 hover:bg-[#252236] transition-all cursor-pointer items-center group/row"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  {/* # */}
                  <div className="hidden md:block col-span-1 text-gray-600 text-xs font-mono">{idx + 1}</div>

                  {/* Name + avatar */}
                  <div className="col-span-2 md:col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 border border-white/10 shadow-lg">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-gray-200 font-bold text-sm group-hover/row:text-white transition-colors">{p.name}</div>
                      <div className="text-gray-500 text-[10px] md:hidden">#{p.chestNumber} · {p.team}</div>
                    </div>
                  </div>

                  {/* Chest */}
                  <div className="hidden md:block col-span-2 font-mono text-purple-300 font-bold text-xs group-hover/row:text-purple-300 transition-colors">
                    {p.chestNumber}
                  </div>

                  {/* Team / Group */}
                  <div className="hidden md:flex col-span-2 flex-col gap-1">
                    <span className="text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-md w-fit uppercase tracking-tighter">
                      {p.team}
                    </span>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-md w-fit uppercase tracking-tighter">
                      {p.group}
                    </span>
                  </div>

                  {/* Programs scored */}
                  <div className="hidden md:block col-span-2 text-center text-sm">
                    {p.marks.length > 0
                      ? <span className="text-[11px] font-bold bg-[#13111C] border border-[#2D283E] text-green-400 px-3 py-1 rounded-lg">
                          {p.marks.length} Mark{p.marks.length !== 1 ? 's' : ''}
                        </span>
                      : <span className="text-[11px] font-bold text-gray-600 bg-white/5 px-3 py-1 rounded-lg italic lowercase">
                          None
                        </span>}
                  </div>

                  {/* Total score + expand */}
                  <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-3">
                    <div className={`font-black text-xl tabular-nums tracking-tighter ${p.totalScore > 0 ? 'text-purple-400' : 'text-gray-600'}`}>
                      {p.totalScore}
                      <span className="text-[10px] text-gray-500 font-bold ml-1 uppercase">pts</span>
                    </div>
                    <span className={`text-gray-600 group-hover/row:text-gray-400 transition-all duration-200 ${expandedId === p.id ? 'rotate-180 text-purple-500' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </div>

                {/* Expanded breakdown — two quick-action buttons */}
                {expandedId === p.id && (() => {
                  // Programs this participant is registered in
                  const cachedP = cachedParticipants.find((cp: any) => cp._id === p.id);
                  const registeredProgramIds: string[] = cachedP?.programs?.map((x: any) =>
                    typeof x === 'string' ? x : x._id
                  ) ?? [];
                  const registeredPrograms = programs.filter((pr: any) =>
                    registeredProgramIds.includes(pr._id)
                  );

                  return (
                    <div className="px-6 pb-6 pt-2 bg-[#13111C]/50 border-t border-[#2D283E] animate-in slide-in-from-top-2 duration-300">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-4 font-black">
                        Management Actions
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {/* Button 1 — Participant Programs */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setModalInfo({
                              title: `${p.name}'s Programs`,
                              subtitle: `${registeredPrograms.length} program${registeredPrograms.length !== 1 ? 's' : ''} registered`,
                              items: registeredPrograms.length > 0
                                ? registeredPrograms.map((pr: any) => {
                                    // Calculate total marks for THIS program
                                    const programMarks = p.marks.filter(m => m.programName === pr.name);
                                    const totalMarks = programMarks.reduce((sum, m) => sum + m.marksGiven, 0);

                                    // Lookup official rank in this program
                                    const results = allResults[pr._id] || [];
                                    const myRes = results.find((r: any) => r.participantId?._id === p.id);
                                    
                                    return {
                                      label: pr.name,
                                      sub: [pr.language, pr.groupId?.name].filter(Boolean).join(' · '),
                                      value: totalMarks, // Show total mark
                                      accent: 'blue',
                                      rank: myRes?.position,
                                    };
                                  })
                                : [{ label: 'No programs registered yet', accent: 'gray' }],
                            });
                          }}
                          className="bg-[#2D283E] hover:bg-purple-600 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 group/btn"
                        >
                          <BookOpen size={14} className="text-purple-400 group-hover/btn:text-white" />
                          Participant Programs
                        </button>

                        {/* Button 2 — Positions */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            
                            // 1. Identify programs where this participant secured 1st, 2nd, or 3rd
                            const rankedItems: any[] = [];
                            
                            // Check results for each program
                            Object.entries(allResults).forEach(([progId, results]: [string, any]) => {
                                const myRes = results.find((r: any) => r.participantId?._id === p.id);
                                if (myRes && (myRes.position === 1 || myRes.position === 2 || myRes.position === 3)) {
                                    const prog = programs.find((pr: any) => pr._id === progId);
                                    if (prog) {
                                        rankedItems.push({
                                            label: prog.name,
                                            sub: [prog.language, prog.groupId?.name].filter(Boolean).join(' · '),
                                            value: myRes.positionPoints, // points earned for this position
                                            accent: 'purple',
                                            rank: myRes.position,
                                        });
                                    }
                                }
                            });

                            setModalInfo({
                              title: `${p.name}'s Positions`,
                              subtitle: `${rankedItems.length} top-3 finish${rankedItems.length !== 1 ? 'es' : ''}`,
                              items: rankedItems.length > 0
                                ? rankedItems.sort((a, b) => (a.rank || 4) - (b.rank || 4)) // Sort by rank
                                : [{ label: 'No top-3 positions secured yet', accent: 'gray' }],
                            });
                          }}
                          className="bg-[#2D283E] hover:bg-purple-600 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 group/btn"
                        >
                          <Trophy size={14} className="text-purple-400 group-hover/btn:text-white" />
                          Positions
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal (Premium Design matched to Participants Tab) ────────────────────── */}
      {modalInfo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onClick={() => setModalInfo(null)}
        >
          {/* Backdrop with heavy blur */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" />

          {/* Panel: Styled like Participants Tab Modal */}
          <div
            className="relative z-10 w-full max-w-lg bg-[#1E1B2E] border border-[#2D283E] rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header: Matching Participants Tab */}
            <div className="relative p-8 pb-6 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-[#2D283E]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white font-bold text-2xl tracking-tight leading-none uppercase italic flex items-center gap-2">
                    {modalInfo.title}
                  </h2>
                  <p className="text-gray-400 text-sm mt-3 font-medium">
                    {modalInfo.subtitle}
                  </p>
                </div>
                <button
                  onClick={() => setModalInfo(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Items list with Participants Tab item styling */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar bg-[#0F0D15]/30">
              {modalInfo.items.map((item, i) => {
                const isRanked = !!item.rank;
                const rankStyles = {
                  1: { 
                    bg: 'bg-yellow-500/10', 
                    border: 'border-yellow-500/30', 
                    text: 'text-yellow-400', 
                    grad: 'from-yellow-400 to-yellow-600', 
                    icon: <Crown size={16} className="text-yellow-400 fill-yellow-400/20" />,
                    label: '1st Place'
                  },
                  2: { 
                    bg: 'bg-slate-300/10', 
                    border: 'border-slate-300/30', 
                    text: 'text-slate-300', 
                    grad: 'from-slate-200 to-slate-400', 
                    icon: <Medal size={16} className="text-slate-300 fill-slate-300/20" />,
                    label: '2nd Place'
                  },
                  3: { 
                    bg: 'bg-orange-500/10', 
                    border: 'border-orange-500/30', 
                    text: 'text-orange-400', 
                    grad: 'from-orange-400 to-orange-700', 
                    icon: <Medal size={16} className="text-orange-400 fill-orange-400/20" />,
                    label: '3rd Place'
                  }
                }[item.rank as 1 | 2 | 3] || null;

                return (
                  <div
                    key={i}
                    className="group relative flex items-center justify-between p-4 rounded-2xl bg-[#13111C] border border-[#2D283E] hover:border-purple-500/30 transition-all duration-300"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      {/* Rank Indicator (Badge) */}
                      {rankStyles && (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold mb-2 border ${rankStyles.border} ${rankStyles.bg} ${rankStyles.text}`}>
                          {rankStyles.icon}
                          {rankStyles.label}
                        </div>
                      )}

                      <div className="text-white text-base font-bold tracking-tight truncate group-hover:text-purple-400 transition-colors">
                        {item.label}
                      </div>

                      {item.sub && (
                        <div className="text-gray-500 text-xs mt-1 truncate flex items-center gap-1.5 font-medium">
                          <User size={10} className="text-purple-500/60" /> {item.sub}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Score Value (if any) */}
                      {item.value !== undefined && (
                        <div className={`text-xl font-black tabular-nums bg-clip-text text-transparent bg-gradient-to-br ${item.accent === 'purple' ? 'from-purple-400 to-indigo-500' : 'from-blue-400 to-cyan-500'}`}>
                          {item.value}
                          <span className="text-[10px] text-gray-600 font-bold ml-1 uppercase tracking-tighter">pts</span>
                        </div>
                      )}
                      
                      {/* Status indicator when not ranked */}
                      {!isRanked && item.accent !== 'gray' && (
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-0.5 rounded bg-[#1E1B2E]">Assigned</span>
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        </div>
                      )}

                      {/* Rank icon in corner of value */}
                      {isRanked && !item.value && (
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg ${rankStyles?.border} ${rankStyles?.bg}`}>
                            {rankStyles?.icon}
                         </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with matching button style */}
            <div className="p-6 border-t border-[#2D283E] bg-[#13111C]/50 flex justify-end">
              <button
                onClick={() => setModalInfo(null)}
                className="px-8 py-3 rounded-xl bg-[#2D283E] hover:bg-purple-600 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePrograms, useGroups, useIndividualRankings, useParticipantResults } from '@/lib/queries';
import {
  Search, ChevronDown, ChevronUp, User,
  X, RefreshCw, Users, BookOpen, Trophy, 
  Crown, Medal, ChevronLeft, ChevronRight, SlidersHorizontal, Award
} from 'lucide-react';

// ─── Component ────────────────────────────────────────────────────────────────
export default function IndividualMarksPage() {
  const { data: programs = [] as any[] } = usePrograms();
  const { data: groups = [] as any[] } = useGroups();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterGroup, setFilterGroup]     = useState('All');
  
  const [page, setPage] = useState(1);
  const limit = 50;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state: null = closed
  const [modalInfo, setModalInfo] = useState<{
    type?: 'programs' | 'awards';
    title: string;
    subtitle: string;
    participant?: {
      name: string;
      chestNumber: string | number;
      teamName: string;
      groupName: string;
      totalScore: number;
      rank?: number;
      posPoints: number;
      gradeBonus: number;
      totalAwardsCount: number;
      goldCount: number;
      initials: string;
      festTag?: string;
    };
    items: {
      id?: string;
      label: string;
      sub?: string;
      value?: string | number;
      accent?: string;
      rank?: number | null;
      hasPosition?: boolean;
      positionPoints?: number;
      grade?: string | null;
      gradePoints?: number;
      percentage?: number | null;
      isGroupProgram?: boolean;
      valueUnit?: string;
      programCode?: string;
    }[];
  } | null>(null);

  const [awardTab, setAwardTab] = useState<'all' | 'gold' | 'grades'>('all');
  const [awardSort, setAwardSort] = useState<'highest' | 'rank' | 'name'>('highest');
  const [programTab, setProgramTab] = useState<'all' | 'grades' | 'group'>('all');
  const [programSort, setProgramSort] = useState<'highest' | 'name' | 'code'>('highest');

  const { filteredAwards, awardsAllCount, awardsGoldCount, awardsGradesCount } = useMemo(() => {
    if (!modalInfo || modalInfo.type !== 'awards') {
      return {
        filteredAwards: modalInfo?.items || [],
        awardsAllCount: modalInfo?.items?.length || 0,
        awardsGoldCount: 0,
        awardsGradesCount: 0,
      };
    }

    const validItems = modalInfo.items.filter(item => item.accent !== 'gray');
    const allCount = validItems.length;
    const goldCount = validItems.filter(item => item.rank === 1).length;
    const gradesCount = validItems.filter(item => (item.gradePoints || 0) > 0).length;

    let list = [...validItems];
    if (awardTab === 'gold') {
      list = list.filter(item => item.rank === 1);
    } else if (awardTab === 'grades') {
      list = list.filter(item => (item.gradePoints || 0) > 0);
    }

    if (awardSort === 'highest') {
      list.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    } else if (awardSort === 'rank') {
      list.sort((a, b) => {
        const rankA = a.hasPosition ? (a.rank ?? 999) : 999;
        const rankB = b.hasPosition ? (b.rank ?? 999) : 999;
        if (rankA !== rankB) return rankA - rankB;
        return (Number(b.value) || 0) - (Number(a.value) || 0);
      });
    } else if (awardSort === 'name') {
      list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }

    return {
      filteredAwards: list,
      awardsAllCount: allCount,
      awardsGoldCount: goldCount,
      awardsGradesCount: gradesCount,
    };
  }, [modalInfo, awardTab, awardSort]);

  const { filteredPrograms, programsAllCount, programsGradesCount, programsGroupCount } = useMemo(() => {
    if (!modalInfo || modalInfo.type !== 'programs') {
      return {
        filteredPrograms: modalInfo?.items || [],
        programsAllCount: modalInfo?.items?.length || 0,
        programsGradesCount: 0,
        programsGroupCount: 0,
      };
    }

    const validItems = modalInfo.items.filter(item => item.accent !== 'gray');
    const allCount = validItems.length;
    const gradesCount = validItems.filter(item => item.grade != null).length;
    const groupCount = validItems.filter(item => item.isGroupProgram).length;

    let list = [...validItems];
    if (programTab === 'grades') {
      list = list.filter(item => item.grade != null);
    } else if (programTab === 'group') {
      list = list.filter(item => item.isGroupProgram);
    }

    if (programSort === 'highest') {
      list.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    } else if (programSort === 'name') {
      list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    } else if (programSort === 'code') {
      list.sort((a, b) => (a.programCode || '').localeCompare(b.programCode || ''));
    }

    return {
      filteredPrograms: list,
      programsAllCount: allCount,
      programsGradesCount: gradesCount,
      programsGroupCount: groupCount,
    };
  }, [modalInfo, programTab, programSort]);

  // Debounce Search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== searchInput) {
        setSearch(searchInput);
        setPage(1); // Reset page on search change
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, search]);

  // Reset page on category change
  const handleGroupChange = (newGroup: string) => {
    setFilterGroup(newGroup);
    setPage(1);
  };

  // Fetch paginated rankings from the server
  const selectedGroup = groups.find((g: any) => g.name === filterGroup);
  const groupIdForApi = filterGroup === 'All' ? 'All' : (selectedGroup?._id || 'All');

  const { data: rankingData, isLoading: rankingLoading, isFetching: rankingFetching } = useIndividualRankings(groupIdForApi, page, limit, search);
  
  const participants = rankingData?.participants || [];
  const total = rankingData?.total || 0;
  const totalPages = rankingData?.totalPages || 1;

  // Fetch specific participant results when expanded
  const { data: participantDetails, isLoading: detailsLoading } = useParticipantResults(expandedId);

  // ── Filter option derivations ──────────────────────────────────────────────
  const groupOptions = ['All', ...groups.map((g: any) => g.name)];

  const activeFilters = [
    filterGroup !== 'All' && { label: `Group: ${filterGroup}`, clear: () => handleGroupChange('All') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const loading = rankingLoading || rankingFetching;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  const hasActiveFilter = filterGroup !== 'All';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 py-2">
        <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 tracking-tight">
          Individual Rankings
        </h1>
        <div className="flex items-center gap-3">
          {loading && (
            <RefreshCw size={14} className="animate-spin text-purple-400" />
          )}
          <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg font-semibold">
            {total}
          </span>
        </div>
      </div>

      {/* Compact Search Bar with inline filter icon */}
      <div className="relative flex items-center gap-0 bg-[#131020] border border-[#1F1C2C] rounded-2xl px-4 py-2.5 focus-within:border-[#9333EA]/60 transition-all shadow-lg">
        <Search className="text-[#717B8F] shrink-0 mr-3" size={18} />
        <input
          type="text"
          placeholder="Search by name or chest no.…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-[#717B8F] min-w-0"
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')} className="shrink-0 mr-1 text-[#717B8F] hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}

        {/* Filter icon button */}
        <div ref={filterRef} className="relative shrink-0 ml-2">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
              isFilterOpen || hasActiveFilter
                ? 'bg-[#9333EA]/20 text-[#A855F7] border border-[#9333EA]/40'
                : 'text-[#717B8F] hover:text-white hover:bg-white/10'
            }`}
            aria-label="Filter by group"
            title="Filter by group"
          >
            <SlidersHorizontal size={16} />
            {hasActiveFilter && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#9333EA] rounded-full border border-[#131020]"></span>
            )}
          </button>

          {/* Filter Popover */}
          {isFilterOpen && (
            <div className="absolute top-12 right-0 w-56 bg-[#131020]/95 backdrop-blur-2xl border border-[#1F1C2C] rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-[0.15em]">Filter</span>
                {hasActiveFilter && (
                  <button
                    onClick={() => { handleGroupChange('All'); }}
                    className="text-[10px] text-[#717B8F] hover:text-[#A855F7] font-bold uppercase tracking-wider transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#717B8F] uppercase tracking-widest block">Group</label>
                <div className="relative">
                  <select
                    value={filterGroup}
                    onChange={e => handleGroupChange(e.target.value)}
                    className="appearance-none w-full bg-[#0E0B1C] text-gray-300 border border-[#25213B] hover:border-[#3D365E] rounded-xl pl-3 pr-8 py-2 text-xs font-bold focus:outline-none focus:border-[#9333EA] transition-colors cursor-pointer"
                  >
                    {groupOptions.map(g => (
                      <option key={g} value={g} className="bg-[#171525]">{g}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717B8F] pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 mb-2 text-[#717B8F] text-[11px] font-bold uppercase tracking-wider items-center">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Participant Name</div>
          <div className="col-span-2">Chest No.</div>
          <div className="col-span-3">Team / Group</div>
          <div className="col-span-2 text-right">Total Points</div>
        </div>

        {/* Rows */}
        {loading && participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#717B8F] bg-[#131020]/60 rounded-2xl border border-[#1F1C2C]">
            <RefreshCw size={40} className="animate-spin mb-4 text-[#9333EA]/40" />
            <p className="font-medium tracking-wide">Fetching rankings from server…</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#717B8F] bg-[#131020]/60 rounded-2xl border border-[#1F1C2C]">
            <Users size={48} className="mb-4 text-[#9333EA]/30" />
            <p className="font-medium tracking-wide">No participants match your criteria.</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-2.5">
            {participants.map((p: any, idx: number) => {
              const borderAccents = ['border-l-[#9333EA]', 'border-l-[#F59E0B]', 'border-l-[#6366F1]', 'border-l-[#A855F7]'];
              const leftBorderClass = borderAccents[idx % borderAccents.length];
              
              return (
              <div key={p._id} className={`card-animate bg-[#131020] border-t border-r border-b border-[#1F1C2C] border-l-2 ${leftBorderClass} rounded-2xl hover:bg-[#171527] transition-colors group/row shadow-sm overflow-hidden`} style={{ animationDelay: `${idx * 20}ms` }}>
                {/* Main row */}
                <div
                  className="grid grid-cols-2 md:grid-cols-12 gap-1.5 md:gap-4 px-3 py-2 md:px-6 md:py-4 cursor-pointer items-center"
                  onClick={() => setExpandedId(expandedId === p._id ? null : p._id)}
                >
                  {/* Rank */}
                  <div className="hidden md:flex col-span-1 items-center gap-2">
                    <span className={`text-sm font-bold ${p.rank === 1 ? 'text-[#FBBF24]' : p.rank === 2 ? 'text-slate-300' : p.rank === 3 ? 'text-amber-500' : 'text-[#717B8F]'}`}>
                      #{p.rank}
                    </span>
                  </div>

                  {/* Name + avatar */}
                  <div className="col-span-2 md:col-span-4 flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#171525] border border-[#25213B] flex items-center justify-center text-xs md:text-sm font-bold text-gray-300 font-mono shadow-inner shrink-0">
                      {p.chestNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="text-gray-100 font-bold text-xs md:text-sm group-hover/row:text-purple-300 transition-colors truncate">{p.name}</div>
                      <div className="text-[#717B8F] text-[9px] md:hidden truncate">#{p.chestNumber} · {p.teamId?.name || '—'}</div>
                    </div>
                  </div>

                  {/* Chest */}
                  <div className="hidden md:block col-span-2 font-mono text-[#9EA5B2] font-bold text-xs group-hover/row:text-gray-200 transition-colors">
                    {p.chestNumber}
                  </div>

                  {/* Team / Group */}
                  <div className="hidden md:flex col-span-3 flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-gray-300 truncate">
                      {p.teamId?.name || '—'}
                    </span>
                    <span className="text-[10px] font-medium text-[#717B8F] truncate">
                      {p.groupId?.name || '—'}
                    </span>
                  </div>

                  {/* Total score + expand */}
                  <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-2 md:gap-3">
                    <div className={`font-black text-base md:text-xl tabular-nums tracking-tighter ${p.totalScore > 0 ? 'text-[#FBBF24]' : 'text-gray-600'}`}>
                      {p.totalScore}
                    </div>
                    <span className={`text-[#717B8F] group-hover/row:text-purple-400 transition-all duration-200 ${expandedId === p._id ? 'rotate-180 text-[#9333EA]' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </div>

                {/* Expanded breakdown */}
                {expandedId === p._id && (
                  <div className="px-3 pb-4 pt-2 md:px-6 md:pb-6 border-t border-[#1F1C2C] animate-in slide-in-from-top-2 duration-300 bg-[#0E0B1C]/50">
                    {detailsLoading ? (
                       <div className="py-8 flex justify-center"><RefreshCw size={24} className="animate-spin text-purple-500/50" /></div>
                    ) : (
                    <>
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-4 font-black">
                        Management Actions
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {/* Button 1 — Participant Programs (from marks) */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            
                            // Map over marks to summarize participant programs
                            const marks = participantDetails?.marks || [];
                            const results = participantDetails?.results || [];
                            const programMap = new Map();
                            marks.forEach((m: any) => {
                                const progId = typeof m.programId === 'object' ? m.programId._id : m.programId;
                                const prog = m.programId;
                                if (!programMap.has(progId)) {
                                    programMap.set(progId, {
                                        id: String(progId),
                                        label: prog?.name || 'Unknown',
                                        sub: prog?.language,
                                        isGroupProgram: prog?.isConversation,
                                        value: 0,
                                        accent: 'blue',
                                        valueUnit: 'marks',
                                        grade: null,
                                        gradePoints: 0,
                                        percentage: null,
                                        programCode: prog?.code || (prog?._id ? String(prog._id).slice(-3) : ''),
                                    });
                                }
                                const existing = programMap.get(progId);
                                existing.value += (m.marksGiven || 0);
                            });

                            // Enrich with grade information from ProgramResults if available
                            results.forEach((r: any) => {
                              const rProgId = typeof r.programId === 'object' ? r.programId?._id : r.programId;
                              if (rProgId && programMap.has(String(rProgId))) {
                                const existing = programMap.get(String(rProgId));
                                existing.grade = r.grade || null;
                                existing.gradePoints = r.gradePoints || 0;
                                existing.percentage = r.percentage ?? null;
                                existing.rank = r.position ?? null;
                                existing.hasPosition = r.position !== null && r.position !== undefined && Number(r.position) > 0;
                                existing.positionPoints = r.positionPoints || 0;
                              }
                            });

                            const items = Array.from(programMap.values());

                            const nameTrimmed = (p.name || '').trim();
                            const nameParts = nameTrimmed.split(/\s+/);
                            const firstName = nameParts[0] || 'Participant';
                            const initials = nameParts.length >= 2 
                              ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                              : firstName.slice(0, 2).toUpperCase();
                            const festTag = (firstName.length >= 3 ? firstName.slice(0, 3) : firstName).toUpperCase();

                            const totalMarksSum = items.reduce((sum: number, it: any) => sum + (Number(it.value) || 0), 0);
                            const totalGradeBonusSum = items.reduce((sum: number, it: any) => sum + (it.gradePoints || 0), 0);
                            const gradedCount = items.filter((it: any) => it.grade != null).length;

                            setProgramTab('all');
                            setProgramSort('highest');
                            setModalInfo({
                              type: 'programs',
                              title: `${firstName}'s Programs`,
                              subtitle: 'Festival Competitions 2026',
                              participant: {
                                name: p.name,
                                chestNumber: p.chestNumber,
                                teamName: p.teamId?.name || 'Senior Arts & Cultural Delegation',
                                groupName: p.groupId?.name || 'All-Stars Division',
                                totalScore: p.totalScore || totalGradeBonusSum,
                                rank: p.rank,
                                posPoints: totalMarksSum,
                                gradeBonus: totalGradeBonusSum,
                                totalAwardsCount: items.length,
                                goldCount: gradedCount,
                                initials: initials,
                                festTag: festTag,
                              },
                              items: items.length > 0
                                ? items
                                : [{ label: 'No programs scored yet', accent: 'gray' }],
                            });
                          }}
                          className="bg-[#171525] hover:bg-[#25213B] text-purple-300 hover:text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 group/btn border border-[#25213B]"
                        >
                          <BookOpen size={14} />
                          Participant Programs
                        </button>

                        {/* Button 2 — Positions & Awards (from ProgramResults) */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            
                            const results = participantDetails?.results || [];
                            const awardedItems = results
                                .filter((r: any) => (Number(r.positionPoints) || 0) > 0 || (Number(r.gradePoints) || 0) > 0)
                                .map((r: any) => {
                                  const prog = r.programId;
                                  const posPts = Number(r.positionPoints) || 0;
                                  const grPts = Number(r.gradePoints) || 0;
                                  const hasPosition = r.position !== null && r.position !== undefined && Number(r.position) > 0;
                                  const rProgId = typeof prog === 'object' ? prog?._id : prog;
                                  return {
                                    id: r._id ? String(r._id) : (rProgId ? String(rProgId) : undefined),
                                    label: prog?.name || 'Unknown',
                                    sub: prog?.language,
                                    value: posPts + grPts,
                                    valueUnit: 'pts',
                                    accent: 'purple',
                                    rank: hasPosition ? Number(r.position) : null,
                                    hasPosition,
                                    positionPoints: posPts,
                                    grade: r.grade || null,
                                    gradePoints: grPts,
                                    percentage: r.percentage !== null && r.percentage !== undefined ? Number(r.percentage) : null,
                                    isGroupProgram: prog?.isConversation,
                                    programCode: prog?.code || (prog?._id ? String(prog._id).slice(-3) : ''),
                                  };
                                })
                                .sort((a: any, b: any) => {
                                  const rankA = a.hasPosition ? a.rank : 999;
                                  const rankB = b.hasPosition ? b.rank : 999;
                                  if (rankA !== rankB) return rankA - rankB;
                                  return (b.value || 0) - (a.value || 0);
                                });

                            const posCount = awardedItems.filter((r: any) => r.hasPosition && (r.positionPoints || 0) > 0).length;
                            const gradeCount = awardedItems.filter((r: any) => (r.gradePoints || 0) > 0).length;
                            const goldCount = awardedItems.filter((r: any) => r.hasPosition && r.rank === 1).length;
                            const posPointsTotal = awardedItems.reduce((sum: number, r: any) => sum + (r.positionPoints || 0), 0);
                            const gradePointsTotal = awardedItems.reduce((sum: number, r: any) => sum + (r.gradePoints || 0), 0);

                            const nameTrimmed = (p.name || '').trim();
                            const nameParts = nameTrimmed.split(/\s+/);
                            const firstName = nameParts[0] || 'Participant';
                            const initials = nameParts.length >= 2 
                              ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                              : firstName.slice(0, 2).toUpperCase();
                            const festTag = (firstName.length >= 3 ? firstName.slice(0, 3) : firstName).toUpperCase();

                            setAwardTab('all');
                            setAwardSort('highest');
                            setModalInfo({
                              type: 'awards',
                              title: `${firstName}'s Positions & Awards`,
                              subtitle: 'Festival Competitions 2026',
                              participant: {
                                name: p.name,
                                chestNumber: p.chestNumber,
                                teamName: p.teamId?.name || 'Senior Arts & Cultural Delegation',
                                groupName: p.groupId?.name || 'All-Stars Division',
                                totalScore: p.totalScore || (posPointsTotal + gradePointsTotal),
                                rank: p.rank,
                                posPoints: posPointsTotal,
                                gradeBonus: gradePointsTotal,
                                totalAwardsCount: awardedItems.length,
                                goldCount: goldCount,
                                initials: initials,
                                festTag: festTag,
                              },
                              items: awardedItems.length > 0
                                ? awardedItems
                                : [{ label: 'No positions or grade awards earned yet', accent: 'gray' }],
                            });
                          }}
                          className="bg-[#521887]/30 hover:bg-[#521887] text-purple-200 hover:text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 group/btn border border-purple-500/40"
                        >
                          <Trophy size={14} />
                          Positions & Awards
                        </button>
                      </div>
                    </>
                    )}
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
           <div className="flex items-center justify-between px-2 py-4 mt-6 border-t border-[#1F1C2C]">
             <button 
               onClick={() => setPage(p => Math.max(1, p - 1))}
               disabled={page === 1}
               className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-300 bg-[#131020] border border-[#1F1C2C] rounded-xl hover:bg-[#171525] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
               <ChevronLeft size={16} /> Previous
             </button>
             <span className="text-sm text-[#717B8F] font-medium tracking-wide">
               Page {page} of {totalPages}
             </span>
             <button 
               onClick={() => setPage(p => Math.min(totalPages, p + 1))}
               disabled={page >= totalPages}
               className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-300 bg-[#131020] border border-[#1F1C2C] rounded-xl hover:bg-[#171525] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
               Next <ChevronRight size={16} />
             </button>
           </div>
        )}
      </div>

      {/* ── Modal (Cyber-Pass & Positions & Awards) ────────────────────── */}
      {modalInfo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          onClick={() => setModalInfo(null)}
        >
          {/* Backdrop with heavy blur */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" />

          {modalInfo.participant ? (
            /* 2-Column Cyber-Pass Layout Matching Reference Design (For both Awards and Programs) */
            <div
              className="relative z-10 w-full max-w-4xl lg:max-w-5xl bg-[#0E0B1C] border border-[#1F1C2C] rounded-[28px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Top Header */}
              <div className="px-6 py-4 md:px-8 md:py-5 border-b border-[#1F1C2C] flex items-center justify-between gap-4 shrink-0 bg-[#0E0B1C]">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#717B8F] font-medium tracking-wide">
                    {modalInfo.subtitle || 'Festival Competitions 2026'}
                  </p>
                  <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mt-0.5 truncate">
                    {modalInfo.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="bg-[#171525] border border-[#25213B] rounded-xl px-4 py-1.5 flex flex-col justify-center text-left">
                    <span className="text-[11px] text-[#9EA5B2] font-semibold leading-tight">
                      {modalInfo.participant.groupName}
                    </span>
                    <span className="text-[11px] text-[#717B8F] font-mono leading-tight">
                      {String(modalInfo.participant.chestNumber).padStart(2, '0')}
                    </span>
                  </div>
                  <button
                    onClick={() => setModalInfo(null)}
                    className="w-9 h-9 rounded-xl bg-[#171525] border border-[#25213B] flex items-center justify-center text-[#717B8F] hover:text-white hover:border-[#9333EA]/50 transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 2-Column Body */}
              <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden min-h-0">
                {/* Left Column: Cyber-Pass Card */}
                <div className="w-full md:w-[350px] lg:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-[#1F1C2C] p-6 md:p-8 flex flex-col justify-between space-y-6 overflow-y-auto custom-scrollbar">
                  <div>
                    {/* Card Subheader */}
                    <div className="flex items-center justify-between text-xs mb-4">
                      <span className="font-bold text-[#9EA5B2] tracking-wide">Cyber-Pass</span>
                      <span className="font-mono text-[#717B8F]">
                        #FEST-2026-{modalInfo.participant.festTag || modalInfo.participant.initials}
                      </span>
                    </div>

                    {/* Avatar, Name, Team */}
                    <div className="text-center my-4">
                      <div className="w-20 h-20 rounded-full bg-[#18152B] border-2 border-[#2B2646] flex items-center justify-center mx-auto text-xl font-bold text-white tracking-wider shadow-inner">
                        {modalInfo.participant.initials}
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-white mt-3 tracking-tight">
                        {modalInfo.participant.name}
                      </h3>
                      <p className="text-xs text-[#717B8F] font-medium mt-1">
                        {modalInfo.participant.teamName}
                      </p>
                    </div>

                    {/* Score Gauge & Breakdown */}
                    <div className="flex items-center justify-between gap-4 my-6">
                      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
                          <circle
                            cx="38"
                            cy="38"
                            r="31"
                            stroke="#272433"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="38"
                            cy="38"
                            r="31"
                            stroke="url(#modalPurpleGradient)"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 31}
                            strokeDashoffset={2 * Math.PI * 31 * (1 - Math.min(1, Math.max(0.15, (modalInfo.participant.totalScore || 0) / 40)) * 0.75)}
                            strokeLinecap="round"
                          />
                          <defs>
                            <linearGradient id="modalPurpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#9333EA" />
                              <stop offset="100%" stopColor="#6366F1" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-black text-white leading-none tracking-tight">
                            {modalInfo.participant.totalScore}
                          </span>
                          <span className="text-[9px] font-bold text-[#717B8F] tracking-wider mt-0.5">
                            PTS
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#717B8F] font-medium">
                            {modalInfo.type === 'awards' ? 'Positions:' : 'Programs Scored:'}
                          </span>
                          <span className="font-bold text-white tabular-nums">
                            {modalInfo.type === 'awards'
                              ? `+${modalInfo.participant.posPoints}`
                              : `${modalInfo.participant.totalAwardsCount}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#717B8F] font-medium">Grade Bonus:</span>
                          <span className="font-bold text-white tabular-nums">+{modalInfo.participant.gradeBonus}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#717B8F] font-medium">Standing:</span>
                          <span className="font-bold text-white">
                            {modalInfo.participant.rank === 1
                              ? 'Rank #1 Overall'
                              : modalInfo.participant.rank && modalInfo.participant.rank <= 3
                              ? 'Top 3 Podium'
                              : modalInfo.participant.rank && modalInfo.participant.rank <= 10
                              ? 'Top 5% Contender'
                              : 'Festival Contender'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Two Metric Stat Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-[#131020] border border-[#221C34] rounded-xl py-3 px-3 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#717B8F] mb-1">
                          {modalInfo.type === 'awards' ? 'TOTAL AWARDS' : 'TOTAL PROGRAMS'}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-white">
                            {modalInfo.participant.totalAwardsCount}
                          </span>
                          <span className="text-xs text-[#717B8F] font-medium">
                            {modalInfo.type === 'awards' ? 'Earned' : 'Evaluated'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-[#131020] border border-[#221C34] rounded-xl py-3 px-3 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#717B8F] mb-1">
                          {modalInfo.type === 'awards' ? 'GOLD TROPHIES' : 'GRADED EVENTS'}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-[#FBBF24]">
                            {modalInfo.participant.goldCount}
                          </span>
                          <span className="text-xs text-[#717B8F] font-medium">
                            {modalInfo.type === 'awards' ? 'Firsts' : 'Distinction'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Footer */}
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-[#9EA5B2] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block" />
                        Verified Festival Entry
                      </div>
                      <span className="font-bold text-white">Active</span>
                    </div>
                    <div className="h-px bg-[#1F1C2C] my-4" />
                    <p className="text-[10px] text-[#565D6C] font-medium">
                      Official cryptographic score hash verified.
                    </p>
                  </div>
                </div>

                {/* Right Column: Awards / Programs List */}
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between min-w-0">
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Filter Tabs & Sort Dropdown */}
                    <div className="flex items-center justify-between gap-4 mb-6 flex-wrap shrink-0">
                      {modalInfo.type === 'awards' ? (
                        <div className="bg-[#161323] border border-[#25213B] p-1 rounded-xl flex items-center gap-1">
                          <button
                            onClick={() => setAwardTab('all')}
                            className={`text-xs py-1.5 px-3.5 rounded-lg transition-all ${
                              awardTab === 'all'
                                ? 'bg-[#9333EA] text-white font-bold shadow-sm'
                                : 'text-[#717B8F] hover:text-white font-medium'
                            }`}
                          >
                            All ({awardsAllCount})
                          </button>
                          <button
                            onClick={() => setAwardTab('gold')}
                            className={`text-xs py-1.5 px-3.5 rounded-lg transition-all ${
                              awardTab === 'gold'
                                ? 'bg-[#9333EA] text-white font-bold shadow-sm'
                                : 'text-[#717B8F] hover:text-white font-medium'
                            }`}
                          >
                            Gold ({awardsGoldCount})
                          </button>
                          <button
                            onClick={() => setAwardTab('grades')}
                            className={`text-xs py-1.5 px-3.5 rounded-lg transition-all ${
                              awardTab === 'grades'
                                ? 'bg-[#9333EA] text-white font-bold shadow-sm'
                                : 'text-[#717B8F] hover:text-white font-medium'
                            }`}
                          >
                            Grades ({awardsGradesCount})
                          </button>
                        </div>
                      ) : (
                        <div className="bg-[#161323] border border-[#25213B] p-1 rounded-xl flex items-center gap-1">
                          <button
                            onClick={() => setProgramTab('all')}
                            className={`text-xs py-1.5 px-3.5 rounded-lg transition-all ${
                              programTab === 'all'
                                ? 'bg-[#9333EA] text-white font-bold shadow-sm'
                                : 'text-[#717B8F] hover:text-white font-medium'
                            }`}
                          >
                            All ({programsAllCount})
                          </button>
                          <button
                            onClick={() => setProgramTab('grades')}
                            className={`text-xs py-1.5 px-3.5 rounded-lg transition-all ${
                              programTab === 'grades'
                                ? 'bg-[#9333EA] text-white font-bold shadow-sm'
                                : 'text-[#717B8F] hover:text-white font-medium'
                            }`}
                          >
                            Grades ({programsGradesCount})
                          </button>
                          <button
                            onClick={() => setProgramTab('group')}
                            className={`text-xs py-1.5 px-3.5 rounded-lg transition-all ${
                              programTab === 'group'
                                ? 'bg-[#9333EA] text-white font-bold shadow-sm'
                                : 'text-[#717B8F] hover:text-white font-medium'
                            }`}
                          >
                            Group ({programsGroupCount})
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#717B8F] font-medium">Sort by:</span>
                        <div className="relative">
                          {modalInfo.type === 'awards' ? (
                            <select
                              value={awardSort}
                              onChange={e => setAwardSort(e.target.value as any)}
                              className="appearance-none bg-[#161323] text-white text-xs font-bold border border-[#25213B] rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:border-[#9333EA] transition-colors cursor-pointer"
                            >
                              <option value="highest" className="bg-[#161323] text-white">Highest Score</option>
                              <option value="rank" className="bg-[#161323] text-white">Position / Rank</option>
                              <option value="name" className="bg-[#161323] text-white">Program Name</option>
                            </select>
                          ) : (
                            <select
                              value={programSort}
                              onChange={e => setProgramSort(e.target.value as any)}
                              className="appearance-none bg-[#161323] text-white text-xs font-bold border border-[#25213B] rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:border-[#9333EA] transition-colors cursor-pointer"
                            >
                              <option value="highest" className="bg-[#161323] text-white">Highest Marks</option>
                              <option value="name" className="bg-[#161323] text-white">Program Name</option>
                              <option value="code" className="bg-[#161323] text-white">Program Code</option>
                            </select>
                          )}
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717B8F] pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Items Stack */}
                    <div className="flex-1 overflow-y-auto max-h-[50vh] pr-2 space-y-5 custom-scrollbar">
                      {(modalInfo.type === 'awards' ? filteredAwards : filteredPrograms).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-[#717B8F] text-center">
                          <Award size={36} className="mb-2 text-[#565D6C]" />
                          <p className="text-sm font-medium">No programs matching this filter.</p>
                        </div>
                      ) : (
                        (modalInfo.type === 'awards' ? filteredAwards : filteredPrograms).map((item, idx) => {
                          let statusText = '';
                          if (modalInfo.type === 'awards') {
                            if (item.hasPosition && item.rank === 1) {
                              statusText = item.grade
                                ? `1st Place Gold • Grade ${item.grade}${item.percentage != null ? ` (${item.percentage}%)` : ''}`
                                : '1st Place Winner';
                            } else if (item.hasPosition && item.rank === 2) {
                              statusText = item.grade
                                ? `2nd Place Silver • Grade ${item.grade}${item.percentage != null ? ` (${item.percentage}%)` : ''}`
                                : '2nd Place Winner';
                            } else if (item.hasPosition && item.rank === 3) {
                              statusText = item.grade
                                ? `3rd Place Bronze • Grade ${item.grade}${item.percentage != null ? ` (${item.percentage}%)` : ''}`
                                : '3rd Place Winner';
                            } else if (item.hasPosition && (item.rank || 0) > 3) {
                              statusText = `Rank #${item.rank}${item.grade ? ` • Grade ${item.grade}` : ''}`;
                            } else if (item.grade) {
                              statusText = `Grade ${item.grade} • Distinction${item.percentage != null ? ` (${item.percentage}%)` : ''}`;
                            } else {
                              statusText = 'Competitor';
                            }
                          } else {
                            if (item.grade) {
                              statusText = `Grade ${item.grade} • Distinction${item.percentage != null ? ` (${item.percentage}%)` : ''}`;
                            } else {
                              statusText = 'Evaluated by Judges';
                            }
                          }

                          const posPts = item.positionPoints || 0;
                          const grPts = item.gradePoints || 0;
                          let breakdownText = '';
                          if (modalInfo.type === 'awards') {
                            if (posPts > 0 && grPts > 0) {
                              breakdownText = `${posPts} pos + ${grPts} grade bonus`;
                            } else if (posPts > 0) {
                              breakdownText = 'Position points';
                            } else if (grPts > 0) {
                              breakdownText = 'Grade bonus';
                            }
                          } else {
                            if (grPts > 0) {
                              breakdownText = `+${grPts} championship bonus`;
                            } else {
                              breakdownText = 'Judge evaluation mark';
                            }
                          }

                          const programType = item.isGroupProgram ? 'Group Program' : 'Individual Program';
                          const subInfo = [item.sub, programType].filter(Boolean).join(' • ');
                          const stableKey = item.id || `${item.label}-${idx}`;

                          return (
                            <div key={stableKey} className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-[#9EA5B2] mb-1">
                                  {statusText}
                                </div>
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-base md:text-lg font-bold text-white tracking-tight">
                                    {item.label}
                                  </span>
                                  {item.programCode && (
                                    <span className="text-xs font-mono font-medium text-[#565D6C]">
                                      #{item.programCode}
                                    </span>
                                  )}
                                </div>
                                {subInfo && (
                                  <div className="text-xs text-[#717B8F] font-medium mt-1">
                                    {subInfo}
                                  </div>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <div className="flex items-baseline justify-end leading-none">
                                  <span className="text-2xl font-black text-white">
                                    {item.value || 0}
                                  </span>
                                  <span className="text-xs font-bold text-[#717B8F] ml-1">
                                    {modalInfo.type === 'awards' ? 'PTS' : 'MARKS'}
                                  </span>
                                </div>
                                {breakdownText && (
                                  <div className="text-[11px] text-[#717B8F] font-medium mt-1">
                                    {breakdownText}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Dismiss Button */}
                  <div className="mt-6 pt-4 border-t border-[#1F1C2C] flex justify-end shrink-0">
                    <button
                      onClick={() => setModalInfo(null)}
                      className="bg-[#521887] hover:bg-[#6820AA] text-white font-bold text-sm px-8 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Single-column Programs Modal for Participant Programs */
            <div
              className="relative z-10 w-full max-w-lg bg-[#0E0B1C] border border-[#1F1C2C] rounded-[28px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border-b border-[#1F1C2C] flex items-start justify-between shrink-0">
                <div>
                  <h2 className="text-white font-bold text-xl tracking-tight leading-none uppercase italic flex items-center gap-2">
                    {modalInfo.title}
                  </h2>
                  <p className="text-[#717B8F] text-sm mt-2 font-medium">
                    {modalInfo.subtitle}
                  </p>
                </div>
                <button
                  onClick={() => setModalInfo(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items list */}
              <div className="p-6 space-y-3 overflow-y-auto flex-1 custom-scrollbar bg-[#0E0B1C]/50">
                {modalInfo.items.map((item, i) => {
                  const stableKey = item.id ? item.id : `${item.label}-${i}`;
                  return (
                    <div
                      key={stableKey}
                      className="group relative flex items-start justify-between p-4 rounded-2xl bg-[#131020] border border-[#1F1C2C] hover:border-purple-500/30 transition-all duration-300"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-white text-base font-bold tracking-tight truncate group-hover:text-purple-400 transition-colors">
                          {item.label}
                        </div>
                        {item.sub && (
                          <div className="text-[#717B8F] text-xs mt-1 flex flex-col gap-1.5">
                            <span className="truncate flex items-center gap-1.5 font-medium">
                              <User size={10} className="text-purple-500/60" /> {item.sub}
                            </span>
                            {item.isGroupProgram !== undefined && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit flex items-center gap-1 ${item.isGroupProgram ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                                {item.isGroupProgram ? '🟣 Group Program' : 'Individual Program'}
                              </span>
                            )}
                          </div>
                        )}
                        {item.grade && (
                          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-2 text-xs">
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Award size={12} />
                              Grade {item.grade} Bonus: +{item.gradePoints || 0} championship pts
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
                        {item.value !== undefined && (
                          <div className="text-right">
                            <div className="text-xl font-black tabular-nums bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-cyan-500">
                              {item.value}
                              <span className="text-[10px] text-gray-500 font-bold ml-1 uppercase tracking-wider">
                                {item.valueUnit || 'marks'}
                              </span>
                            </div>
                            <span className="text-[9px] uppercase tracking-widest text-[#717B8F] font-semibold block text-right">
                              Judge Mark
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#1F1C2C] bg-[#131020]/50 flex justify-end shrink-0">
                <button
                  onClick={() => setModalInfo(null)}
                  className="px-6 py-2.5 rounded-xl bg-[#521887] hover:bg-[#6820AA] text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

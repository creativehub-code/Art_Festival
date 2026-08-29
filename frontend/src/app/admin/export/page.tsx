'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePrograms, useGroups, useIndividualRankings, useParticipantResults } from '@/lib/queries';
import {
  Search, ChevronDown, ChevronUp, User,
  X, RefreshCw, Users, BookOpen, Trophy, 
  Crown, Medal, ChevronLeft, ChevronRight
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
    title: string;
    subtitle: string;
    items: { label: string; sub?: string; value?: string | number; accent?: string; rank?: number; isGroupProgram?: boolean }[];
  } | null>(null);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            Individual Rankings
          </h1>
          <p className="text-gray-400 mt-1">
            Global and category-wise participant rankings
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg font-semibold">
            Total: {total}
          </span>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <RefreshCw size={12} className="animate-spin" /> Fetching rankings…
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
            placeholder="Search by name or chest no.…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#13111C] border border-[#2D283E] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 transition-all shadow-inner"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Row 2: Dropdown filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Group dropdown */}
          <div className="relative group">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 ml-1">Group Filter</label>
            <div className="relative">
              <select
                value={filterGroup}
                onChange={e => handleGroupChange(e.target.value)}
                className="w-full appearance-none bg-[#13111C] border border-[#2D283E] text-sm text-gray-200 rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:border-purple-500 cursor-pointer transition-all hover:border-gray-600 shadow-inner"
              >
                {groupOptions.map(g => (
                  <option key={g} value={g} className="bg-[#1A1825]">{g}</option>
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
            onClick={() => handleGroupChange('All')}
            className="text-xs text-gray-500 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 px-3 py-1 rounded-full transition-all"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 mb-2 text-gray-500 text-[11px] font-bold uppercase tracking-wider items-center">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Participant Name</div>
          <div className="col-span-2">Chest No.</div>
          <div className="col-span-3">Team / Group</div>
          <div className="col-span-2 text-right">Total Points</div>
        </div>

        {/* Rows */}
        {loading && participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
            <RefreshCw size={40} className="animate-spin mb-4 text-purple-500/30" />
            <p className="font-medium tracking-wide">Fetching rankings from server…</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
            <Users size={48} className="mb-4 text-purple-500/20" />
            <p className="font-medium tracking-wide">No participants match your criteria.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {participants.map((p: any, idx: number) => {
              const borderAccents = ['border-l-purple-500', 'border-l-amber-500', 'border-l-blue-500', 'border-l-indigo-500'];
              const leftBorderClass = borderAccents[idx % borderAccents.length];
              
              return (
              <div key={p._id} className={`card-animate bg-[#131629] border-t border-r border-b border-white/[0.06] border-l-2 ${leftBorderClass} rounded-xl hover:bg-[#161830] transition-colors group/row shadow-sm overflow-hidden`} style={{ animationDelay: `${idx * 20}ms` }}>
                {/* Main row */}
                <div
                  className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 cursor-pointer items-center"
                  onClick={() => setExpandedId(expandedId === p._id ? null : p._id)}
                >
                  {/* Rank */}
                  <div className="hidden md:flex col-span-1 items-center gap-2">
                    <span className={`text-sm font-bold ${p.rank === 1 ? 'text-yellow-400' : p.rank === 2 ? 'text-slate-300' : p.rank === 3 ? 'text-orange-400' : 'text-gray-500'}`}>
                      #{p.rank}
                    </span>
                  </div>

                  {/* Name + avatar */}
                  <div className="col-span-2 md:col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#111018] border border-gray-800 flex items-center justify-center text-sm font-bold text-gray-400 font-mono shadow-inner shrink-0">
                      {p.chestNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="text-gray-200 font-bold text-sm group-hover/row:text-purple-300 transition-colors truncate">{p.name}</div>
                      <div className="text-gray-500 text-[10px] md:hidden truncate">#{p.chestNumber} · {p.teamId?.name || '—'}</div>
                    </div>
                  </div>

                  {/* Chest */}
                  <div className="hidden md:block col-span-2 font-mono text-gray-400 font-bold text-xs group-hover/row:text-gray-300 transition-colors">
                    {p.chestNumber}
                  </div>

                  {/* Team / Group */}
                  <div className="hidden md:flex col-span-3 flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-gray-400 truncate">
                      {p.teamId?.name || '—'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 truncate">
                      {p.groupId?.name || '—'}
                    </span>
                  </div>

                  {/* Total score + expand */}
                  <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-3">
                    <div className={`font-black text-xl tabular-nums tracking-tighter ${p.totalScore > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                      {p.totalScore}
                    </div>
                    <span className={`text-gray-600 group-hover/row:text-gray-400 transition-all duration-200 ${expandedId === p._id ? 'rotate-180 text-purple-500' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </div>

                {/* Expanded breakdown */}
                {expandedId === p._id && (
                  <div className="px-6 pb-6 pt-2 border-t border-white/[0.06] animate-in slide-in-from-top-2 duration-300">
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
                            const programMap = new Map();
                            marks.forEach((m: any) => {
                                const progId = typeof m.programId === 'object' ? m.programId._id : m.programId;
                                const prog = m.programId;
                                if (!programMap.has(progId)) {
                                    programMap.set(progId, {
                                        label: prog?.name || 'Unknown',
                                        sub: prog?.language,
                                        isGroupProgram: prog?.isConversation,
                                        value: 0,
                                        accent: 'blue'
                                    });
                                }
                                const existing = programMap.get(progId);
                                existing.value += (m.marksGiven || 0);
                            });

                            const items = Array.from(programMap.values());

                            setModalInfo({
                              title: `${p.name}'s Programs`,
                              subtitle: `${items.length} program${items.length !== 1 ? 's' : ''} scored`,
                              items: items.length > 0
                                ? items
                                : [{ label: 'No programs scored yet', accent: 'gray' }],
                            });
                          }}
                          className="bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 group/btn border border-purple-500/20"
                        >
                          <BookOpen size={14} />
                          Participant Programs
                        </button>

                        {/* Button 2 — Positions (from ProgramResults) */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            
                            const results = participantDetails?.results || [];
                            const rankedItems = results.map((r: any) => {
                                const prog = r.programId;
                                return {
                                    label: prog?.name || 'Unknown',
                                    sub: prog?.language,
                                    value: r.positionPoints,
                                    accent: 'purple',
                                    rank: r.position,
                                    isGroupProgram: prog?.isConversation
                                };
                            }).sort((a: any, b: any) => (a.rank || 4) - (b.rank || 4));

                            setModalInfo({
                              title: `${p.name}'s Positions`,
                              subtitle: `${rankedItems.length} top finish${rankedItems.length !== 1 ? 'es' : ''}`,
                              items: rankedItems.length > 0
                                ? rankedItems
                                : [{ label: 'No positions secured yet', accent: 'gray' }],
                            });
                          }}
                          className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 group/btn border border-blue-500/20"
                        >
                          <Trophy size={14} />
                          Positions
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
           <div className="flex items-center justify-between px-2 py-4 mt-6 border-t border-white/5">
             <button 
               onClick={() => setPage(p => Math.max(1, p - 1))}
               disabled={page === 1}
               className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-300 bg-[#13111C] border border-[#2D283E] rounded-xl hover:bg-[#1E1B2E] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
               <ChevronLeft size={16} /> Previous
             </button>
             <span className="text-sm text-gray-500 font-medium tracking-wide">
               Page {page} of {totalPages}
             </span>
             <button 
               onClick={() => setPage(p => Math.min(totalPages, p + 1))}
               disabled={page >= totalPages}
               className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-300 bg-[#13111C] border border-[#2D283E] rounded-xl hover:bg-[#1E1B2E] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
               Next <ChevronRight size={16} />
             </button>
           </div>
        )}
      </div>

      {/* ── Modal (Premium Design) ────────────────────── */}
      {modalInfo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onClick={() => setModalInfo(null)}
        >
          {/* Backdrop with heavy blur */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-lg bg-[#1E1B2E] border border-[#2D283E] rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
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

            {/* Items list */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar bg-[#0F0D15]/30">
              {modalInfo.items.map((item, i) => {
                const isRanked = !!item.rank;
                const rankStyles = {
                  1: { 
                    bg: 'bg-yellow-500/10', 
                    border: 'border-yellow-500/30', 
                    text: 'text-yellow-400', 
                    icon: <Crown size={16} className="text-yellow-400 fill-yellow-400/20" />,
                    label: '1st Place'
                  },
                  2: { 
                    bg: 'bg-slate-300/10', 
                    border: 'border-slate-300/30', 
                    text: 'text-slate-300', 
                    icon: <Medal size={16} className="text-slate-300 fill-slate-300/20" />,
                    label: '2nd Place'
                  },
                  3: { 
                    bg: 'bg-orange-500/10', 
                    border: 'border-orange-500/30', 
                    text: 'text-orange-400', 
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
                        <div className="text-gray-500 text-xs mt-1 flex flex-col gap-1.5">
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
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.value !== undefined && (
                        <div className={`text-xl font-black tabular-nums bg-clip-text text-transparent bg-gradient-to-br ${item.accent === 'purple' ? 'from-purple-400 to-indigo-500' : 'from-blue-400 to-cyan-500'}`}>
                          {item.value}
                          <span className="text-[10px] text-gray-600 font-bold ml-1 uppercase tracking-tighter">pts</span>
                        </div>
                      )}
                      
                      {!isRanked && item.accent !== 'gray' && (
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-0.5 rounded bg-[#1E1B2E]">Assigned</span>
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        </div>
                      )}

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

            {/* Footer */}
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

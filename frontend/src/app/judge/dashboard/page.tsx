'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import { ChevronRight, Globe, Layers, Search, Users, Trophy, Shield, ChevronDown, Check, LayoutGrid, BookOpen } from 'lucide-react';

export default function JudgeDashboard() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [activeTab, setActiveTab] = useState<'programs' | 'participants'>('programs');
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [judgeCategory, setJudgeCategory] = useState('');
  const [evaluatedProgramIds, setEvaluatedProgramIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = localStorage.getItem('user');
        let assignedIds: string[] = [];
        let category = '';

        if (userData) {
          const user = JSON.parse(userData);

          if (user._id) {
            // Always fetch fresh judge data — gets category, assignedPrograms
            const liveJudgeData = await apiRequest('/judges/me');
            assignedIds = (liveJudgeData.assignedPrograms || []).map((p: any) => typeof p === 'object' ? p._id : p);
            category = liveJudgeData.category || user.category || '';
            const ev = new Set<string>((liveJudgeData.evaluatedPrograms || []).map((id: any) => id.toString()));
            setEvaluatedProgramIds(ev);

            // Save the fresh data back (preserving all fields)
            localStorage.setItem('user', JSON.stringify({
              ...user,
              category,
              assignedPrograms: liveJudgeData.assignedPrograms
            }));
          } else {
            category = user.category || '';
          }
        }

        setJudgeCategory(category);

        // Fetch programs filtered by language
        const allPrograms = await apiRequest('/programs');
        const filtered = assignedIds.length > 0
          ? allPrograms.filter((p: any) => assignedIds.includes(p._id))
          : allPrograms.filter((p: any) => p.language === category);
        setPrograms(filtered);

        // Fetch participants by the judge's language category
        if (category) {
          const pData = await apiRequest('/participants/by-language?language=' + encodeURIComponent(category));
          setParticipants(Array.isArray(pData) ? pData : []);
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groups = Array.from(new Set(participants.map((p: any) => p.groupId?.name).filter(Boolean)));

  const getParticipantDashboardTopic = (p: any): string => {
    if (!p.programs || p.programs.length === 0) return 'No topic assigned';
    if (p.programTopics && Array.isArray(p.programTopics)) {
      for (const pt of p.programTopics) {
        const progId = typeof pt.programId === 'object' ? pt.programId._id : pt.programId;
        const prog = p.programs.find((progItem: any) => String(progItem._id || progItem) === String(progId));
        if (prog && prog.topics && Array.isArray(prog.topics)) {
          const top = prog.topics.find((t: any) => String(t._id) === String(pt.topicId));
          if (top && top.title) return top.title;
        }
      }
    }
    return 'No topic assigned';
  };

  const filteredParticipants = participants.filter((p: any) => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.chestNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGroup = selectedGroup ? p.groupId?.name === selectedGroup : true;
    return matchSearch && matchGroup;
  });

  const filteredPrograms = [...programs]
    .filter((p: any) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const aLP = a.languagePosition;
      const bLP = b.languagePosition;
      if (aLP !== null && aLP !== undefined && bLP !== null && bLP !== undefined) return aLP - bLP;
      if (aLP !== null && aLP !== undefined) return -1;
      if (bLP !== null && bLP !== undefined) return 1;
      const aGP = a.globalPosition;
      const bGP = b.globalPosition;
      if (aGP !== null && aGP !== undefined && bGP !== null && bGP !== undefined) return aGP - bGP;
      if (aGP !== null && aGP !== undefined) return -1;
      if (bGP !== null && bGP !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });

  const groupColor = (name: string) => {
    if (name === 'Senior') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (name === 'Junior') return 'bg-green-500/10 text-green-400 border-green-500/20';
    return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Judge Dashboard</h2>
          {judgeCategory && (
            <div className="flex items-center gap-2 mt-1">
              <Globe size={14} className="text-purple-400" />
              <span className="text-purple-400 font-bold text-sm">{judgeCategory}</span>
              <span className="text-gray-500 text-sm">Category</span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#13111C] p-1 rounded-xl border border-gray-800 gap-1">
          <button
            onClick={() => setActiveTab('programs')}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all " +
              (activeTab === 'programs' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white')}
          >
            <LayoutGrid size={15} /> Programs
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all " +
              (activeTab === 'participants' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white')}
          >
            <Users size={15} /> Participants
            {participants.length > 0 && (
              <span className="bg-white/10 text-white text-xs px-1.5 py-0.5 rounded-full">{participants.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 bg-[#1E1B2E] p-1.5 rounded-2xl border border-[#2D283E] shadow-xl">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={activeTab === 'programs' ? 'Search programs...' : 'Search by topic or chest no...'}
            className="block w-full pl-11 pr-4 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {activeTab === 'participants' && (
          <div className="relative">
            <button
              onClick={() => setIsGroupOpen(!isGroupOpen)}
              className="flex items-center gap-2 bg-[#13111C] hover:bg-[#1A1825] border border-gray-800 rounded-xl pl-3 pr-4 py-3 text-sm text-gray-300 transition-all w-44 justify-between"
            >
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-gray-500" />
                <span>{selectedGroup || 'All Groups'}</span>
              </div>
              <ChevronDown size={14} className={"text-gray-500 transition-transform " + (isGroupOpen ? 'rotate-180' : '')} />
            </button>
            {isGroupOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsGroupOpen(false)} />
                <div className="absolute top-full mt-2 right-0 w-48 bg-[#0f0e17] border border-gray-800 rounded-xl shadow-2xl z-20 overflow-hidden p-1">
                  <button onClick={() => { setSelectedGroup(''); setIsGroupOpen(false); }}
                    className={"w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between " + (!selectedGroup ? 'bg-purple-600/10 text-purple-400' : 'text-gray-400 hover:bg-white/5')}>
                    All Groups {!selectedGroup && <Check size={12} />}
                  </button>
                  {groups.map((g: any) => (
                    <button key={g} onClick={() => { setSelectedGroup(g); setIsGroupOpen(false); }}
                      className={"w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between " + (selectedGroup === g ? 'bg-purple-600/10 text-purple-400' : 'text-gray-400 hover:bg-white/5')}>
                      {g} {selectedGroup === g && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-16 flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mb-4" />
          Loading data...
        </div>
      ) : activeTab === 'programs' ? (
        /* ─── Programs Grid ─── */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPrograms.map((program) => {
            const isEvaluated = evaluatedProgramIds.has(program._id);
            return (
            <Link
              key={program._id}
              href={isEvaluated ? "#" : "/judge/program/" + program._id}
              onClick={(e) => { if (isEvaluated) e.preventDefault(); }}
              className={`group relative overflow-hidden bg-[#1E1B2E] rounded-2xl border border-[#2D283E] transition-all duration-300 ${isEvaluated ? 'opacity-80 cursor-default' : 'hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-900/20'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/0 group-hover:via-purple-900/10 group-hover:to-purple-900/20 transition-all duration-500" />
              <div className="relative p-6 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-[#13111C] border border-[#2D283E] transition-all duration-300 ${isEvaluated ? '' : 'group-hover:border-purple-500/30 group-hover:scale-110'}`}>
                    <Layers size={20} className="text-purple-400" />
                  </div>
                  <div className="flex gap-2">
                     {isEvaluated && (
                        <div className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-lg border border-green-400/20">
                          <Check size={10} strokeWidth={3} /><span>SUBMITTED</span>
                        </div>
                     )}
                     <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-[#13111C] px-2 py-1 rounded-lg border border-[#2D283E]">
                       <span>MAX</span><span className="text-white">{program.maxMarks}</span>
                     </div>
                  </div>
                </div>
                <div className="mb-4 flex-1">
                  <h3 className={`text-lg font-bold text-white mb-1 transition-colors ${isEvaluated ? '' : 'group-hover:text-purple-300'}`}>{program.name}</h3>
                  {program.topics && program.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {program.topics.map((t: any) => (
                        <span key={t._id} className="text-gray-400 text-xs italic bg-white/5 px-1.5 py-0.5 rounded border border-white/5 line-clamp-1" title={t.title}>
                          {t.title}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {program.language && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/5 text-blue-400 border border-blue-500/10 text-[10px] font-bold uppercase tracking-wider">
                        <Globe size={10} /> {program.language}
                      </span>
                    )}
                    {program.groupId && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 text-[10px] font-bold uppercase tracking-wider">
                        <Layers size={10} /> {program.groupId.name || 'Group'}
                      </span>
                    )}
                    {program.topics && program.topics.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/5 text-purple-400 border border-purple-500/10 text-[10px] font-bold uppercase tracking-wider">
                        <BookOpen size={10} /> {program.topics.length} {program.topics.length === 1 ? 'Topic' : 'Topics'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-[#2D283E] mt-auto">
                  {isEvaluated ? (
                      <span className="text-xs text-gray-500 font-medium tracking-wide">Evaluation Completed</span>
                  ) : (
                      <>
                        <span className="text-xs text-gray-400 font-medium group-hover:text-gray-300">Tap to Evaluate</span>
                        <div className="p-1.5 rounded-full bg-white/5 text-gray-400 group-hover:bg-purple-500 group-hover:text-white transition-all transform group-hover:-rotate-45">
                          <ChevronRight size={16} />
                        </div>
                      </>
                  )}
                </div>
              </div>
            </Link>
          )})}
          {filteredPrograms.length === 0 && (
            <div className="col-span-full text-center py-16 bg-[#1E1B2E] rounded-3xl border border-dashed border-[#2D283E]">
              <Search size={24} className="mx-auto mb-3 text-gray-600" />
              <h3 className="text-lg font-bold text-white mb-1">No programs found</h3>
              <p className="text-gray-500 text-sm">No programs are assigned to your account yet.</p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Participants Table ─── */
        <div className="bg-[#1E1B2E] rounded-2xl border border-[#2D283E] overflow-hidden shadow-xl">
          {/* Desktop Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead className="bg-[#13111C]">
              <tr className="border-b border-[#2D283E] text-gray-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-5 w-16">#</th>
                <th className="p-5 w-28">Chest No</th>
                <th className="p-5">Topic</th>
                <th className="p-5 w-36">Team</th>
                <th className="p-5 w-32">Category</th>
                <th className="p-5">Program</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D283E]">
              {filteredParticipants.map((p: any, index: number) => (
                <tr key={p._id} className="hover:bg-[#252236] transition-colors group">
                  <td className="p-5 text-gray-500 font-mono text-sm">{filteredParticipants.length - index}</td>
                  <td className="p-5">
                    <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#13111C] border border-gray-700 text-purple-300 font-mono text-sm font-bold">
                      {p.chestNumber}
                    </div>
                  </td>
                  <td className="p-5 font-bold text-white group-hover:text-purple-300 transition-colors">
                    {getParticipantDashboardTopic(p)}
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Trophy size={12} className="text-purple-500" />
                      {p.teamId?.name || '-'}
                    </div>
                  </td>
                  <td className="p-5">
                    {p.groupId?.name ? (
                      <span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border " + groupColor(p.groupId.name)}>
                        <Shield size={10} /> {p.groupId.name}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-5 text-gray-400 text-sm">
                    {p.programs?.length > 0 ? p.programs.map((prog: any) => prog.name).join(', ') : '-'}
                  </td>
                </tr>
              ))}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-[#13111C] border border-[#2D283E] flex items-center justify-center">
                        <Users className="opacity-20" size={28} />
                      </div>
                      <p>No participants found for <span className="text-purple-400 font-bold">{judgeCategory}</span>.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-[#2D283E]">
            {filteredParticipants.map((p: any) => (
              <div key={p._id} className="p-4 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-mono text-xs font-bold bg-[#13111C] px-1.5 py-0.5 rounded border border-[#2D283E]">
                      #{p.chestNumber}
                    </span>
                    {p.groupId?.name && (
                      <span className={"text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border " + groupColor(p.groupId.name)}>
                        {p.groupId.name}
                      </span>
                    )}
                  </div>
                  <p className="text-white font-bold">{getParticipantDashboardTopic(p)}</p>
                  <p className="text-gray-500 text-xs">{p.teamId?.name || 'No Team'} · {p.programs?.[0]?.name || 'No Program'}</p>
                </div>
              </div>
            ))}
            {filteredParticipants.length === 0 && (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                <Users className="opacity-20" size={28} />
                <p>No participants found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

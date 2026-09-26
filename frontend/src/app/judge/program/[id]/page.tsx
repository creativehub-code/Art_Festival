'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { Trophy, Medal, ArrowLeft, Globe, Layers, BookOpen, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/useToast';

export default function ProgramMarkingPage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;
  const { toasts, addToast, dismissToast } = useToast();
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [participants, setParticipants] = useState<any[]>([]);
  const [marks, setMarks] = useState<{[key: string]: number}>({});
  const [criteriaMarksState, setCriteriaMarksState] = useState<{[participantId: string]: {[criterionId: string]: number}}>({});
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!programId) return;

    const init = async () => {
      try {
        const userStr = localStorage.getItem('user') || '{}';
        const user = JSON.parse(userStr);
        
        // Fetch program details, program-specific participants, and existing submitted marks concurrently
        const [progs, partsRes, markData] = await Promise.all([
          apiRequest('/programs'),
          apiRequest(`/programs/${programId}/participants`),
          apiRequest(`/marks/${programId}`),
        ]);

        const currentProg = progs.find((p: any) => p._id === programId);
        setProgram(currentProg);

        const parts = Array.isArray(partsRes) ? partsRes : (partsRes.data || []);
        let finalParticipants = parts;

        if (currentProg?.isConversation) {
          try {
            const pairs = await apiRequest(`/conversation-pairs/by-program/${programId}`);
            finalParticipants = pairs.map((pair: any) => {
              const pairParts = pair.participants || [];
              const chestNumbers: string[] = [];

              pairParts.forEach((p: any) => {
                const cNo = p.chestNumber || parts.find((f: any) => String(f._id) === String(p._id || p))?.chestNumber;
                if (cNo != null && cNo !== '' && !chestNumbers.includes(String(cNo))) {
                  chestNumbers.push(String(cNo));
                }
              });

              if (pair.primaryParticipantId) {
                const primCNo = pair.primaryParticipantId.chestNumber || parts.find((f: any) => String(f._id) === String(pair.primaryParticipantId._id || pair.primaryParticipantId))?.chestNumber;
                if (primCNo != null && primCNo !== '' && !chestNumbers.includes(String(primCNo))) {
                  chestNumbers.push(String(primCNo));
                }
              }

              const displayChestNumber = chestNumbers.join(', ');
              const primaryId = pair.primaryParticipantId?._id || pair.primaryParticipantId || (pairParts[0]?._id || pairParts[0]);

              return {
                _id: primaryId,
                chestNumber: displayChestNumber,
                name: pairParts.map((p: any) => p.name || parts.find((f: any) => String(f._id) === String(p._id || p))?.name).join(' & '),
                programTopics: pair.primaryParticipantId?.programTopics || parts.find((p: any) => String(p._id) === String(primaryId))?.programTopics || []
              };
            });
          } catch (e) {
            console.error("Error fetching conversation pairs", e);
          }
        }

        setParticipants(finalParticipants);

        const textMarks: {[key: string]: number} = {};
        const initialCriteriaState: {[pId: string]: {[cId: string]: number}} = {};
        const newLockedIds = new Set<string>();
        const allMarks = markData.marks || [];
        
        allMarks.forEach((m: any) => {
          const mJudgeId = typeof m.judgeId === 'object' ? m.judgeId._id : m.judgeId;
          if (mJudgeId === user._id) {
            const pId = typeof m.participantId === 'object' ? m.participantId._id : m.participantId;
            textMarks[pId] = m.marksGiven;
            newLockedIds.add(pId);

            if (m.criteriaMarks && Array.isArray(m.criteriaMarks)) {
              initialCriteriaState[pId] = {};
              m.criteriaMarks.forEach((cm: any) => {
                const cId = cm.criterionId?._id || cm.criterionId;
                initialCriteriaState[pId][cId] = cm.marksGiven;
              });
            }
          }
        });
        setMarks(textMarks);
        setCriteriaMarksState(initialCriteriaState);
        setLockedIds(newLockedIds);
        
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    init();
  }, [programId]);

  /** Helper to resolve topic for a participant specifically for this program */
  const getParticipantTopic = (p: any): string => {
    if (p.topicId) {
      if (typeof p.topicId === 'object' && p.topicId.title) return p.topicId.title;
      const topicObj = program?.topics?.find((t: any) => String(t._id) === String(p.topicId));
      if (topicObj) return topicObj.title;
    }
    if (!program?.topics || program.topics.length === 0) return 'No topic assigned';
    if (!p.programTopics || !Array.isArray(p.programTopics)) return 'No topic assigned';
    const pt = p.programTopics.find((t: any) => {
      const progId = typeof t.programId === 'object' ? t.programId._id : t.programId;
      return String(progId) === String(programId);
    });
    if (!pt || !pt.topicId) return 'No topic assigned';
    const topicObj = program.topics.find((t: any) => String(t._id) === String(pt.topicId));
    return topicObj ? topicObj.title : 'No topic assigned';
  };

  const handleCriterionMarkChange = (participantId: string, criterionId: string, value: string, maxMarks: number) => {
    let numVal: number | undefined;
    if (value !== '') {
      const parsed = Number(value);
      if (isNaN(parsed)) return;
      if (parsed < 0 || parsed > maxMarks) {
        addToast({
          title: 'Invalid Criterion Mark',
          message: `Criterion mark must be between 0 and ${maxMarks}.`,
          type: 'warning',
        });
        return;
      }
      numVal = parsed;
    }

    setCriteriaMarksState(prev => {
      const pMarks = { ...(prev[participantId] || {}) };
      if (numVal === undefined) {
        delete pMarks[criterionId];
      } else {
        pMarks[criterionId] = numVal;
      }

      // Calculate total mark for participant
      const pCriteria = program?.criteria || [];
      if (pCriteria.length > 0) {
        const sumTotal = Object.values(pMarks).reduce((sum, val) => sum + (val || 0), 0);
        setMarks(prevTotalMarks => {
          const next = { ...prevTotalMarks };
          if (Object.keys(pMarks).length > 0) {
            next[participantId] = sumTotal;
          } else {
            delete next[participantId];
          }
          return next;
        });
      }

      return { ...prev, [participantId]: pMarks };
    });
  };

  const filteredParticipants = useMemo(() => {
    if (selectedTopicFilter === 'ALL') return participants;
    return participants.filter(p => getParticipantTopic(p) === selectedTopicFilter);
  }, [participants, selectedTopicFilter, program, programId]);

  const handleSubmit = () => {
    const hasCriteria = Boolean(program?.criteriaEnabled && program?.criteria && program.criteria.length > 0);
    const missingMarks = participants.some(p => {
      if (hasCriteria) {
        const pCritState = criteriaMarksState[p._id] || {};
        return program.criteria.some((c: any) => pCritState[c._id] === undefined || pCritState[c._id] === null || isNaN(pCritState[c._id]));
      } else {
        const mark = marks[p._id];
        return mark === undefined || Number.isNaN(mark) || mark.toString().trim() === '';
      }
    });
    
    if (missingMarks) {
      addToast({ 
        title: 'Incomplete Evaluation', 
        message: hasCriteria ? 'Please enter marks for all criteria of all participants before submitting.' : 'Please enter marks for all participants before submitting.', 
        type: 'warning' 
      });
      return;
    }

    setShowSubmitConfirm(true);
  };

  const confirmSubmitMarks = async () => {
    setShowSubmitConfirm(false);
    setIsSubmitting(true);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user._id) {
      setIsSubmitting(false);
      addToast({ title: 'Authentication Error', message: 'Error: Judge ID not found. Please login again.', type: 'error' });
      return;
    }

    try {
      const hasCriteria = Boolean(program?.criteriaEnabled && program?.criteria && program.criteria.length > 0);
      const unsubmittedParts = participants.filter(p => !lockedIds.has(p._id));
      
      const markEntries = unsubmittedParts
        .map(p => {
          if (hasCriteria) {
            const pCriteria = criteriaMarksState[p._id] || {};
            const criteriaMarks = program.criteria.map((c: any) => ({
              criterionId: c._id,
              marksGiven: Number(pCriteria[c._id] || 0),
            }));
            const totalMarks = criteriaMarks.reduce((s: number, cm: any) => s + cm.marksGiven, 0);
            return {
              participantId: p._id,
              marksGiven: totalMarks,
              criteriaMarks,
            };
          } else {
            return {
              participantId: p._id,
              marksGiven: Number(marks[p._id])
            };
          }
        })
        .filter(entry => entry.marksGiven !== undefined && !isNaN(entry.marksGiven));

      if (markEntries.length === 0) {
        setIsSubmitting(false);
        addToast({ title: 'No New Marks', message: 'All marks for this program have already been submitted.', type: 'info' });
        return;
      }

      await apiRequest('/marks/batch', 'POST', {
        programId,
        marks: markEntries
      });

      addToast({ title: 'Submission Complete', message: 'Marks submitted successfully!', type: 'success' });
      setTimeout(() => {
        router.push('/judge/dashboard');
      }, 1000);
    } catch (err: any) {
      setIsSubmitting(false);
      addToast({ title: 'Submission Error', message: 'Error submitting marks: ' + (err.message || 'Unknown error'), type: 'error' });
    }
  };

  // Calculate Ranks (Dense Ranking: 1st, 2nd, 3rd highest scores)
  const rankings = useMemo(() => {
    const uniqueScores = Array.from(new Set(Object.values(marks))).sort((a, b) => b - a);
    const top3 = uniqueScores.slice(0, 3);
    const rankMap: {[id: string]: number} = {};
    
    Object.entries(marks).forEach(([id, score]) => {
      const rankIndex = top3.indexOf(score);
      if (rankIndex !== -1) {
        rankMap[id] = rankIndex + 1;
      }
    });
    return rankMap;
  }, [marks]);

  const stats = useMemo(() => {
    const total = participants.length;
    const evaluated = participants.filter(p => lockedIds.has(p._id) || (marks[p._id] !== undefined && marks[p._id] !== null && !isNaN(marks[p._id]))).length;
    const pending = Math.max(0, total - evaluated);
    return { total, evaluated, pending };
  }, [participants, lockedIds, marks]);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mb-4" />
      <p className="text-gray-400 text-sm">Loading program participants...</p>
    </div>
  );

  const hasTopics = program?.topics && program.topics.length > 0;

  return (
    <div className="space-y-6">
      {/* Header & Meta */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D283E] pb-5">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-[#13111C] border border-[#2D283E] hover:bg-white/5 text-gray-300 hover:text-white transition-all shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {program?.name} 
              </h2>
              <span className="text-purple-400 text-xs font-bold uppercase tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                Evaluation
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {program?.language && (
                <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Globe size={11} /> {program.language}
                </span>
              )}
              {program?.groupId && (
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Layers size={11} /> {program.groupId.name || 'Group'}
                </span>
              )}
              {hasTopics && (
                <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <BookOpen size={11} /> {program.topics.length} {program.topics.length === 1 ? 'Topic' : 'Topics'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Evaluation Summary Stats Row */}
        <div className="flex flex-wrap sm:flex-nowrap items-center divide-x divide-[#2D283E] border border-[#2D283E] bg-[#13111C]/40 rounded-xl px-1 py-1.5 sm:px-3 sm:py-2 w-full lg:w-auto">
          <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1 text-center sm:text-left min-w-[75px]">
            <span className="text-gray-400 text-[10px] sm:text-[11px] uppercase font-bold tracking-wider block">Total</span>
            <span className="text-white font-mono text-base sm:text-lg font-bold block mt-0.5">{stats.total}</span>
          </div>

          <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1 text-center sm:text-left min-w-[75px]">
            <span className="text-gray-400 text-[10px] sm:text-[11px] uppercase font-bold tracking-wider block">Marked</span>
            <span className="text-white font-mono text-base sm:text-lg font-bold block mt-0.5">{stats.evaluated}</span>
          </div>

          <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1 text-center sm:text-left min-w-[75px]">
            <span className="text-gray-400 text-[10px] sm:text-[11px] uppercase font-bold tracking-wider block">Pending</span>
            <span className="text-white font-mono text-base sm:text-lg font-bold block mt-0.5">{stats.pending}</span>
          </div>

          <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1 text-center sm:text-left min-w-[75px]">
            <span className="text-gray-400 text-[10px] sm:text-[11px] uppercase font-bold tracking-wider block">Max Marks</span>
            <span className="text-white font-mono text-base sm:text-lg font-bold block mt-0.5">{program?.maxMarks}</span>
          </div>
        </div>
      </div>

      {/* Topic Filter Tabs (Only shown if multiple topics exist) */}
      {hasTopics && program.topics.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mr-2 flex-shrink-0">
            <BookOpen size={13} className="text-purple-400" /> Filter Topic:
          </span>
          <button
            type="button"
            onClick={() => setSelectedTopicFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
              selectedTopicFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-[#1E1B2E] text-gray-400 hover:text-white border border-[#2D283E]'
            }`}
          >
            All Topics ({participants.length})
          </button>
          {program.topics.map((t: any) => {
            const count = participants.filter(p => getParticipantTopic(p) === t.title).length;
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => setSelectedTopicFilter(t.title)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                  selectedTopicFilter === t.title
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-[#1E1B2E] text-gray-400 hover:text-white border border-[#2D283E]'
                }`}
              >
                {t.title} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Participant Evaluation Scoring Table */}
      <div className="bg-[#1E1B2E] rounded-2xl overflow-hidden border border-[#2D283E] shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#13111C] text-gray-400 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="p-4 border-b border-[#2D283E] w-28">Chest No</th>
                <th className="p-4 border-b border-[#2D283E] min-w-[180px]">Topic</th>
                {program?.criteriaEnabled && program?.criteria && program.criteria.length > 0 ? (
                  <>
                    {program.criteria.map((crit: any) => (
                      <th key={crit._id} className="p-4 border-b border-[#2D283E] text-center min-w-[120px]">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-200 text-xs font-bold uppercase">{crit.title}</span>
                          <span className="text-[10px] text-gray-500 font-mono font-normal">Max: {crit.maxMarks}</span>
                        </div>
                      </th>
                    ))}
                    <th className="p-4 border-b border-[#2D283E] text-right w-32 font-bold text-purple-400">Total</th>
                  </>
                ) : (
                  <th className="p-4 border-b border-[#2D283E] text-right w-48">Marks / Status</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D283E]">
              {filteredParticipants.map((p) => {
                const isLocked = lockedIds.has(p._id);
                const rank = rankings[p._id];
                const topicTitle = getParticipantTopic(p);
                const hasCriteria = Boolean(program?.criteriaEnabled && program?.criteria && program.criteria.length > 0);
                
                return (
                  <tr key={p._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 align-middle font-mono text-sm font-bold text-purple-300">
                      {p.chestNumber}
                    </td>
                    <td className="py-3 px-4 align-middle text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <span className={topicTitle === 'No topic assigned' ? 'text-gray-500 italic text-xs' : 'text-gray-200'}>
                          {topicTitle}
                        </span>
                        {rank === 1 && (program?.positionCount || 3) >= 1 && <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">1ST</span>}
                        {rank === 2 && (program?.positionCount || 3) >= 2 && <span className="text-[10px] font-bold text-gray-300 bg-gray-400/10 px-1.5 py-0.5 rounded border border-gray-400/20">2ND</span>}
                        {rank === 3 && (program?.positionCount || 3) >= 3 && <span className="text-[10px] font-bold text-orange-400 bg-orange-700/10 px-1.5 py-0.5 rounded border border-orange-700/20">3RD</span>}
                      </div>
                    </td>
                    
                    {hasCriteria ? (
                      <>
                        {program.criteria.map((crit: any) => {
                          const pCritValue = criteriaMarksState[p._id]?.[crit._id];
                          return (
                            <td key={crit._id} className="py-3 px-4 align-middle text-center">
                              {isLocked ? (
                                <span className="font-mono text-sm font-bold text-gray-200">
                                  {criteriaMarksState[p._id]?.[crit._id] ?? 0}
                                  <span className="text-[10px] text-gray-500 font-normal ml-0.5">/ {crit.maxMarks}</span>
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={crit.maxMarks}
                                    className="bg-[#0F0D17] border border-gray-700/70 focus:border-purple-500 rounded-lg p-1.5 w-16 text-white text-xs text-center font-mono font-bold outline-none transition-all placeholder-gray-600"
                                    placeholder="-"
                                    value={pCritValue !== undefined ? pCritValue : ''}
                                    onChange={(e) => handleCriterionMarkChange(p._id, crit._id, e.target.value, crit.maxMarks)}
                                    disabled={isSubmitting}
                                  />
                                  <span className="text-[10px] text-gray-500 font-mono">/ {crit.maxMarks}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 align-middle text-right font-mono text-sm font-bold text-white">
                          {marks[p._id] !== undefined ? marks[p._id] : 0} / {program?.maxMarks}
                        </td>
                      </>
                    ) : (
                      <td className="py-3 px-4 align-middle text-right">
                        {isLocked ? (
                          <div className="flex items-center justify-end gap-1.5 text-green-400 font-mono text-sm font-bold">
                            <span>{marks[p._id]} / {program?.maxMarks}</span>
                            <span className="text-[10px] text-green-400/80 font-semibold uppercase tracking-wider flex items-center gap-0.5 ml-1">
                              <CheckCircle2 size={11} /> Submitted
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={program?.maxMarks}
                              className="bg-[#0F0D17] border border-gray-700/70 focus:border-purple-500 rounded-lg p-2 w-20 text-white text-sm text-center font-mono font-bold outline-none transition-all placeholder-gray-600"
                              placeholder="-"
                              value={marks[p._id] !== undefined ? marks[p._id] : ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  const next = { ...marks };
                                  delete next[p._id];
                                  setMarks(next);
                                  return;
                                }
                                const num = Number(value);
                                if (isNaN(num)) return;
                                const maxM = program?.maxMarks ?? 100;
                                if (num < 0 || num > maxM) {
                                  addToast({ title: 'Invalid Mark', message: `Marks must be between 0 and ${maxM}.`, type: 'warning' });
                                  return;
                                }
                                setMarks(prev => ({ ...prev, [p._id]: num }));
                              }}
                              disabled={isSubmitting}
                            />
                            <span className="text-xs text-gray-500 font-mono">/ {program?.maxMarks}</span>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-500 italic">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="opacity-30" size={28} />
                      <p>No participants found for this program or selected topic filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Submit Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1E1B2E] p-4 rounded-2xl border border-[#2D283E] shadow-md">
        <div className="text-xs text-gray-400 font-medium">
          <span className="text-purple-400 font-bold">{stats.evaluated}</span> of <span className="text-white font-bold">{stats.total}</span> participants evaluated
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || participants.length === 0}
          className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-7 rounded-xl shadow-md shadow-purple-950/40 transition-all text-sm flex items-center gap-2 cursor-pointer"
        >
          {isSubmitting ? 'Submitting Marks...' : 'Submit Evaluation'}
        </button>
      </div>

      <ConfirmModal
        isOpen={showSubmitConfirm}
        title="Submit All Marks"
        message="Are you sure you want to submit all marks? This cannot be undone."
        confirmText="Submit Marks"
        variant="info"
        onConfirm={confirmSubmitMarks}
        onCancel={() => setShowSubmitConfirm(false)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}



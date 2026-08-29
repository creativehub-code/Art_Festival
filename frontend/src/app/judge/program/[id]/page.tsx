'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { Trophy, Medal, ArrowLeft, Globe, Layers } from 'lucide-react';
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
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);

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
            finalParticipants = pairs.map((pair: any) => ({
              _id: pair.primaryParticipantId._id || pair.primaryParticipantId,
              chestNumber: pair.primaryParticipantId.chestNumber || parts.find((p: any) => p._id === pair.primaryParticipantId)?.chestNumber,
              name: pair.participants.map((p: any) => p.name || parts.find((f: any) => f._id === p)?.name).join(' & ')
            }));
          } catch (e) {
            console.error("Error fetching conversation pairs", e);
          }
        }

        setParticipants(finalParticipants);

        const textMarks: {[key: string]: number} = {};
        const newLockedIds = new Set<string>();
        const allMarks = markData.marks || [];
        
        allMarks.forEach((m: any) => {
          const mJudgeId = typeof m.judgeId === 'object' ? m.judgeId._id : m.judgeId;
          if (mJudgeId === user._id) {
            const pId = typeof m.participantId === 'object' ? m.participantId._id : m.participantId;
            textMarks[pId] = m.marksGiven;
            newLockedIds.add(pId);
          }
        });
        setMarks(textMarks);
        setLockedIds(newLockedIds);
        
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    init();
  }, [programId]);

  const handleMarkChange = (participantId: string, value: string) => {
    setMarks({ ...marks, [participantId]: Number(value) });
  };

  const handleSubmit = () => {
    const missingMarks = participants.some(p => {
      const mark = marks[p._id];
      return mark === undefined || Number.isNaN(mark) || mark.toString().trim() === '';
    });
    
    if (missingMarks) {
      addToast({ title: 'Incomplete Evaluation', message: 'Please enter marks for all participants before submitting.', type: 'warning' });
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
      const unsubmittedParts = participants.filter(p => !lockedIds.has(p._id));
      const markEntries = unsubmittedParts
        .map(p => ({
          participantId: p._id,
          marksGiven: Number(marks[p._id])
        }))
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

  if (loading) return <div className="text-white p-10">Loading participants...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
            {program?.name} 
            <span className="text-purple-400 text-base font-normal">Evaluation</span>
          </h2>
          <div className="flex gap-2">
            {program?.language && (
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Globe size={10} /> {program.language}
              </span>
            )}
            {program?.groupId && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers size={10} /> {program.groupId.name || 'Group'}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-[#1E1B2E] rounded-xl overflow-hidden border border-[#2D283E] shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-[#13111C] text-gray-400 uppercase text-xs font-bold tracking-wider">
            <tr>
              <th className="p-4 border-b border-[#2D283E]">Chest No</th>
              <th className="p-4 border-b border-[#2D283E]">Name</th>
              <th className="p-4 border-b border-[#2D283E]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D283E]">
            {participants.map((p) => {
              const isLocked = lockedIds.has(p._id);
              const rank = rankings[p._id];
              
              return (
              <tr key={p._id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-mono text-purple-300 font-bold">{p.chestNumber}</td>
                <td className="p-4 text-gray-200 font-medium">
                  <div className="flex items-center gap-3">
                    {p.name}
                    {rank === 1 && <span className="flex items-center gap-1 text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30"><Trophy size={12} fill="currentColor" /> 1ST</span>}
                    {rank === 2 && <span className="flex items-center gap-1 text-[10px] font-bold bg-gray-400/20 text-gray-300 px-2 py-0.5 rounded-full border border-gray-400/30"><Medal size={12} /> 2ND</span>}
                    {rank === 3 && <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-700/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-700/30"><Medal size={12} /> 3RD</span>}
                  </div>
                </td>
                <td className="p-4">
                  {isLocked ? (
                    <div className="flex items-center gap-2 text-green-400 font-bold bg-green-400/10 px-3 py-1.5 rounded-lg w-fit">
                      <span>{marks[p._id]}</span>
                      <span className="text-xs opacity-70 uppercase tracking-wide">Submitted</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={program?.maxMarks}
                        className={`bg-[#0f0e17] border rounded-lg p-2.5 w-24 text-white focus:outline-none transition-all font-mono text-center
                          ${rank === 1 ? 'border-yellow-500/50 focus:border-yellow-500 ring-yellow-500/20' : 
                            rank === 2 ? 'border-gray-500/50 focus:border-gray-500 ring-gray-500/20' :
                            rank === 3 ? 'border-orange-500/50 focus:border-orange-500 ring-orange-500/20' :
                            'border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'}
                        `}
                        placeholder="-"
                        value={marks[p._id] !== undefined ? marks[p._id] : ''}
                        onChange={(e) => handleMarkChange(p._id, e.target.value)}
                        disabled={isSubmitting}
                      />
                      <span className="text-xs text-gray-500">/ {program?.maxMarks}</span>
                    </div>
                  )}
                </td>
              </tr>
            )})}
            {participants.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500 italic">No participants found for this group.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || participants.length === 0}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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


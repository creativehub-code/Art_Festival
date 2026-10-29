'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Search,
  Check,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Layers,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useStages, useStagePrograms, useInvalidate, Stage, Program } from '@/lib/queries';
import ConfirmModal from '@/components/ConfirmModal';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/lib/useToast';

/**
 * Sorts programs assigned to a stage using the application's established ordering hierarchy:
 * 1. stagePosition (order within this stage)
 * 2. languagePosition (order within its language)
 * 3. globalPosition (order among all programs)
 * 4. name (alphabetical fallback)
 */
function sortStagePrograms(programs: Program[]) {
  return [...programs].sort((a: any, b: any) => {
    // 1. stagePosition
    const aSP = a.stagePosition;
    const bSP = b.stagePosition;
    if (aSP !== null && aSP !== undefined && bSP !== null && bSP !== undefined) {
      const diff = Number(aSP) - Number(bSP);
      if (diff !== 0) return diff;
    } else if (aSP !== null && aSP !== undefined) {
      return -1;
    } else if (bSP !== null && bSP !== undefined) {
      return 1;
    }

    // 2. languagePosition
    const aLP = a.languagePosition;
    const bLP = b.languagePosition;
    if (aLP !== null && aLP !== undefined && bLP !== null && bLP !== undefined) {
      const diff = Number(aLP) - Number(bLP);
      if (diff !== 0) return diff;
    } else if (aLP !== null && aLP !== undefined) {
      return -1;
    } else if (bLP !== null && bLP !== undefined) {
      return 1;
    }

    // 3. globalPosition
    const aGP = a.globalPosition;
    const bGP = b.globalPosition;
    if (aGP !== null && aGP !== undefined && bGP !== null && bGP !== undefined) {
      const diff = Number(aGP) - Number(bGP);
      if (diff !== 0) return diff;
    } else if (aGP !== null && aGP !== undefined) {
      return -1;
    } else if (bGP !== null && bGP !== undefined) {
      return 1;
    }

    // 4. name
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Lazy-loaded subcomponent for displaying programs assigned to a specific stage.
 * Only mounted and executed when the parent stage card is clicked/expanded.
 */
function StageProgramsList({ stageId, addToast }: { stageId: string; addToast: any }) {
  const { data: programs = [], isLoading, isError, error } = useStagePrograms(stageId);

  useEffect(() => {
    if (isError && error) {
      addToast({
        title: 'Error Loading Programs',
        message: (error as any)?.message || 'Failed to load programs for this stage.',
        type: 'error',
      });
    }
  }, [isError, error, addToast]);

  if (isLoading) {
    return (
      <div className="py-4 text-center text-xs text-purple-300 flex items-center justify-center gap-2">
        <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading programs...</span>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="py-3.5 px-3 text-center text-xs text-gray-500 bg-[#0D0B18]/60 rounded-xl border border-dashed border-[#2D283E]">
        No programs assigned to this stage
      </div>
    );
  }

  const sortedPrograms = sortStagePrograms(programs);

  return (
    <div className="space-y-1.5">
      {sortedPrograms.map((p: any) => (
        <div
          key={p._id}
          className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D0B18] border border-[#2D283E] text-xs hover:border-purple-500/30 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {p.stagePosition != null ? (
              <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px] shrink-0 border border-purple-500/30">
                #{p.stagePosition}
              </span>
            ) : (
              <span className="w-6 h-6 rounded-lg bg-gray-800 text-gray-500 font-bold flex items-center justify-center text-[10px] shrink-0">
                —
              </span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{p.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                {p.language && <span>{p.language}</span>}
                {p.groupId?.name && <span>• {p.groupId.name}</span>}
                {p.languagePosition != null && <span>• Lang #{p.languagePosition}</span>}
                {p.globalPosition != null && <span>• Global #{p.globalPosition}</span>}
              </div>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              p.status === 'completed'
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : p.status === 'ongoing'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }`}
          >
            {p.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ManageStagesPage() {
  const { data: stages = [] } = useStages();
  const { invalidateStages, invalidatePrograms } = useInvalidate();
  const { toasts, addToast, dismissToast } = useToast();

  // Lazy-load expansion state: only clicked stage IDs are kept in set
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(new Set());

  const toggleStageExpand = (stageId: string) => {
    setExpandedStageIds(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  // Form State
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [position, setPosition] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');

  // Delete State
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reordering In-Progress State
  const [isReordering, setIsReordering] = useState(false);

  const resetForm = () => {
    setEditingStageId(null);
    setName('');
    setDescription('');
    setStatus('active');
    setPosition('');
  };

  const startEdit = (stage: Stage) => {
    setEditingStageId(stage._id);
    setName(stage.name || '');
    setDescription(stage.description || '');
    setStatus(stage.status === 'inactive' ? 'inactive' : 'active');
    setPosition(stage.position != null ? String(stage.position) : '');
  };

  const activeStagesCount = stages.filter((s: Stage) => s.status === 'active').length;

  const filteredStages = stages.filter((s: Stage) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesName = (s.name || '').toLowerCase().includes(term);
    const matchesDesc = (s.description || '').toLowerCase().includes(term);
    return matchesName || matchesDesc;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      addToast({ title: 'Validation Error', message: 'Stage name is required.', type: 'warning' });
      return;
    }

    const isDuplicate = stages.some(
      (s: Stage) => s._id !== editingStageId && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      addToast({ title: 'Validation Error', message: `Stage "${trimmedName}" already exists.`, type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: trimmedName,
        description: description.trim(),
        status,
      };
      if (position !== '') {
        const parsedPos = parseInt(position, 10);
        if (!isNaN(parsedPos) && parsedPos > 0) {
          payload.position = parsedPos;
        }
      }

      if (editingStageId) {
        const updatedStage = await apiRequest(`/stages/${editingStageId}`, 'PUT', payload);
        await invalidateStages();
        await invalidatePrograms();
        addToast({
          title: 'Stage Updated',
          message: `Stage "${updatedStage.name || trimmedName}" updated successfully.`,
          type: 'success',
        });
      } else {
        const createdStage = await apiRequest('/stages', 'POST', payload);
        await invalidateStages();
        await invalidatePrograms();
        addToast({
          title: 'Stage Created',
          message: `Stage "${createdStage.name || trimmedName}" created successfully.`,
          type: 'success',
        });
      }

      resetForm();
    } catch (err: any) {
      addToast({
        title: editingStageId ? 'Update Failed' : 'Creation Failed',
        message: err.message || 'Operation failed.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteStage = async () => {
    if (!deleteStageId || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/stages/${deleteStageId}`, 'DELETE');
      await invalidateStages();
      await invalidatePrograms();
      addToast({
        title: 'Stage Deleted',
        message: 'Stage deleted successfully.',
        type: 'success',
      });
      if (editingStageId === deleteStageId) {
        resetForm();
      }
      setDeleteStageId(null);
    } catch (err: any) {
      addToast({
        title: 'Delete Failed',
        message: err.message || 'Failed to delete stage.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveStage = async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length || isReordering) return;

    setIsReordering(true);
    try {
      const currentStage = stages[currentIndex];
      const targetStage = stages[targetIndex];

      const currentPos = currentStage.position ?? (currentIndex + 1);
      const targetPos = targetStage.position ?? (targetIndex + 1);

      const newCurrentPos = targetPos;
      const newTargetPos = currentPos === targetPos
        ? (direction === 'up' ? currentPos + 1 : currentPos - 1)
        : currentPos;

      await apiRequest(`/stages/${currentStage._id}`, 'PUT', { position: newCurrentPos });
      await apiRequest(`/stages/${targetStage._id}`, 'PUT', { position: newTargetPos });

      await invalidateStages();
      await invalidatePrograms();

      addToast({
        title: 'Order Updated',
        message: `Moved "${currentStage.name}" ${direction}.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Reorder Failed',
        message: err.message || 'Could not swap stage positions.',
        type: 'error',
      });
    } finally {
      setIsReordering(false);
    }
  };

  const stageToDelete = deleteStageId
    ? stages.find((s: Stage) => s._id === deleteStageId)
    : null;

  return (
    <>
      <ConfirmModal
        isOpen={!!deleteStageId}
        title="Delete Stage"
        message={`Are you sure you want to delete stage "${stageToDelete?.name || 'this stage'}"? Any programs assigned to this stage will be unassigned.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDeleteStage}
        onCancel={() => setDeleteStageId(null)}
      />

      <div className="space-y-6 pb-20 animate-in fade-in duration-300">
        {/* Top Bar / Header */}
        <div className="flex flex-row justify-between items-start sm:items-center gap-4 flex-wrap sm:flex-nowrap">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                Manage Stages
              </h2>
              {editingStageId && (
                <span className="bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  EDITING MODE
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs sm:text-sm">
              Organize festival stages, priority ordering, and live program venues.
            </p>
          </div>

          {/* Top Stats */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-purple-950/60 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]"></span>
              <span>{stages.length} STAGES CONFIGURED</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
              <span>{activeStagesCount} OPERATIONAL</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Add / Edit Form Card */}
          <div className="lg:col-span-5 bg-[#141224] border border-[#2D283E] rounded-3xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#2D283E] mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  {editingStageId ? 'Edit Stage' : 'Add New Stage'}
                </h3>
              </div>
              <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {editingStageId ? 'Update Mode' : 'Editor Mode'}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Stage Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <label className="text-gray-300 uppercase tracking-wider">
                    Stage Name <span className="text-pink-400">*</span>
                  </label>
                  <span className="text-gray-500 text-[10px]">MAX 40 CHARS</span>
                </div>
                <input
                  type="text"
                  maxLength={40}
                  placeholder="e.g. Solar Garden Dome, Main Hall"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0B18] border border-[#2D283E] text-white focus:outline-none focus:border-purple-500 text-sm font-semibold transition-all placeholder:text-gray-600 disabled:opacity-50"
                  autoFocus
                />
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                  Position <span className="text-gray-500 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Auto (Append Next)"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0B18] border border-[#2D283E] text-white focus:outline-none focus:border-purple-500 text-sm font-semibold transition-all placeholder:text-gray-600 disabled:opacity-50"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                  Description <span className="text-gray-500 text-[10px] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Open air stage for large audience programs, visual projection mapping enabled"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0B18] border border-[#2D283E] text-white focus:outline-none focus:border-purple-500 text-sm transition-all placeholder:text-gray-600 resize-none disabled:opacity-50 custom-scrollbar"
                />
              </div>

              {/* Status Toggle */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                  Initial Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                      status === 'active'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/40'
                        : 'bg-[#0D0B18] text-gray-400 border-[#2D283E] hover:border-gray-600'
                    }`}
                  >
                    <Check size={13} className={status === 'active' ? 'opacity-100' : 'opacity-0'} />
                    <span>Active</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('inactive')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                      status === 'inactive'
                        ? 'bg-gray-700 text-white border-gray-600 shadow-md'
                        : 'bg-[#0D0B18] text-gray-400 border-[#2D283E] hover:border-gray-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                    <span>Inactive</span>
                  </button>
                </div>
              </div>

              {/* Submit / Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="w-full py-3.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 transition-all shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Plus size={16} />
                  <span>{editingStageId ? 'Save Stage Changes' : 'Add Stage to Lineup'}</span>
                </button>

                {editingStageId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/10"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <p className="text-[11px] text-gray-500 flex items-center gap-1.5 pt-1">
                <span className="text-gray-400">ℹ</span> New stages will automatically be appended to stage order.
              </p>
            </form>
          </div>

          {/* Right Column: Configured Stages List */}
          <div className="lg:col-span-7 space-y-4">
            {/* Section Header with Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141224] p-3 rounded-2xl border border-[#2D283E]">
              <div className="flex items-center gap-2.5 pl-1">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Configured Stages
                </h3>
                <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {stages.length} total
                </span>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter stage name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0D0B18] border border-[#2D283E] text-white text-xs font-medium placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Stage Cards List */}
            <div className="space-y-3">
              {filteredStages.length === 0 ? (
                <div className="p-8 text-center bg-[#141224] rounded-2xl border border-dashed border-[#2D283E] text-gray-400">
                  <Sparkles size={28} className="mx-auto text-purple-400 mb-2 opacity-50" />
                  <p className="font-bold text-white text-sm">
                    {searchTerm ? `No stages matching "${searchTerm}"` : 'No stages configured yet'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {searchTerm
                      ? 'Try adjusting your search filter.'
                      : 'Use the form on the left to add your first stage.'}
                  </p>
                </div>
              ) : (
                filteredStages.map((stage: Stage, index: number) => {
                  const isEditingThis = editingStageId === stage._id;
                  const isExpanded = expandedStageIds.has(stage._id);

                  return (
                    <div
                      key={stage._id}
                      onClick={() => toggleStageExpand(stage._id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isEditingThis
                          ? 'bg-[#1D1733] border-purple-500 shadow-lg shadow-purple-950/30'
                          : isExpanded
                          ? 'bg-[#18152D] border-purple-500/50 shadow-md shadow-purple-950/20'
                          : 'bg-[#141224] border-[#2D283E] hover:border-purple-500/40 hover:bg-[#18152D]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: Grip + #Position Badge + Info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                          <GripVertical size={16} className="text-gray-600 shrink-0 hidden sm:block" />

                          {/* Position Badge */}
                          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-black text-sm shrink-0">
                            #{stage.position != null ? stage.position : index + 1}
                          </div>

                          {/* Stage Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-white text-sm sm:text-base truncate">
                                {stage.name}
                              </h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  stage.status === 'active'
                                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                    : 'bg-gray-800 text-gray-400 border-gray-700'
                                }`}
                              >
                                • {stage.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {stage.description ? (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {stage.description}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-600 mt-1 italic">No description</p>
                            )}
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Reorder Up/Down */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={index === 0 || isReordering}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStage(index, 'up');
                              }}
                              className="p-1 rounded bg-[#0D0B18] text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move Stage Up"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={index === stages.length - 1 || isReordering}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStage(index, 'down');
                              }}
                              className="p-1 rounded bg-[#0D0B18] text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move Stage Down"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(stage);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold border border-white/10 transition-colors flex items-center gap-1.5"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteStageId(stage._id);
                            }}
                            className="text-gray-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                            title="Delete Stage"
                          >
                            <Trash2 size={15} />
                          </button>

                          {/* Expand/Collapse Chevron Indicator */}
                          <div
                            className={`p-1.5 rounded-lg text-gray-400 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-purple-400' : 'text-gray-500'
                            }`}
                            title={isExpanded ? 'Collapse programs' : 'Click to view programs'}
                          >
                            <ChevronDown size={16} />
                          </div>
                        </div>
                      </div>

                      {/* Expandable Section: Lazy-loaded programs */}
                      {isExpanded && (
                        <div
                          className="mt-3.5 pt-3 border-t border-[#2D283E]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-2 px-0.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Layers size={11} className="text-purple-400" /> Programs in {stage.name}
                            </span>
                          </div>
                          <StageProgramsList stageId={stage._id} addToast={addToast} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Add Stage Placeholder Card */}
              <div
                onClick={resetForm}
                className="p-4 rounded-2xl border-2 border-dashed border-purple-500/20 hover:border-purple-500/50 bg-purple-950/10 hover:bg-purple-950/20 transition-all cursor-pointer text-center group"
              >
                <p className="text-xs font-bold text-purple-300/80 group-hover:text-purple-200 transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider">
                  <Plus size={14} className="text-pink-400" />
                  <span>Click to add Stage #{stages.length + 1}</span>
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Note */}
        <div className="p-4 rounded-2xl bg-[#120F24] border border-[#2D283E] flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"></span>
          <span>Stage priority sequence controls order on dashboard & program listings.</span>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

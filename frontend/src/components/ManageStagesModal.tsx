'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Search,
  Check,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useStages, useInvalidate, Stage } from '@/lib/queries';
import ConfirmModal from '@/components/ConfirmModal';

interface ManageStagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStageCreated?: (stage: Stage) => void;
  addToast: (toast: { title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }) => void;
}

export default function ManageStagesModal({
  isOpen,
  onClose,
  onStageCreated,
  addToast,
}: ManageStagesModalProps) {
  const { data: stages = [] } = useStages();
  const { invalidateStages, invalidatePrograms } = useInvalidate();

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

  useEffect(() => {
    if (isOpen) {
      resetForm();
      setSearchTerm('');
      setDeleteStageId(null);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const activeStagesCount = stages.filter((s: Stage) => s.status === 'active').length;

  // Filtered stages for search
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

    // Check duplicate (excluding currently editing stage)
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
        // Update stage
        const updatedStage = await apiRequest(`/stages/${editingStageId}`, 'PUT', payload);
        await invalidateStages();
        await invalidatePrograms();

        addToast({
          title: 'Stage Updated',
          message: `Stage "${updatedStage.name || trimmedName}" updated successfully.`,
          type: 'success',
        });
      } else {
        // Create stage
        const createdStage = await apiRequest('/stages', 'POST', payload);
        await invalidateStages();
        await invalidatePrograms();

        addToast({
          title: 'Stage Created',
          message: `Stage "${createdStage.name || trimmedName}" created successfully.`,
          type: 'success',
        });

        if (onStageCreated) {
          onStageCreated(createdStage);
        }
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

      // Ensure distinct positions
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

      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="relative bg-[#0E0C1A] border border-[#2D283E] rounded-3xl shadow-2xl w-full max-w-5xl xl:max-w-6xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          style={{ maxHeight: 'calc(100vh - 2.5rem)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar / Header */}
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#2D283E] flex-shrink-0 bg-[#120F24]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  <span>VENUES</span>
                  <span>&gt;</span>
                  <span>FESTIVAL STAGES</span>
                  <span>&gt;</span>
                  <span className="text-purple-400">STAGE MANAGEMENT</span>
                </div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Manage Stages
                  </h2>
                  <span className="bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {editingStageId ? 'EDITING MODE' : 'EDITOR ACTIVE'}
                  </span>
                </div>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">
                  Organize festival stages, priority ordering, and live program venues.
                </p>
              </div>

              {/* Top Stats & Close */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-950/60 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]"></span>
                    <span>{stages.length} STAGES CONFIGURED</span>
                  </div>
                  <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                    <span>{activeStagesCount} OPERATIONAL</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors border border-white/10 ml-auto md:ml-0"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Main 2-Column Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
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

                      return (
                        <div
                          key={stage._id}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                            isEditingThis
                              ? 'bg-[#1D1733] border-purple-500 shadow-lg shadow-purple-950/30'
                              : 'bg-[#141224] border-[#2D283E] hover:border-purple-500/40 hover:bg-[#18152D]'
                          }`}
                        >
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
                                onClick={() => handleMoveStage(index, 'up')}
                                className="p-1 rounded bg-[#0D0B18] text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move Stage Up"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={index === stages.length - 1 || isReordering}
                                onClick={() => handleMoveStage(index, 'down')}
                                className="p-1 rounded bg-[#0D0B18] text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move Stage Down"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => startEdit(stage)}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold border border-white/10 transition-colors flex items-center gap-1.5"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setDeleteStageId(stage._id)}
                              className="text-gray-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                              title="Delete Stage"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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
          </div>

          {/* Bottom Bar / Footer */}
          <div className="px-6 sm:px-8 py-3.5 border-t border-[#2D283E] bg-[#120F24] flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"></span>
              <span>Stage priority sequence controls order on dashboard & program listings.</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-900/30 transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
            >
              <span>DONE</span>
              <Check size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

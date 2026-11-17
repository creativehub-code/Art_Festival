'use client';

import React, { useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import {
  Hash,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { useGroups, useChestRanges, useInvalidate } from '@/lib/queries';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/useToast';

export default function ChestRangesPage() {
  const { data: groups = [] as any[] } = useGroups();
  const { data: ranges = [] as any[], isLoading: isRangesLoading } = useChestRanges();
  const { invalidateChestRanges } = useInvalidate();
  const { toasts, addToast, dismissToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<any>(null);
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    groupId: '',
    startNumber: '',
    endNumber: '',
    isActive: true,
  });

  // Map of configured group IDs
  const configuredGroupIds = useMemo(() => {
    return new Set(ranges.map((r: any) => r.groupId?._id || r.groupId));
  }, [ranges]);

  // Groups that don't have a range yet
  const unconfiguredGroups = useMemo(() => {
    return groups.filter((g: any) => !configuredGroupIds.has(g._id));
  }, [groups, configuredGroupIds]);

  // Open modal for Create
  const handleOpenCreate = (presetGroupId = '') => {
    setEditingRange(null);
    setErrorMessage(null);
    setFormData({
      groupId: presetGroupId || (unconfiguredGroups[0]?._id || ''),
      startNumber: '',
      endNumber: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (range: any) => {
    setEditingRange(range);
    setErrorMessage(null);
    setFormData({
      groupId: range.groupId?._id || range.groupId,
      startNumber: String(range.startNumber),
      endNumber: String(range.endNumber),
      isActive: range.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  // Submit Range Create / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const payload = {
        groupId: formData.groupId,
        startNumber: parseInt(formData.startNumber, 10),
        endNumber: parseInt(formData.endNumber, 10),
        isActive: formData.isActive,
      };

      await apiRequest('/chest-ranges', 'POST', payload);
      invalidateChestRanges();
      addToast({
        title: editingRange ? 'Range Updated' : 'Range Created',
        message: `Chest range [${payload.startNumber}, ${payload.endNumber}] successfully configured.`,
        type: 'success',
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save chest number range');
      addToast({
        title: 'Error',
        message: err.message || 'Failed to configure range',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteConfirmGroupId) return;
    try {
      await apiRequest(`/chest-ranges/${deleteConfirmGroupId}`, 'DELETE');
      invalidateChestRanges();
      addToast({
        title: 'Range Deleted',
        message: 'Range configuration removed successfully.',
        type: 'info',
      });
    } catch (err: any) {
      addToast({
        title: 'Delete Failed',
        message: err.message || 'Failed to delete range',
        type: 'error',
      });
    } finally {
      setDeleteConfirmGroupId(null);
    }
  };

  // Live capacity calculation for form
  const formCapacity = useMemo(() => {
    const start = parseInt(formData.startNumber, 10);
    const end = parseInt(formData.endNumber, 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return end - start + 1;
    }
    return 0;
  }, [formData.startNumber, formData.endNumber]);

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            Chest Number Ranges
          </h2>
          <p className="text-gray-400 mt-1 text-sm">
            Configure non-overlapping chest number intervals for each competition group.
          </p>
        </div>

        <button
          onClick={() => handleOpenCreate()}
          className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2 text-sm"
        >
          <Plus size={18} /> Configure New Range
        </button>
      </div>

      {/* Unconfigured Alert Banner */}
      {unconfiguredGroups.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={22} className="text-amber-400 shrink-0" />
            <div>
              <h4 className="text-amber-300 font-bold text-sm">
                {unconfiguredGroups.length} Category Group(s) without Range Configuration
              </h4>
              <p className="text-amber-200/70 text-xs mt-0.5">
                Participants in unconfigured groups will not have automatic range enforcement: {unconfiguredGroups.map((g: any) => g.name).join(', ')}.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {unconfiguredGroups.map((g: any) => (
              <button
                key={g._id}
                onClick={() => handleOpenCreate(g._id)}
                className="bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-500/30"
              >
                Set {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configured Ranges Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Hash size={20} className="text-purple-400" /> Active Range Configurations ({ranges.length})
        </h3>

        {isRangesLoading ? (
          <div className="text-gray-500 italic text-sm py-12 text-center">Loading range configurations...</div>
        ) : ranges.length === 0 ? (
          <div className="bg-[#0F1120] border border-white/[0.07] rounded-3xl p-12 text-center text-gray-500 flex flex-col items-center gap-3">
            <Layers size={36} className="text-gray-600 opacity-40" />
            <p className="text-sm">No chest number ranges have been configured yet.</p>
            <button
              onClick={() => handleOpenCreate()}
              className="mt-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-purple-500/30"
            >
              Configure First Range
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ranges.map((range: any) => {
              const groupName = range.groupId?.name || 'Unknown Group';
              const percentUsed =
                range.totalCapacity > 0
                  ? Math.min(100, Math.round((range.assignedCount / range.totalCapacity) * 100))
                  : 0;

              return (
                <div
                  key={range._id}
                  className="bg-[#0F1120] border border-white/[0.07] hover:border-purple-500/40 rounded-3xl p-6 transition-all shadow-xl relative overflow-hidden group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Top Row: Group Name & Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                        <h4 className="font-bold text-white text-base truncate">{groupName}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          range.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}
                      >
                        {range.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    {/* Range Numbers Display */}
                    <div className="bg-[#181A2D] rounded-2xl p-4 border border-white/[0.04] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Range</div>
                        <div className="font-mono text-xl font-black text-purple-300 mt-0.5">
                          {range.startNumber} – {range.endNumber}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Total Slots</div>
                        <div className="font-mono text-xl font-bold text-gray-200 mt-0.5">
                          {range.totalCapacity}
                        </div>
                      </div>
                    </div>

                    {/* Utilization Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-400">
                          Allocated: <span className="text-white font-mono">{range.assignedCount}</span>
                        </span>
                        <span className="text-gray-400">
                          Remaining: <span className="text-cyan-400 font-mono">{range.remainingCapacity}</span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            percentUsed >= 90
                              ? 'bg-red-500'
                              : percentUsed >= 70
                              ? 'bg-amber-400'
                              : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-right text-gray-500 font-mono">
                        {percentUsed}% capacity utilized
                      </div>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="pt-5 mt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <button
                      onClick={() => handleOpenEdit(range)}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 hover:underline"
                    >
                      <Edit2 size={14} /> Edit Range
                    </button>

                    <button
                      onClick={() => setDeleteConfirmGroupId(range.groupId?._id || range.groupId)}
                      className="text-gray-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Range"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Range */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121424] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6 relative">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Hash size={20} className="text-purple-400" />
                {editingRange ? 'Edit Chest Number Range' : 'Configure Group Range'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X size={20} />
              </button>
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Select Group */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Category Group
                </label>
                {editingRange ? (
                  <div className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-bold text-sm">
                    {editingRange.groupId?.name || 'Selected Group'}
                  </div>
                ) : (
                  <select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    required
                    className="w-full p-3.5 rounded-xl bg-[#0F1120] border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-purple-500 transition"
                  >
                    <option value="" disabled>
                      Select Category Group
                    </option>
                    {groups.map((g: any) => (
                      <option key={g._id} value={g._id}>
                        {g.name} {configuredGroupIds.has(g._id) ? '(Has range)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Start & End Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Start Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 100"
                    value={formData.startNumber}
                    onChange={(e) => setFormData({ ...formData, startNumber: e.target.value })}
                    className="w-full p-3.5 rounded-xl bg-[#0F1120] border border-white/10 text-white font-mono text-base focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    End Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 199"
                    value={formData.endNumber}
                    onChange={(e) => setFormData({ ...formData, endNumber: e.target.value })}
                    className="w-full p-3.5 rounded-xl bg-[#0F1120] border border-white/10 text-white font-mono text-base focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              {/* Calculated Capacity Banner */}
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-purple-300 font-medium">Calculated Capacity:</span>
                <span className="font-mono font-bold text-white">
                  {formCapacity > 0 ? `${formCapacity} participants` : 'Invalid interval'}
                </span>
              </div>

              {/* Range Active Switch */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700"
                />
                <label htmlFor="isActiveToggle" className="text-sm font-medium text-gray-300 cursor-pointer">
                  Active (enforce this range during participant registration)
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || formCapacity <= 0}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-purple-900/30"
                >
                  {isSaving ? 'Saving...' : editingRange ? 'Save Changes' : 'Create Range'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmGroupId)}
        title="Delete Chest Number Range"
        message="Are you sure you want to delete this range configuration? Participants in this group will no longer have range boundary validation."
        confirmText="Delete Range"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmGroupId(null)}
        variant="danger"
      />
    </div>
  );
}

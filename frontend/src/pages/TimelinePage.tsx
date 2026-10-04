import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DailyActivity } from '../types';
import { Calendar as CalendarIcon, Clock, Plus, Tag, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export const TimelinePage: React.FC = () => {
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [newProject, setNewProject] = useState<string>('');

  useEffect(() => {
    loadActivities();
  }, [selectedDate]);

  const loadActivities = async () => {
    try {
      const list = await api.getTimeline({ date: selectedDate });
      setActivities(list);
    } catch (err) {
      console.error('Failed to load timeline activities:', err);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await api.addActivity({
        activity_date: selectedDate,
        activity_time: newTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: newTitle.trim(),
        project_tag: newProject.trim() || undefined
      });
      setActivities([...activities, created]);
      setNewTitle('');
      setNewTime('');
      setNewProject('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add activity:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteActivity(id);
      setActivities(activities.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#00D9FF]" /> Daily Timeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Exact chronological log of activities, work, and plans preserved by Life AI.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.3)] transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Log Activity
        </button>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#202B3D] bg-[#101722]">
        <button
          onClick={() => changeDate(-1)}
          className="p-1.5 rounded-xl border border-[#202B3D] text-slate-400 hover:text-white hover:border-[#00D9FF]/40 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-[#00D9FF]" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
          />
        </div>

        <button
          onClick={() => changeDate(1)}
          className="p-1.5 rounded-xl border border-[#202B3D] text-slate-400 hover:text-white hover:border-[#00D9FF]/40 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#00D9FF] before:via-[#8B5CF6] before:to-transparent">
        {activities.map((act) => (
          <div key={act.id} className="relative group">
            {/* Timeline bullet dot */}
            <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#05070B] border-2 border-[#00D9FF] shadow-[0_0_10px_rgba(0,217,255,0.8)]" />

            <div className="p-4 rounded-2xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/40 hover:bg-[#141C28] transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#00D9FF] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {act.activity_time || 'Recorded'}
                </span>
                <div className="flex items-center gap-2">
                  {act.project_tag && (
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20 flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" /> {act.project_tag}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(act.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-100 leading-relaxed">{act.title}</p>
              {act.description && <p className="text-xs text-slate-400">{act.description}</p>}
            </div>
          </div>
        ))}

        {activities.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-[#202B3D] rounded-2xl bg-[#101722]/40">
            No activities recorded for this date. You can log an activity or talk to Life AI in daily chat!
          </div>
        )}
      </div>

      {/* Modal to log activity */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101722] border border-[#202B3D] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Log Activity on {selectedDate}</h3>
            <form onSubmit={handleAddActivity} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Activity Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Completed SQL RAG chunking algorithm"
                  className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Time (Optional)</label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="e.g. 02:30 PM"
                    className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Project Tag</label>
                  <input
                    type="text"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    placeholder="e.g. Life AI"
                    className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#202B3D] text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold cursor-pointer shadow-md shadow-[#00A8FF]/20"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

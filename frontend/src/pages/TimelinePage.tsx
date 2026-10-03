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
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-orange-400" /> Daily Timeline
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Exact chronological log of activities, work, and plans preserved by Jeet.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Log Activity
        </button>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-800/80 bg-[#121217]">
        <button
          onClick={() => changeDate(-1)}
          className="p-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-orange-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
          />
        </div>

        <button
          onClick={() => changeDate(1)}
          className="p-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-orange-500 before:via-gray-800 before:to-gray-900">
        {activities.map((act) => (
          <div key={act.id} className="relative group">
            {/* Timeline bullet dot */}
            <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#0a0a0c] border-2 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />

            <div className="p-4 rounded-2xl border border-gray-800/80 bg-[#121217] hover:border-orange-500/30 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {act.activity_time || 'Recorded'}
                </span>
                <div className="flex items-center gap-2">
                  {act.project_tag && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-300 border border-orange-500/20 flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" /> {act.project_tag}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(act.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-100 leading-relaxed">{act.title}</p>
              {act.description && <p className="text-xs text-gray-400">{act.description}</p>}
            </div>
          </div>
        ))}

        {activities.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-2xl">
            No activities recorded for this date. You can log an activity or talk to Jeet in daily chat!
          </div>
        )}
      </div>

      {/* Modal to log activity */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14141a] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Log Activity on {selectedDate}</h3>
            <form onSubmit={handleAddActivity} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">Activity Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Completed SQL RAG chunking algorithm"
                  className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Time (Optional)</label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="e.g. 02:30 PM"
                    className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Project Tag</label>
                  <input
                    type="text"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    placeholder="e.g. SQL RAG"
                    className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-800 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold"
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

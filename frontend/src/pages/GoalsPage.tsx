import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PersonalGoal } from '../types';
import {
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export const GoalsPage: React.FC = () => {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [recommendation, setRecommendation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalCategory, setNewGoalCategory] = useState<string>('career');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadGoalsData();
  }, []);

  const loadGoalsData = async () => {
    setIsLoading(true);
    try {
      const [goalsData, recData] = await Promise.all([
        api.getGoals(),
        api.getGoalRecommendation()
      ]);
      setGoals(goalsData || []);
      setRecommendation(recData?.recommendation || '');
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.createGoal({
        title: newGoalTitle.trim(),
        category: newGoalCategory,
        priority: 1,
        target_period_months: 3
      });
      setNewGoalTitle('');
      await loadGoalsData();
    } catch (err) {
      console.error('Error creating goal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'in_progress' : 'completed';
    try {
      await api.updateMilestoneStatus(milestoneId, nextStatus);
      await loadGoalsData();
    } catch (err) {
      console.error('Error updating milestone:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#202B3D] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-[#00D9FF]" />
            Personal Goals & Milestones
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Track long-term ambitions broken down into actionable, sequential roadmaps.
          </p>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      {recommendation && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#00A8FF]/10 to-[#8B5CF6]/10 border border-[#00D9FF]/30 flex items-start gap-3 shadow-lg">
          <Sparkles className="w-5 h-5 text-[#00D9FF] shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00D9FF]">
              AI Strategic Recommendation
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {recommendation}
            </p>
          </div>
        </div>
      )}

      {/* Create New Goal Card */}
      <form onSubmit={handleCreateGoal} className="p-4 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          Initialize New Target
        </span>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            placeholder="e.g. Crack software internship in 3 months"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF]"
          />
          <select
            value={newGoalCategory}
            onChange={(e) => setNewGoalCategory(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-sm text-slate-300 focus:outline-none focus:border-[#00D9FF]"
          >
            <option value="career">Career / Internship</option>
            <option value="study">Study / Academic</option>
            <option value="project">Project / Portfolio</option>
            <option value="personal">Personal Habit</option>
          </select>
          <button
            type="submit"
            disabled={isSubmitting || !newGoalTitle.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#7C3AED] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Goal
          </button>
        </div>
      </form>

      {/* Goals List */}
      {isLoading ? (
        <div className="text-center py-12 text-[#94A3B8] text-sm">Loading active goals...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 p-6 rounded-2xl border border-dashed border-[#202B3D] bg-[#101722]/40 text-[#94A3B8]">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#00D9FF]" />
          <p className="text-sm font-medium">No goals registered yet.</p>
          <p className="text-xs text-slate-500 mt-1">Add your internship or study goal above to get an automated milestone roadmap!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => (
            <div key={g.id} className="p-4 sm:p-5 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-4 hover:border-[#00D9FF]/40 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20 uppercase">
                      {g.category}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Priority {g.priority}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">{g.title}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#00D9FF]">{g.progress}% Complete</span>
                    <div className="w-24 sm:w-32 h-1.5 rounded-full bg-[#0A0F18] border border-[#202B3D] overflow-hidden mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-[#00A8FF] to-[#22C55E] transition-all"
                        style={{ width: `${g.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestones list */}
              {g.milestones && g.milestones.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#202B3D]/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-1">
                    Sequential Milestones
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.milestones.map((m) => {
                      const isDone = m.status === 'completed';
                      return (
                        <div
                          key={m.id}
                          onClick={() => handleToggleMilestone(m.id, m.status)}
                          className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                            isDone
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : 'bg-[#0A0F18] border-[#202B3D] text-slate-300 hover:border-[#00D9FF]/30'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 shrink-0 hover:text-[#00D9FF]" />
                          )}
                          <span className={`text-xs ${isDone ? 'line-through opacity-75' : ''}`}>
                            {m.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

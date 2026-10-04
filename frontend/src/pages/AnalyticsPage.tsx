import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ProductivityMetrics, DailyBrief } from '../types';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Code,
  BookOpen,
  FolderGit2,
  CheckCircle2,
  Sparkles,
  Calendar
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const [m, b] = await Promise.all([
        api.getAnalyticsMetrics(),
        api.getDailyBrief('morning')
      ]);
      setMetrics(m);
      setBrief(b);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#202B3D] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#00D9FF]" />
            Personal Productivity Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Genuine, grounded tracking across coding, study, projects, and task completions.
          </p>
        </div>
      </div>

      {/* Daily Brief Card */}
      {brief && (
        <div className="p-5 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00D9FF] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Today's AI Daily Brief ({brief.brief_date})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Yesterday</span>
              <ul className="text-xs text-slate-200 space-y-0.5">
                {brief.summary_yesterday.slice(0, 3).map((item, i) => (
                  <li key={i} className="truncate">• {item}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Today's Priorities</span>
              <ul className="text-xs text-slate-200 space-y-0.5">
                {brief.priorities_today.slice(0, 3).map((item, i) => (
                  <li key={i} className="truncate">• {item}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-1">
              <span className="text-[11px] font-semibold text-[#00D9FF] uppercase">Recommendation</span>
              <p className="text-xs text-slate-200 line-clamp-3 font-medium">
                {brief.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Stats Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[#94A3B8] text-sm">Calculating productivity statistics...</div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Highlight KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Today's Logged</span>
                <Clock className="w-3.5 h-3.5 text-[#00D9FF]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">
                {metrics.today.total_hours} <span className="text-xs font-normal text-slate-400">hours</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>This Week</span>
                <Code className="w-3.5 h-3.5 text-[#8B5CF6]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">
                {metrics.this_week.total_hours} <span className="text-xs font-normal text-slate-400">hours</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Completed Tasks</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">
                {metrics.this_week.completed_tasks} <span className="text-xs font-normal text-slate-400">tasks</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Weekly Trend</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-base sm:text-lg font-bold capitalize text-emerald-400">
                {metrics.trend}
              </p>
            </div>
          </div>

          {/* Breakdown Comparison: Today vs Week vs Month */}
          <div className="p-5 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Category Breakdown (Hours)
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5"><Code className="w-3.5 h-3.5 text-[#00A8FF]" /> Coding</span>
                  <span className="font-mono">{metrics.this_week.coding_hours}h this week / {metrics.today.coding_hours}h today</span>
                </div>
                <div className="h-2 rounded-full bg-[#0A0F18] border border-[#202B3D] overflow-hidden">
                  <div
                    className="h-full bg-[#00A8FF]"
                    style={{ width: `${Math.min(100, (metrics.this_week.coding_hours / 20) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-[#8B5CF6]" /> Study & Concepts</span>
                  <span className="font-mono">{metrics.this_week.study_hours}h this week / {metrics.today.study_hours}h today</span>
                </div>
                <div className="h-2 rounded-full bg-[#0A0F18] border border-[#202B3D] overflow-hidden">
                  <div
                    className="h-full bg-[#8B5CF6]"
                    style={{ width: `${Math.min(100, (metrics.this_week.study_hours / 15) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5"><FolderGit2 className="w-3.5 h-3.5 text-[#00D9FF]" /> Projects & Architecture</span>
                  <span className="font-mono">{metrics.this_week.project_hours}h this week</span>
                </div>
                <div className="h-2 rounded-full bg-[#0A0F18] border border-[#202B3D] overflow-hidden">
                  <div
                    className="h-full bg-[#00D9FF]"
                    style={{ width: `${Math.min(100, (metrics.this_week.project_hours / 10) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

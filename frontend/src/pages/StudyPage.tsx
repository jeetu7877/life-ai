import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StudySubject } from '../types';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  Sparkles,
  Flame,
  Award
} from 'lucide-react';

export const StudyPage: React.FC = () => {
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [newSubject, setNewSubject] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadStudyData();
  }, []);

  const loadStudyData = async () => {
    setIsLoading(true);
    try {
      const [subjs, weaks] = await Promise.all([
        api.getStudySubjects(),
        api.getWeakTopics()
      ]);
      setSubjects(subjs || []);
      setWeakTopics(weaks || []);
    } catch (err) {
      console.error('Failed to load study data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.createStudyRoadmap(newSubject.trim());
      setNewSubject('');
      await loadStudyData();
    } catch (err) {
      console.error('Error creating study roadmap:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#202B3D] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#8B5CF6]" />
            AI Study Coach & Roadmaps
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Master technical subjects with intelligent mistake tracking and weak-spot detection.
          </p>
        </div>
      </div>

      {/* Weak Spot Highlight Banner */}
      {weakTopics.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 shadow-lg">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            Identified Study Weak Areas (Targeted Practice Needed)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {weakTopics.map((w, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#0A0F18]/80 border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{w.topic}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Mastery: {w.mastery_score}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{w.weakness_reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate New Roadmap */}
      <form onSubmit={handleCreateRoadmap} className="p-4 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          Start Learning New Subject
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="e.g. JavaScript, Python, DSA, Operating Systems, SQL"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6]"
          />
          <button
            type="submit"
            disabled={isSubmitting || !newSubject.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#C026D3] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Generate Roadmap
          </button>
        </div>
      </form>

      {/* Subjects & Roadmaps List */}
      {isLoading ? (
        <div className="text-center py-12 text-[#94A3B8] text-sm">Loading study subjects...</div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-12 p-6 rounded-2xl border border-dashed border-[#202B3D] bg-[#101722]/40 text-[#94A3B8]">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#8B5CF6]" />
          <p className="text-sm font-medium">No active study roadmaps yet.</p>
          <p className="text-xs text-slate-500 mt-1">Enter a subject like "JavaScript" above to generate your automated curriculum!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((subj) => (
            <div key={subj.id} className="p-4 sm:p-5 rounded-2xl bg-[#101722] border border-[#202B3D] space-y-4 hover:border-[#8B5CF6]/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20 uppercase">
                      {subj.category}
                    </span>
                    <span className="text-xs text-slate-400 capitalize flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-yellow-400" /> {subj.confidence_level}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">{subj.name}</h3>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-[#8B5CF6]">{subj.overall_progress}% Mastered</span>
                  <div className="w-24 sm:w-32 h-1.5 rounded-full bg-[#0A0F18] border border-[#202B3D] overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#00D9FF]"
                      style={{ width: `${subj.overall_progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Topics Grid */}
              <div className="space-y-2 pt-2 border-t border-[#202B3D]/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Curriculum & Mastery Topics
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {subj.topics?.map((topic) => {
                    const isWeak = topic.is_weak_spot;
                    const isMastered = topic.status === 'mastered';
                    return (
                      <div
                        key={topic.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 transition-all ${
                          isWeak
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            : isMastered
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                            : 'bg-[#0A0F18] border-[#202B3D] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold truncate">{topic.name}</span>
                          {isWeak ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 font-bold shrink-0">
                              WEAK
                            </span>
                          ) : isMastered ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {topic.mastery_score}%
                            </span>
                          )}
                        </div>
                        {topic.weakness_reason && (
                          <p className="text-[10px] text-amber-400/80 line-clamp-1">{topic.weakness_reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PersonalProfile } from '../types';
import { User, Save, Plus, X, Sparkles, GraduationCap, Briefcase, Target, Code } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [newSkill, setNewSkill] = useState<string>('');
  const [newGoal, setNewGoal] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    try {
      const updated = await api.updateProfile(profile);
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim() || !profile) return;
    const skills = [...(profile.skills || [])];
    if (!skills.includes(newSkill.trim())) {
      skills.push(newSkill.trim());
      setProfile({ ...profile, skills });
    }
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: profile.skills.filter(s => s !== skill)
    });
  };

  const addGoal = () => {
    if (!newGoal.trim() || !profile) return;
    const goals = [...(profile.goals || [])];
    goals.push(newGoal.trim());
    setProfile({ ...profile, goals });
    setNewGoal('');
  };

  const removeGoal = (idx: number) => {
    if (!profile) return;
    setProfile({
      ...profile,
      goals: profile.goals.filter((_, i) => i !== idx)
    });
  };

  if (!profile) {
    return <div className="p-8 text-center text-xs text-gray-500">Loading your profile...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-[#00D9FF]" /> Personal Profile
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Structured information about your identity, skills, goals, and focus.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.3)] transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-xs font-medium">
          Profile updated successfully! Life AI context memory has been synchronized.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00D9FF]" /> Identity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Full Name</label>
              <input
                type="text"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Preferred Name / Nickname</label>
              <input
                type="text"
                value={profile.preferred_name || ''}
                onChange={(e) => setProfile({ ...profile, preferred_name: e.target.value })}
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
          </div>
        </div>

        {/* Education */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#00D9FF]" /> Education & College
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400">College / University</label>
              <input
                type="text"
                value={profile.college || ''}
                onChange={(e) => setProfile({ ...profile, college: e.target.value })}
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Degree</label>
              <input
                type="text"
                value={profile.degree || ''}
                onChange={(e) => setProfile({ ...profile, degree: e.target.value })}
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Branch</label>
              <input
                type="text"
                value={profile.branch || ''}
                onChange={(e) => setProfile({ ...profile, branch: e.target.value })}
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
          </div>
        </div>

        {/* Current Focus */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#8B5CF6]" /> Current Work & Focus
          </h3>
          <div>
            <label className="text-xs text-slate-400">What are you currently focusing on?</label>
            <input
              type="text"
              value={profile.current_focus || ''}
              onChange={(e) => setProfile({ ...profile, current_focus: e.target.value })}
              placeholder="e.g. Building Personal AI Companion with SQL RAG & ChromaDB"
              className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
            />
          </div>
        </div>

        {/* Skills Management */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#00D9FF]" /> Skills & Technologies
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add skill (e.g. Python, FastAPI, React, Node.js)"
              className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-4 py-2.5 rounded-xl bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {(profile.skills || []).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#00D9FF]/15 border border-[#00D9FF]/30 text-[#00D9FF] text-xs font-medium"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="hover:text-red-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#C026D3]" /> Goals & Ambitions
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Add goal (e.g. Master LangChain and AI Agent deployment)"
              className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addGoal();
                }
              }}
            />
            <button
              type="button"
              onClick={addGoal}
              className="px-4 py-2.5 rounded-xl bg-[#C026D3]/10 text-[#C026D3] border border-[#C026D3]/30 hover:bg-[#C026D3]/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <ul className="space-y-2 pt-2">
            {(profile.goals || []).map((goal, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-slate-300"
              >
                <span>• {goal}</span>
                <button
                  type="button"
                  onClick={() => removeGoal(idx)}
                  className="text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </form>
    </div>
  );
};

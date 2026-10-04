import React, { useState, useEffect, useRef } from 'react';
import { api, getServerHostUrl } from '../services/api';
import { PersonalProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import {
  User,
  Save,
  Plus,
  X,
  Sparkles,
  GraduationCap,
  Briefcase,
  Target,
  Code,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  UploadCloud,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error, info } = useToast();

  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [newSkill, setNewSkill] = useState<string>('');
  const [newGoal, setNewGoal] = useState<string>('');
  const [newInterest, setNewInterest] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [showDeleteAvatarDialog, setShowDeleteAvatarDialog] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    try {
      const updated = await api.updateProfile(profile);
      setProfile(updated);
      success('Profile updated successfully!');
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      error(err.response?.data?.detail || 'Failed to save profile updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error('Invalid file type. Please upload a PNG, JPEG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      error('File is too large. Avatar image must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingAvatar(true);
    try {
      const res = await api.uploadAvatar(formData);
      success(res.message || 'Avatar uploaded successfully!');
      if (profile) {
        setProfile({ ...profile, avatar_url: res.avatar_url });
      }
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      error(err.response?.data?.detail || 'Avatar upload failed.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await api.removeAvatar();
      success('Avatar photo removed.');
      if (profile) {
        setProfile({ ...profile, avatar_url: undefined });
      }
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      console.error('Failed to delete avatar:', err);
      error('Failed to remove avatar.');
    } finally {
      setShowDeleteAvatarDialog(false);
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
      skills: profile.skills.filter((s) => s !== skill)
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

  const addInterest = () => {
    if (!newInterest.trim() || !profile) return;
    const interests = [...(profile.interests || [])];
    if (!interests.includes(newInterest.trim())) {
      interests.push(newInterest.trim());
      setProfile({ ...profile, interests });
    }
    setNewInterest('');
  };

  const removeInterest = (item: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      interests: profile.interests.filter((i) => i !== item)
    });
  };

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-400">
        Loading profile data...
      </div>
    );
  }

  const avatarDisplayUrl = profile.avatar_url
    ? profile.avatar_url.startsWith('http')
      ? profile.avatar_url
      : `${getServerHostUrl()}${profile.avatar_url}`
    : null;

  const completionPct = profile.completion_percentage ?? 75;
  const missingItems = profile.missing_fields || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-white tracking-tight">Personal Profile</h2>
            {user?.is_verified ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Account
              </span>
            ) : (
              <Link
                to="/verify-email"
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Verify Email
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Structured information powering Life AI's contextual knowledge, personal twin, and voice recall.
          </p>
        </div>
        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.3)] transition-all cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Completion Indicator */}
      <div className="p-4 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00D9FF]" />
            <span className="text-xs font-bold text-slate-200">Profile Completeness</span>
          </div>
          <span className="text-xs font-bold text-[#00D9FF]">{completionPct}%</span>
        </div>
        <div className="w-full h-2 bg-[#0A0F18] rounded-full overflow-hidden border border-[#202B3D]">
          <div
            className="h-full bg-gradient-to-r from-[#00A8FF] via-[#00D9FF] to-[#22C55E] transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {missingItems.length > 0 && (
          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 pt-1">
            <span>Missing for 100%:</span>
            {missingItems.map((item) => (
              <span key={item} className="px-2 py-0.5 rounded-md bg-[#16202E] text-slate-300 font-medium">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Profile Photo / Avatar Card */}
      <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#00D9FF]" /> Profile Avatar
        </h3>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#202B3D] bg-[#0A0F18] flex items-center justify-center shadow-lg">
              {avatarDisplayUrl ? (
                <img src={avatarDisplayUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-slate-600" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[11px] font-semibold transition-opacity cursor-pointer"
            >
              <UploadCloud className="w-5 h-5 mb-1" />
              Upload
            </button>
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1">
            <p className="text-xs text-slate-300 font-medium">Upload your personal photo or avatar</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Supports PNG, JPG, or WEBP up to 5MB. Rendered in app navigation and personal twin.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFileChange}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="px-3.5 py-1.5 rounded-xl bg-[#16202E] hover:bg-[#1E2D40] border border-[#202B3D] text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                {isUploadingAvatar ? 'Uploading...' : avatarDisplayUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              {avatarDisplayUrl && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAvatarDialog(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-semibold text-red-400 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Personal Details */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-[#00D9FF]" /> Personal Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-medium">Full Name</label>
              <input
                type="text"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="e.g. Vikash Yadav"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Preferred / Nickname</label>
              <input
                type="text"
                value={profile.preferred_name || ''}
                onChange={(e) => setProfile({ ...profile, preferred_name: e.target.value })}
                placeholder="e.g. Jeetu"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium">Bio / About You</label>
            <textarea
              rows={3}
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="A brief overview about your interests, passions, and background..."
              className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Timezone
              </label>
              <input
                type="text"
                value={profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                placeholder="e.g. Asia/Kolkata"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" /> Preferred Language
              </label>
              <select
                value={profile.language || 'Hinglish'}
                onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              >
                <option value="Hinglish">Hinglish (Hindi + English)</option>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Education & Academic Details */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#8B5CF6]" /> Education & Academics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-medium">College / University</label>
              <input
                type="text"
                value={profile.college || ''}
                onChange={(e) => setProfile({ ...profile, college: e.target.value })}
                placeholder="e.g. NIT Jalandhar"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Degree & Branch</label>
              <input
                type="text"
                value={profile.branch || ''}
                onChange={(e) => setProfile({ ...profile, branch: e.target.value })}
                placeholder="e.g. B.Tech Computer Science & Engineering"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Batch / Graduation Year</label>
              <input
                type="text"
                value={profile.batch || ''}
                onChange={(e) => setProfile({ ...profile, batch: e.target.value })}
                placeholder="e.g. 2024-2028"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Current Focus / Priority</label>
              <input
                type="text"
                value={profile.current_focus || ''}
                onChange={(e) => setProfile({ ...profile, current_focus: e.target.value })}
                placeholder="e.g. Full-Stack AI Agents & DSA"
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
            </div>
          </div>
        </div>

        {/* Technical Skills */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#00A8FF]" /> Technical Skills
          </h3>
          <p className="text-xs text-slate-400">
            Skills help Life AI personalize code snippets, review GitHub projects, and guide study sessions.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="e.g. React, FastApi, PyTorch, Docker"
              className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-4 py-2 rounded-xl bg-[#16202E] hover:bg-[#1E2D40] border border-[#202B3D] text-xs font-semibold text-[#00D9FF] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(profile.skills || []).map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-slate-200 font-medium"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#22C55E]" /> Primary Goals
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addGoal();
                }
              }}
              placeholder="e.g. Crack Google internship, Master Agentic RAG"
              className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
            />
            <button
              type="button"
              onClick={addGoal}
              className="px-4 py-2 rounded-xl bg-[#16202E] hover:bg-[#1E2D40] border border-[#202B3D] text-xs font-semibold text-[#22C55E] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {(profile.goals || []).map((goal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-slate-200"
              >
                <span>{goal}</span>
                <button
                  type="button"
                  onClick={() => removeGoal(idx)}
                  className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.4)] transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Saving Changes...' : 'Save All Changes'}
          </button>
        </div>
      </form>

      {/* Confirmation Dialog for Avatar Deletion */}
      <ConfirmationDialog
        isOpen={showDeleteAvatarDialog}
        title="Remove Profile Avatar"
        message="Are you sure you want to remove your profile photo? It will revert to the default avatar."
        confirmLabel="Remove Photo"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleDeleteAvatar}
        onCancel={() => setShowDeleteAvatarDialog(false)}
      />
    </div>
  );
};

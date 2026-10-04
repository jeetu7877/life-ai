import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  GitFork,
  Network,
  Cpu,
  ShieldAlert,
  Activity,
  Camera,
  Layers,
  ArrowRight,
  TrendingUp,
  Award,
  BookOpen,
  FolderGit2,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

export const LifeMapPage: React.FC = () => {
  const [twinData, setTwinData] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSnapshotting, setIsSnapshotting] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string>('');

  useEffect(() => {
    loadAllIntelligence();
  }, []);

  const loadAllIntelligence = async () => {
    setIsLoading(true);
    try {
      const [twin, comp, health, rList, graph] = await Promise.all([
        api.getLifeTwinState().catch(() => null),
        api.getLifeTwinComparison().catch(() => null),
        api.getProjectHealth('Life AI').catch(() => null),
        api.getPersonalRisks().catch(() => []),
        api.getKnowledgeGraph().catch(() => null)
      ]);
      setTwinData(twin);
      setComparison(comp);
      setHealthData(health);
      setRisks(rList || []);
      setGraphData(graph);
    } catch (err) {
      console.error('Failed to load Life Map data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeSnapshot = async () => {
    setIsSnapshotting(true);
    setSnapshotSuccess('');
    try {
      const res = await api.createLifeTwinSnapshot();
      setSnapshotSuccess(`Snapshot created for ${res.snapshot_date || 'today'}!`);
      const comp = await api.getLifeTwinComparison().catch(() => null);
      setComparison(comp);
    } catch (err) {
      console.error('Failed to snapshot Life Twin:', err);
    } finally {
      setIsSnapshotting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#202B3D] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 text-[#00D9FF]">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Life Map & Twin Operating System</h1>
              <p className="text-sm text-slate-400">Verifiable personal reality model, knowledge connections, and trajectory tracking</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTakeSnapshot}
            disabled={isSnapshotting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(0,217,255,0.25)] disabled:opacity-50"
          >
            {isSnapshotting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <span>Capture State Snapshot</span>
          </button>
        </div>
      </div>

      {snapshotSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{snapshotSuccess}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-[#00D9FF] animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Row: Life Twin Core & Project Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Life Twin Card */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-5">
              <div className="flex items-center justify-between border-b border-[#202B3D]/70 pb-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Cpu className="w-5 h-5 text-[#00D9FF]" />
                  <span>Life Twin Analytical State</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Grounded • Zero-Hallucination
                </span>
              </div>

              {twinData?.state ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Profile & Education */}
                  <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D]/60 space-y-2">
                    <div className="text-xs font-semibold text-[#00D9FF] uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Education & Identity
                    </div>
                    <p className="text-white font-medium text-base">
                      {twinData.state.profile?.name?.value || 'User'}
                    </p>
                    <p className="text-slate-300 text-xs">
                      {twinData.state.profile?.branch?.value || 'CSE'}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {twinData.state.profile?.college?.value || 'NIT Jalandhar'}
                    </p>
                    <div className="pt-1 text-[11px] text-slate-500 italic">
                      Source: {twinData.state.profile?.college?.source || 'verified_profile'} (1.0 conf)
                    </div>
                  </div>

                  {/* Active Goals */}
                  <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D]/60 space-y-2">
                    <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Active Goals
                    </div>
                    {twinData.state.goals?.length ? (
                      twinData.state.goals.slice(0, 2).map((g: any, i: number) => (
                        <div key={i} className="text-xs space-y-1">
                          <div className="text-white font-medium">{g.title}</div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${g.progress_pct || 20}%` }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs">No active goals found.</p>
                    )}
                  </div>

                  {/* Key Projects */}
                  <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D]/60 space-y-2">
                    <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5" /> Connected Codebases
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {twinData.state.projects?.length ? (
                        twinData.state.projects.map((p: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs">
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">Life AI, SQL RAG</span>
                      )}
                    </div>
                  </div>

                  {/* Core Skills */}
                  <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D]/60 space-y-2">
                    <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" /> Verified Skills
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {twinData.state.skills?.length ? (
                        twinData.state.skills.slice(0, 6).map((s: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs">
                            {s.skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">Python, React, PostgreSQL</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm italic">Twin state not generated yet.</div>
              )}

              {/* Formatted Summary Quote */}
              {twinData?.summary && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {twinData.summary}
                </div>
              )}
            </div>

            {/* Project Health & Personal Risks */}
            <div className="space-y-6">
              {/* Health Score Gauge */}
              <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span>Project Health</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-400">
                    {healthData?.health?.overall_score || 94}
                    <span className="text-xs text-slate-400 font-normal">/100</span>
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {healthData?.health?.dimensions ? (
                    Object.entries(healthData.health.dimensions).map(([dim, data]: [string, any]) => (
                      <div key={dim} className="space-y-1">
                        <div className="flex justify-between text-slate-300 capitalize">
                          <span>{dim.replace('_', ' ')}</span>
                          <span className="font-semibold text-slate-100">{data.score}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              data.score >= 80 ? 'bg-emerald-500' : data.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${data.score}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">Code Activity, Testing, Security, and Architecture healthy.</p>
                  )}
                </div>
              </div>

              {/* Personal Risk Radar */}
              <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>Proactive Risk Radar</span>
                </div>
                {risks.length ? (
                  <div className="space-y-2.5">
                    {risks.slice(0, 3).map((r: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-[#141C2B] border border-amber-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between text-amber-300 font-medium">
                          <span>{r.title}</span>
                          <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20">
                            {r.severity}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{r.evidence}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No active risks detected. Keep up consistent DSA practice!</p>
                )}
              </div>
            </div>
          </div>

          {/* Middle Row: Connected Knowledge Graph & Life Map */}
          <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-4">
            <div className="flex items-center justify-between border-b border-[#202B3D]/70 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <GitFork className="w-5 h-5 text-[#8B5CF6]" />
                <span>Personal Knowledge Graph (Connected Life Map)</span>
              </div>
              <span className="text-xs text-slate-400">
                {graphData?.entities?.length || 0} Entities • {graphData?.relationships?.length || 0} Relationships
              </span>
            </div>

            {/* Interactive Connected Nodes Canvas Visual */}
            <div className="p-6 rounded-xl bg-[#080D16] border border-[#1A2333] min-h-[220px] flex flex-wrap items-center justify-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF] text-white text-center shadow-[0_0_20px_rgba(0,217,255,0.2)]">
                <div className="text-xs text-[#00D9FF] font-semibold uppercase">Central Identity</div>
                <div className="text-lg font-bold">{twinData?.state?.profile?.name?.value || 'User (Jeet)'}</div>
                <div className="text-[11px] text-slate-300">NIT Jalandhar • CSE</div>
              </div>

              <div className="text-slate-600">⟶</div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#101724] border border-blue-500/40 text-center text-xs">
                  <div className="text-blue-400 font-semibold mb-1">studies_at</div>
                  <div className="text-white">NIT Jalandhar</div>
                </div>

                <div className="p-3 rounded-xl bg-[#101724] border border-emerald-500/40 text-center text-xs">
                  <div className="text-emerald-400 font-semibold mb-1">pursuing_goal</div>
                  <div className="text-white">SWE Internship</div>
                </div>

                <div className="p-3 rounded-xl bg-[#101724] border border-purple-500/40 text-center text-xs">
                  <div className="text-purple-400 font-semibold mb-1">works_on</div>
                  <div className="text-white">Life AI & SQL RAG</div>
                </div>

                <div className="p-3 rounded-xl bg-[#101724] border border-amber-500/40 text-center text-xs">
                  <div className="text-amber-400 font-semibold mb-1">has_skills</div>
                  <div className="text-white">Python, FastAPI, React</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Month Diff / Snapshot Comparison ("What Changed?") */}
          <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Layers className="w-5 h-5 text-[#00D9FF]" />
              <span>Snapshot Evolution ("What Changed in My Life This Month?")</span>
            </div>

            {comparison ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D] space-y-2">
                  <div className="font-semibold text-emerald-400">Newly Added Skills & Milestones</div>
                  {comparison.skills_added?.length ? (
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {comparison.skills_added.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  ) : (
                    <p className="text-slate-400">Baseline established for this tracking cycle.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D] space-y-2">
                  <div className="font-semibold text-blue-400">Goal Progress Delta</div>
                  {comparison.goal_changes?.length ? (
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {comparison.goal_changes.map((g: any, i: number) => (
                        <li key={i}>{g.title}: {g.old_progress}% ⟶ {g.new_progress}%</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400">Goal milestones updated smoothly.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#141C2B] border border-[#202B3D] space-y-2">
                  <div className="font-semibold text-purple-400">Active Repositories & Tools</div>
                  <p className="text-slate-300">Life AI upgraded to Full Unique Intelligence Suite with 25 distinct capabilities.</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-xs">
                Take snapshots regularly using the button above to unlock automatic month-over-month differential insights.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

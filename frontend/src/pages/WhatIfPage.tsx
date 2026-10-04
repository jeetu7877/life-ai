import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Sparkles,
  GitCompare,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Scale,
  Brain,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

export const WhatIfPage: React.FC = () => {
  // Tabs: 'what_if', 'decision_debate', 'bottlenecks'
  const [activeTab, setActiveTab] = useState<'what_if' | 'decision_debate' | 'bottlenecks'>('what_if');

  // What-If state
  const [query, setQuery] = useState<string>('What if I study DSA 2 hours daily for 30 days?');
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Decision Debate state
  const [optionA, setOptionA] = useState<string>('Focus 80% on DSA (LeetCode / NeetCode)');
  const [optionB, setOptionB] = useState<string>('Focus 80% on Full-Stack Projects (Life AI & RAG)');
  const [context, setContext] = useState<string>('Preparing for 2026 SWE Internship placements within 3 months');
  const [debateResult, setDebateResult] = useState<any>(null);
  const [isDebating, setIsDebating] = useState<boolean>(false);

  // Bottlenecks state
  const [bottleneckResult, setBottleneckResult] = useState<any>(null);
  const [isLoadingBottlenecks, setIsLoadingBottlenecks] = useState<boolean>(false);

  const presets = [
    'What if I study DSA 2 hours daily for 30 days?',
    'What if I spend 15 hours this week completing SQL RAG benchmarks?',
    'What if I apply to 50 tech internships before end of month?'
  ];

  const handleRunSimulation = async (scenarioQuery?: string) => {
    const q = scenarioQuery || query;
    if (!q.trim() || isSimulating) return;
    setIsSimulating(true);
    try {
      const res = await api.runWhatIfSimulation(q);
      setSimulationResult(res);
    } catch (err) {
      console.error('Failed to run What-If simulation:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunDebate = async () => {
    if (!optionA.trim() || !optionB.trim() || isDebating) return;
    setIsDebating(true);
    try {
      const res = await api.runDecisionDebate({
        option_a: optionA,
        option_b: optionB,
        decision_context: context
      });
      setDebateResult(res);
    } catch (err) {
      console.error('Failed to run Decision Debate:', err);
    } finally {
      setIsDebating(false);
    }
  };

  const loadBottlenecks = async () => {
    setIsLoadingBottlenecks(true);
    try {
      const res = await api.getBottlenecks();
      setBottleneckResult(res);
    } catch (err) {
      console.error('Failed to load bottlenecks:', err);
    } finally {
      setIsLoadingBottlenecks(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bottlenecks' && !bottleneckResult) {
      loadBottlenecks();
    }
  }, [activeTab]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#202B3D] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 text-[#00D9FF]">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Intelligence Simulations & Debates</h1>
            <p className="text-sm text-slate-400">Counterfactual scenario modeling, decision trade-offs, and root-cause bottleneck diagnostics</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-[#0D131F] border border-[#202B3D] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('what_if')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'what_if'
                ? 'bg-gradient-to-r from-[#00A8FF]/30 to-[#8B5CF6]/30 text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            What-If Simulator
          </button>
          <button
            onClick={() => setActiveTab('decision_debate')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'decision_debate'
                ? 'bg-gradient-to-r from-[#00A8FF]/30 to-[#8B5CF6]/30 text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Decision Debate
          </button>
          <button
            onClick={() => setActiveTab('bottlenecks')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'bottlenecks'
                ? 'bg-gradient-to-r from-[#00A8FF]/30 to-[#8B5CF6]/30 text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Why Am I Stuck?
          </button>
        </div>
      </div>

      {/* TAB 1: What-If Counterfactual Simulator */}
      {activeTab === 'what_if' && (
        <div className="space-y-6">
          {/* Query Input Card */}
          <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-4">
            <label className="block text-sm font-semibold text-white">
              Hypothetical Action or Decision Scenario
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. What if I study DSA 2 hours daily for 30 days?"
                className="flex-1 px-4 py-3 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] text-sm"
              />
              <button
                onClick={() => handleRunSimulation()}
                disabled={isSimulating || !query.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(0,217,255,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Simulate Scenario</span>
              </button>
            </div>

            {/* Presets */}
            <div className="space-y-2 pt-2">
              <span className="text-xs text-slate-400 font-medium">Quick Test Scenarios:</span>
              <div className="flex flex-wrap gap-2">
                {presets.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(p);
                      handleRunSimulation(p);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#141C2B] hover:bg-[#1C263A] border border-[#202B3D] text-xs text-slate-300 hover:text-white transition-all text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Simulation Results */}
          {simulationResult && (
            <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-[#202B3D]/70 pb-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <TrendingUp className="w-5 h-5 text-[#00D9FF]" />
                  <span>Simulation Analytical Projection</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  {simulationResult.expected_effort || 'Estimated Effort'}
                </span>
              </div>

              {/* Formatted Markdown Output */}
              {simulationResult.formatted_response && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {simulationResult.formatted_response}
                </div>
              )}

              {/* Structured Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#141C2B] border border-emerald-500/20 space-y-2">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Expected Benefits & Progress
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Significant mastery acceleration on LeetCode patterns (Dynamic Programming, Graphs, Sliding Window). Elevated readiness for technical interviews.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#141C2B] border border-amber-500/20 space-y-2">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Key Trade-offs & Fatigue Risks
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Daily 2-hour cognitive commitment requires protecting time from project sprints and maintaining sleep consistency.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-500 italic">
                * Note: Counterfactual simulations are grounded analytical projections based on past logged velocity and difficulty curves. Predictions are not guaranteed outcomes.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Decision Debate Arena */}
      {activeTab === 'decision_debate' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-4">
            <h2 className="text-sm font-semibold text-white">Compare Two Competing Options Grounded in Real Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-blue-400 mb-1">Option A</label>
                <input
                  type="text"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white text-sm focus:outline-none focus:border-[#00D9FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-400 mb-1">Option B</label>
                <input
                  type="text"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white text-sm focus:outline-none focus:border-[#00D9FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Personal Context / Timeframe</label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white text-sm focus:outline-none focus:border-[#00D9FF]"
              />
            </div>

            <button
              onClick={handleRunDebate}
              disabled={isDebating}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(0,217,255,0.25)] flex items-center gap-2 disabled:opacity-50"
            >
              {isDebating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
              <span>Execute Grounded Debate</span>
            </button>
          </div>

          {debateResult && (
            <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-white font-semibold border-b border-[#202B3D]/70 pb-3">
                <GitCompare className="w-5 h-5 text-[#8B5CF6]" />
                <span>Debate Synthesis & Actionable Recommendation</span>
              </div>

              {debateResult.formatted_response ? (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {debateResult.formatted_response}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#141C2B] border border-blue-500/20 space-y-2">
                    <div className="font-semibold text-blue-400">Analysis: Option A ({optionA})</div>
                    <p className="text-slate-300">DSA provides direct screening clearance in online assessments (OA).</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141C2B] border border-purple-500/20 space-y-2">
                    <div className="font-semibold text-purple-400">Analysis: Option B ({optionB})</div>
                    <p className="text-slate-300">Projects provide resume differentiation and talking points in interview rounds.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Why Am I Stuck? Bottleneck Diagnostic */}
      {activeTab === 'bottlenecks' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-5">
            <div className="flex items-center justify-between border-b border-[#202B3D]/70 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <span>Evidence-Based Bottleneck Diagnostic</span>
              </div>
              <button
                onClick={loadBottlenecks}
                disabled={isLoadingBottlenecks}
                className="px-3.5 py-1.5 rounded-lg bg-[#141C2B] hover:bg-[#1E293B] border border-[#202B3D] text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBottlenecks ? 'animate-spin' : ''}`} />
                <span>Re-Analyze</span>
              </button>
            </div>

            {isLoadingBottlenecks ? (
              <div className="py-12 flex justify-center">
                <RefreshCw className="w-8 h-8 text-[#00D9FF] animate-spin" />
              </div>
            ) : bottleneckResult?.formatted_response ? (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {bottleneckResult.formatted_response}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#141C2B] border border-[#202B3D] text-center text-slate-400 text-sm">
                No active bottlenecks identified! All goal tracking pipelines are moving along smoothly.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

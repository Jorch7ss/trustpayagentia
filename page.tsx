"use client";
// app/page.tsx — Dashboard principal de TrustPay Agent

import { useState } from "react";
import { evaluatePayment, hashReport } from "@/engine/riskEngine";
import { analyzeWithAgent, checkOllamaStatus } from "@/engine/trustPayAgent";
import { ALL_SCENARIOS } from "@/engine/demoScenarios";
import type { RiskReport, AgentResponse } from "@/engine/riskEngine";

// ─── Tipos locales ─────────────────────────────────────────────
interface UIState {
  report:    RiskReport | null;
  agent:     AgentResponse | null;
  hash:      string | null;
  loading:   boolean;
  scenario:  number;
}

// ─── Helpers de color ──────────────────────────────────────────
const verdictColor = (v?: string) => ({
  ACCEPTED: "text-emerald-400",
  REVIEW:   "text-amber-400",
  REJECTED: "text-red-400",
}[v ?? ""] ?? "text-zinc-400");

const verdictBg = (v?: string) => ({
  ACCEPTED: "bg-emerald-400/10 border-emerald-400/30",
  REVIEW:   "bg-amber-400/10 border-amber-400/30",
  REJECTED: "bg-red-400/10 border-red-400/30",
}[v ?? ""] ?? "");

const verdictBar = (v?: string) => ({
  ACCEPTED: "bg-emerald-400",
  REVIEW:   "bg-amber-400",
  REJECTED: "bg-red-400",
}[v ?? ""] ?? "bg-zinc-600");

const verdictLabel = (v?: string) => ({
  ACCEPTED: "ACEPTADO",
  REVIEW:   "REVISAR",
  REJECTED: "RECHAZADO",
}[v ?? ""] ?? "—");

// ─── Componente Score Ring ─────────────────────────────────────
function ScoreRing({ score, verdict }: { score: number; verdict: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const stroke = { ACCEPTED: "#34d399", REVIEW: "#fbbf24", REJECTED: "#f87171" }[verdict] ?? "#71717a";

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={stroke} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - fill}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset .6s ease, stroke .3s" }}
      />
      <text x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="500"
        fill="#f4f4f5" fontFamily="'DM Mono', monospace">{score}</text>
    </svg>
  );
}

// ─── Componente Factor Row ─────────────────────────────────────
function FactorRow({ factor, verdict }: { factor: any; verdict: string }) {
  const cls = factor.passed
    ? "bg-emerald-400/10 text-emerald-400"
    : verdict === "REVIEW"
    ? "bg-amber-400/10 text-amber-400"
    : "bg-red-400/10 text-red-400";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-800 last:border-0">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${cls}`}>
        {factor.passed ? "✓" : "✗"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-200">{factor.name}</p>
        <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">{factor.detail}</p>
      </div>
      <span className="text-[11px] font-mono text-zinc-600 pl-2 flex-shrink-0">−{factor.weight}</span>
    </div>
  );
}

// ─── Dashboard principal ───────────────────────────────────────
export default function Dashboard() {
  const [ui, setUi] = useState<UIState>({
    report: null, agent: null, hash: null, loading: false, scenario: -1,
  });

  async function runScenario(idx: number) {
    setUi(prev => ({ ...prev, loading: true, scenario: idx }));

    const s      = ALL_SCENARIOS[idx];
    const report = evaluatePayment(s.invoice, s.tx, s.wallet);
    const hash   = await hashReport(report);
    const agent  = await analyzeWithAgent(report);

    setUi({ report, agent, hash, loading: false, scenario: idx });
  }

  const { report, agent, hash, loading, scenario } = ui;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-zinc-100 font-[Syne,sans-serif]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
          <h1 className="text-sm font-bold tracking-[.12em]">
            TRUST<span className="text-emerald-400">PAY</span> AGENT
          </h1>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            MOTOR LOCAL ACTIVO
          </div>
        </div>

        {/* Scenario selector */}
        <p className="font-mono text-[10px] tracking-[.15em] text-zinc-500 mb-3">
          ESCENARIO DE DEMO
        </p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: "CASO 1\nConfiable",  color: "emerald" },
            { label: "CASO 2\nDudoso",     color: "amber"   },
            { label: "CASO 3\nRiesgoso",   color: "red"     },
          ].map((s, i) => {
            const active = scenario === i;
            const colors: Record<string, string> = {
              emerald: active ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" : "",
              amber:   active ? "border-amber-400 text-amber-400 bg-amber-400/10" : "",
              red:     active ? "border-red-400 text-red-400 bg-red-400/10" : "",
            };
            return (
              <button
                key={i}
                onClick={() => runScenario(i)}
                disabled={loading}
                className={`
                  py-2 px-3 rounded-md border font-mono text-[11px] text-center leading-5
                  transition-all cursor-pointer disabled:opacity-50
                  ${active ? colors[s.color] : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}
                  ${loading && scenario === i ? "animate-pulse" : ""}
                `}
              >
                {s.label.split("\n").map((l, j) => (
                  <span key={j} className={`block ${j === 0 ? "font-semibold" : ""}`}>{l}</span>
                ))}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {!report && !loading && (
          <div className="border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-600 font-mono text-sm">
              Selecciona un escenario para verificar
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="border border-zinc-800 rounded-xl p-12 text-center animate-pulse">
            <p className="text-zinc-500 font-mono text-sm">Verificando pago...</p>
          </div>
        )}

        {/* Main result card */}
        {report && !loading && (
          <>
            <div className="bg-[#13131a] border border-zinc-800 rounded-xl overflow-hidden mb-4">

              {/* Verdict banner */}
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <div>
                  <p className="font-mono text-[10px] tracking-[.15em] text-zinc-500 mb-1">VEREDICTO</p>
                  <p className={`text-2xl font-bold tracking-wide ${verdictColor(report.verdict)}`}>
                    {verdictLabel(report.verdict)}
                  </p>
                </div>
                <ScoreRing score={report.score} verdict={report.verdict} />
              </div>

              {/* Score bar */}
              <div className="h-[3px] bg-zinc-800 mx-5 mb-5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${verdictBar(report.verdict)}`}
                  style={{ width: `${report.score}%` }}
                />
              </div>

              {/* TX fields grid */}
              <div className="grid grid-cols-2 border-b border-zinc-800">
                {[
                  { label: "FACTURA",       value: report.invoiceId,           ok: true },
                  { label: "TX HASH",       value: `${report.txHash.slice(0, 14)}…`, ok: true },
                  { label: "SCORE",         value: `${report.score}/100`,      ok: report.score <= 30 },
                  { label: "NIVEL",         value: report.level,               ok: report.level === "LOW" },
                ].map((f, i) => (
                  <div key={i} className={`p-4 ${i % 2 === 0 ? "border-r border-zinc-800" : ""} ${i >= 2 ? "border-t border-zinc-800" : ""}`}>
                    <p className="font-mono text-[10px] tracking-[.08em] text-zinc-500 mb-1">{f.label}</p>
                    <p className={`font-mono text-xs ${f.ok ? "text-emerald-400" : report.score > 70 ? "text-red-400" : "text-amber-400"}`}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Factors */}
              <div className="p-5">
                {report.factors.map((f, i) => (
                  <FactorRow key={i} factor={f} verdict={report.verdict} />
                ))}
              </div>
            </div>

            {/* Agent analysis */}
            {agent && (
              <div className="bg-[#13131a] border border-zinc-800 rounded-xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="font-mono text-[10px] tracking-[.15em] text-zinc-500">ANÁLISIS DEL AGENTE</p>
                  <span className="font-mono text-[10px] bg-[#1a1a2e] border border-[#2a2a50] rounded px-2 py-0.5 text-[#8888cc]">
                    {agent.source.toUpperCase()} · {agent.source === "ollama" ? "OFFLINE" : agent.source === "anthropic" ? "ONLINE" : "ESTÁTICO"}
                  </span>
                </div>
                <p className="text-[13px] text-zinc-300 leading-relaxed mb-3">{agent.explanation}</p>
                <div className={`font-mono text-xs p-3 rounded-md border-l-2 leading-relaxed ${verdictBg(report.verdict)} ${verdictColor(report.verdict)}`}>
                  {agent.recommendation}
                </div>
              </div>
            )}

            {/* Report hash */}
            <p className="font-mono text-[10px] tracking-[.15em] text-zinc-500 mb-2">HASH DEL REPORTE (ON-CHAIN)</p>
            <div className="bg-[#13131a] border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
              <p className="font-mono text-[10px] text-zinc-500 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {hash}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(hash ?? "")}
                className="font-mono text-[10px] text-zinc-500 border border-zinc-700 rounded px-2 py-1 hover:text-zinc-300 hover:border-zinc-500 transition-all flex-shrink-0"
              >
                COPIAR
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

"use client";

// app/page.tsx — Dashboard principal de TrustPay Agent

import { useState } from "react";
import { evaluatePayment, hashReport } from "@/engine/riskEngine";
import { analyzeWithAgent } from "@/engine/trustPayAgent";
import { ALL_SCENARIOS } from "@/engine/demoScenarios";
import type { RiskReport, AgentResponse } from "@/engine/riskEngine";

// ─── Logo SVG (fiel a la imagen del usuario) ───────────────────
function TrustPayLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="tGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f8ef7" />
          <stop offset="100%" stopColor="#6c5ce7" />
        </linearGradient>
        <linearGradient id="pGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5a7ff5" />
          <stop offset="50%" stopColor="#7c6ef5" />
          <stop offset="100%" stopColor="#5533cc" />
        </linearGradient>
      </defs>
      {/* T horizontal bar */}
      <rect x="10" y="10" width="100" height="18" rx="9" fill="url(#tGrad)" />
      {/* T vertical stem */}
      <rect x="18" y="10" width="18" height="72" rx="9" fill="url(#tGrad)" />
      {/* P bowl — outer arc */}
      <path
        d="M36 28 C36 28 95 24 95 58 C95 88 60 90 36 86"
        stroke="url(#pGrad)"
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
      {/* P inner cutout illusion */}
      <path
        d="M36 40 C36 40 78 38 78 58 C78 74 55 76 36 74"
        stroke="#0a0a0f"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Tipos locales ─────────────────────────────────────────────
interface UIState {
  report: RiskReport | null;
  agent: AgentResponse | null;
  hash: string | null;
  loading: boolean;
  scenario: number;
}

// ─── Helpers de color ──────────────────────────────────────────
const verdictColor = (v?: string) =>
  ({ ACCEPTED: "text-emerald-400", REVIEW: "text-amber-400", REJECTED: "text-red-400" }[v ?? ""] ?? "text-zinc-400");

const verdictBg = (v?: string) =>
  ({
    ACCEPTED: "bg-emerald-400/10 border-emerald-400/30",
    REVIEW: "bg-amber-400/10 border-amber-400/30",
    REJECTED: "bg-red-400/10 border-red-400/30",
  }[v ?? ""] ?? "");

const verdictBar = (v?: string) =>
  ({ ACCEPTED: "bg-emerald-400", REVIEW: "bg-amber-400", REJECTED: "bg-red-400" }[v ?? ""] ?? "bg-zinc-600");

const verdictLabel = (v?: string) =>
  ({ ACCEPTED: "ACEPTADO", REVIEW: "REVISAR", REJECTED: "RECHAZADO" }[v ?? ""] ?? "—");

// ─── Score Ring ────────────────────────────────────────────────
function ScoreRing({ score, verdict }: { score: number; verdict: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const stroke = { ACCEPTED: "#34d399", REVIEW: "#fbbf24", REJECTED: "#f87171" }[verdict] ?? "#71717a";

  return (
    <svg width="76" height="76" viewBox="0 0 76 76">
      <circle cx="38" cy="38" r={r} fill="none" stroke="#1e1e2e" strokeWidth="6" />
      <circle
        cx="38" cy="38" r={r} fill="none"
        stroke={stroke} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - fill}
        transform="rotate(-90 38 38)"
        style={{ transition: "stroke-dashoffset .7s ease, stroke .3s" }}
      />
      <text x="38" y="44" textAnchor="middle" fontSize="15" fontWeight="600"
        fill="#f4f4f5" fontFamily="'DM Mono', monospace">{score}</text>
    </svg>
  );
}

// ─── Factor Row ────────────────────────────────────────────────
function FactorRow({ factor, verdict }: { factor: any; verdict: string }) {
  const cls = factor.passed
    ? "bg-emerald-400/15 text-emerald-400"
    : verdict === "REVIEW"
    ? "bg-amber-400/15 text-amber-400"
    : "bg-red-400/15 text-red-400";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/60 last:border-0">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${cls}`}>
        {factor.passed ? "✓" : "✗"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-zinc-200 leading-snug">{factor.name}</p>
        <p className="text-[11px] font-mono text-zinc-500 leading-relaxed mt-0.5">{factor.detail}</p>
      </div>
      <span className="text-[11px] font-mono text-zinc-600 pl-2 flex-shrink-0 mt-0.5">−{factor.weight}</span>
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
    const s = ALL_SCENARIOS[idx];
    const report = evaluatePayment(s.invoice, s.tx, s.wallet);
    const hash = await hashReport(report);
    const agent = await analyzeWithAgent(report);
    setUi({ report, agent, hash, loading: false, scenario: idx });
  }

  const { report, agent, hash, loading, scenario } = ui;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-zinc-100" style={{ fontFamily: "var(--font-syne), sans-serif" }}>

      {/* Subtle background grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-2xl mx-auto px-5 py-8">

        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-10 pb-5 border-b border-zinc-800">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3">
            <TrustPayLogo size={38} />
            <div className="leading-none">
              <p className="text-[15px] font-bold tracking-[.06em] text-zinc-100">
                Trust<span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg,#4f8ef7,#6c5ce7)" }}>Pay</span>
              </p>
              <p className="text-[10px] font-mono tracking-[.18em] text-zinc-500 mt-[3px]">AGENT</p>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            MOTOR LOCAL ACTIVO
          </div>
        </header>

        {/* ── Scenario selector ── */}
        <p className="font-mono text-[10px] tracking-[.2em] text-zinc-500 mb-3 uppercase">
          Escenario de Demo
        </p>
        <div className="grid grid-cols-3 gap-2.5 mb-8">
          {[
            { label: "Caso 1", sub: "Confiable", color: "emerald" },
            { label: "Caso 2", sub: "Dudoso", color: "amber" },
            { label: "Caso 3", sub: "Riesgoso", color: "red" },
          ].map((s, i) => {
            const active = scenario === i;
            const colorMap: Record<string, string> = {
              emerald: "border-emerald-400 text-emerald-300 bg-emerald-400/10",
              amber: "border-amber-400 text-amber-300 bg-amber-400/10",
              red: "border-red-400 text-red-300 bg-red-400/10",
            };
            return (
              <button
                key={i}
                onClick={() => runScenario(i)}
                disabled={loading}
                className={`
                  py-3 px-3 rounded-xl border font-mono text-center leading-snug
                  transition-all duration-200 cursor-pointer disabled:opacity-50
                  ${active
                    ? colorMap[s.color]
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-900"
                  }
                  ${loading && scenario === i ? "animate-pulse" : ""}
                `}
              >
                <span className="block text-[12px] font-bold tracking-wide">{s.label}</span>
                <span className="block text-[11px] opacity-80 mt-0.5">{s.sub}</span>
              </button>
            );
          })}
        </div>

        {/* ── Empty state ── */}
        {!report && !loading && (
          <div className="border border-zinc-800 rounded-2xl p-14 text-center bg-[#0d0d14]">
            <div className="flex justify-center mb-4 opacity-20">
              <TrustPayLogo size={48} />
            </div>
            <p className="text-zinc-500 font-mono text-sm">
              Selecciona un escenario para verificar
            </p>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="border border-zinc-800 rounded-2xl p-14 text-center bg-[#0d0d14] animate-pulse">
            <p className="text-zinc-500 font-mono text-sm">Verificando pago...</p>
          </div>
        )}

        {/* ── Main result ── */}
        {report && !loading && (
          <>
            {/* Result card */}
            <div className="bg-[#0e0e18] border border-zinc-800 rounded-2xl overflow-hidden mb-4 shadow-xl shadow-black/40">

              {/* Verdict banner */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
                <div>
                  <p className="font-mono text-[10px] tracking-[.2em] text-zinc-500 mb-1.5 uppercase">Veredicto</p>
                  <p className={`text-[26px] font-extrabold tracking-wide ${verdictColor(report.verdict)}`}>
                    {verdictLabel(report.verdict)}
                  </p>
                </div>
                <ScoreRing score={report.score} verdict={report.verdict} />
              </div>

              {/* Score bar */}
              <div className="h-[3px] bg-zinc-800 mx-6 mb-6 mt-1 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${verdictBar(report.verdict)}`}
                  style={{ width: `${report.score}%` }}
                />
              </div>

              {/* TX grid */}
              <div className="grid grid-cols-2 border-b border-zinc-800 mx-0">
                {[
                  { label: "FACTURA", value: report.invoiceId, ok: true },
                  { label: "TX HASH", value: `${report.txHash.slice(0, 14)}…`, ok: true },
                  { label: "SCORE", value: `${report.score}/100`, ok: report.score <= 30 },
                  { label: "NIVEL", value: report.level, ok: report.level === "LOW" },
                ].map((f, i) => (
                  <div
                    key={i}
                    className={`px-6 py-4
                      ${i % 2 === 0 ? "border-r border-zinc-800" : ""}
                      ${i >= 2 ? "border-t border-zinc-800" : ""}
                    `}
                  >
                    <p className="font-mono text-[10px] tracking-[.12em] text-zinc-500 mb-1.5 uppercase">{f.label}</p>
                    <p className={`font-mono text-[13px] font-medium ${f.ok ? "text-emerald-400" : report.score > 70 ? "text-red-400" : "text-amber-400"}`}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Factors */}
              <div className="px-6 py-2">
                {report.factors.map((f, i) => (
                  <FactorRow key={i} factor={f} verdict={report.verdict} />
                ))}
              </div>
            </div>

            {/* Agent analysis */}
            {agent && (
              <div className="bg-[#0e0e18] border border-zinc-800 rounded-2xl px-6 py-5 mb-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <p className="font-mono text-[10px] tracking-[.2em] text-zinc-500 uppercase">Análisis del Agente</p>
                  <span className="font-mono text-[10px] bg-[#14143a] border border-[#2a2a60] rounded-md px-2.5 py-0.5 text-[#9999dd]">
                    {agent.source.toUpperCase()} · {agent.source === "ollama" ? "OFFLINE" : agent.source === "anthropic" ? "ONLINE" : "ESTÁTICO"}
                  </span>
                </div>
                <p className="text-[13.5px] text-zinc-300 leading-relaxed mb-4 font-[var(--font-syne)]">{agent.explanation}</p>
                <div className={`font-mono text-[12px] p-4 rounded-xl border-l-2 leading-relaxed ${verdictBg(report.verdict)} ${verdictColor(report.verdict)}`}>
                  {agent.recommendation}
                </div>
              </div>
            )}

            {/* Report hash */}
            <p className="font-mono text-[10px] tracking-[.2em] text-zinc-500 mb-2 uppercase">Hash del Reporte (On-Chain)</p>
            <div className="bg-[#0e0e18] border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <p className="font-mono text-[10px] text-zinc-500 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {hash}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(hash ?? "")}
                className="font-mono text-[10px] text-zinc-400 border border-zinc-700 rounded-lg px-3 py-1.5 hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 transition-all flex-shrink-0"
              >
                COPIAR
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-5 border-t border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2 opacity-40">
                <TrustPayLogo size={16} />
                <p className="font-mono text-[10px] text-zinc-500">TrustPay Agent v0.1</p>
              </div>
              <p className="font-mono text-[10px] text-zinc-700">Fallback local disponible</p>
            </div>
          </>
        )}

      </div>
    </main>
  );
}

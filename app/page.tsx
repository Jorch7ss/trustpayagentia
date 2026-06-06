"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_SCENARIOS } from "../engine/demoScenarios";
import { evaluatePayment, hashReport } from "../engine/riskEngine";
import { analyzeWithAgent, checkOllamaStatus } from "../engine/trustPayAgent";
import type { AgentResponse } from "../engine/trustPayAgent";
import type { Invoice, RiskReport, Transaction, WalletContext } from "../engine/riskEngine";

type ToastType = "success" | "info" | "error";

type FormState = {
  invoiceId: string;
  expectedAmount: string;
  paidAmount: string;
  txHash: string;
  payerWallet: string;
  destinationMatch: boolean;
  tokenMatch: boolean;
  network: "arbitrum-sepolia" | "arbitrum" | "ethereum" | "polygon";
  allowlisted: boolean;
  blacklisted: boolean;
  txCount: string;
  previousPayments: string;
  fundedMinutesAgo: string;
  payerIdentity: "verified" | "known" | "new" | "flagged";
  bitsoSource: "Pay with Bitso" | "Bitso Business" | "Juno" | "Manual transfer";
};

type UIState = {
  report: RiskReport | null;
  agent: AgentResponse | null;
  hash: string | null;
  loading: boolean;
  scenario: number;
  ollamaOnline: boolean;
  toast: { message: string; type: ToastType } | null;
};

const MERCHANT_WALLET = "0xA1b2C3d4E5f6A1b2C3d4E5f6A1b2C3d4E5f6A1b2";
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const WRONG_TOKEN = "0x000000000000000000000000000000000000BAD0";
const WRONG_WALLET = "0x000000000000000000000000000000000000F00D";

const initialForm: FormState = {
  invoiceId: "INV-2049",
  expectedAmount: "2450",
  paidAmount: "2450",
  txHash: "0xpay204900000000000000000000000000000000000000000000000000000001",
  payerWallet: "0xCLIENTE_EMPRESARIAL_2049000000000000000000",
  destinationMatch: true,
  tokenMatch: true,
  network: "arbitrum-sepolia",
  allowlisted: true,
  blacklisted: false,
  txCount: "38",
  previousPayments: "4",
  fundedMinutesAgo: "",
  payerIdentity: "verified",
  bitsoSource: "Pay with Bitso",
};

const verdictCopy = {
  ACCEPTED: {
    label: "Aceptar",
    tone: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/25",
    bar: "bg-emerald-400",
    action: "Liberar pedido, marcar factura como pagada y conservar hash del reporte.",
  },
  REVIEW: {
    label: "Revisar",
    tone: "text-amber-300",
    bg: "bg-amber-400/10",
    border: "border-amber-400/25",
    bar: "bg-amber-400",
    action: "Pedir comprobante adicional, validar identidad y escalar a finanzas/compliance.",
  },
  REJECTED: {
    label: "Rechazar",
    tone: "text-red-300",
    bg: "bg-red-400/10",
    border: "border-red-400/25",
    bar: "bg-red-400",
    action: "No liberar producto o servicio; abrir revisión formal de riesgo.",
  },
} as const;

const productModules = [
  ["Orden", "Factura, monto esperado, token aceptado y wallet oficial del comercio."],
  ["Pago", "Hash, red, monto recibido, token usado y wallet de origen."],
  ["Riesgo", "Allowlist, blacklist, historial, relación previa y fondeo reciente."],
  ["Decisión", "Aceptar, revisar o rechazar con explicación clara para negocio."],
];

const customerBenefits = [
  "Menos pagos retenidos por incertidumbre operativa.",
  "Más claridad para equipos no técnicos.",
  "Auditoría sin publicar datos sensibles en blockchain.",
  "Narrativa lista para Bitso, stablecoins y empresas mexicanas.",
];

function toUnits(amount: string): bigint {
  const normalized = amount.replace(/,/g, "").trim();
  const [whole = "0", decimals = ""] = normalized.split(".");
  const padded = `${decimals}000000`.slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(padded || "0");
}

function short(value: string, start = 8, end = 6) {
  if (!value || value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildCustomInput(form: FormState): { invoice: Invoice; tx: Transaction; wallet: WalletContext } {
  return {
    invoice: {
      invoiceId: form.invoiceId || "INV-SIN-ID",
      merchantWallet: MERCHANT_WALLET,
      expectedAmount: toUnits(form.expectedAmount || "0"),
      acceptedToken: USDC_ADDRESS,
    },
    tx: {
      txHash: form.txHash || "0xcustom0000000000000000000000000000000000000000000000000000000001",
      from: form.payerWallet || "0xUNKNOWN_PAYER",
      to: form.destinationMatch ? MERCHANT_WALLET : WRONG_WALLET,
      token: form.tokenMatch ? USDC_ADDRESS : WRONG_TOKEN,
      amount: toUnits(form.paidAmount || "0"),
      network: form.network,
      blockNumber: 12_900_410,
      timestamp: Date.now(),
    },
    wallet: {
      isAllowlisted: form.allowlisted || form.payerIdentity === "verified",
      isBlacklisted: form.blacklisted || form.payerIdentity === "flagged",
      firstSeenTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30,
      txCount: toNumber(form.txCount),
      previousPayments: toNumber(form.previousPayments),
      fundedMinutesAgo: form.fundedMinutesAgo.trim() === "" ? null : toNumber(form.fundedMinutesAgo),
    },
  };
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
        checked ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-white/[0.08] bg-white/[0.025] text-zinc-400"
      }`}
    >
      <span>{label}</span>
      <span className={`ml-3 h-4 w-7 rounded-full p-0.5 ${checked ? "bg-emerald-400" : "bg-zinc-700"}`}>
        <span className={`block h-3 w-3 rounded-full bg-zinc-950 transition ${checked ? "translate-x-3" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2800);
    return () => clearTimeout(timer);
  }, [onClose]);

  const color = type === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : type === "error" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return <div className={`fixed right-5 top-5 z-50 rounded-lg border px-4 py-3 text-xs backdrop-blur-xl ${color}`}>{message}</div>;
}

function DecisionPanel({ report, agent, hash, onCopy }: { report: RiskReport | null; agent: AgentResponse | null; hash: string | null; onCopy: (text: string) => void }) {
  if (!report) {
    return (
      <div className="glass-card flex min-h-[520px] flex-col justify-between rounded-2xl p-6">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-zinc-500">Consola de decisión</p>
          <h3 className="mt-3 text-2xl font-semibold text-zinc-100">Carga una factura o usa un escenario.</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-500">El producto debe responder una pregunta simple: ¿este pago se puede aceptar con confianza?</p>
        </div>
        <div className="rounded-lg border border-dashed border-white/10 p-5 text-sm leading-7 text-zinc-500">
          Aquí aparecerán score, veredicto, señales fallidas, recomendación operativa y hash auditable.
        </div>
      </div>
    );
  }

  const copy = verdictCopy[report.verdict];
  const failed = report.factors.filter((factor) => !factor.passed);
  const passed = report.factors.length - failed.length;

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className={`h-1 ${copy.bar}`} />
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-zinc-500">Recomendación TrustPay</p>
          <h3 className={`mt-3 text-4xl font-bold ${copy.tone}`} style={{ fontFamily: "var(--font-syne), sans-serif" }}>{copy.label}</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-400">Factura {report.invoiceId} · Riesgo {report.score}/100 · Nivel {report.level}</p>
        </div>
        <div className={`rounded-2xl border ${copy.border} ${copy.bg} p-5 text-center`}>
          <p className="text-5xl font-bold text-zinc-50">{report.score}</p>
          <p className="mt-1 text-xs uppercase tracking-[.16em] text-zinc-500">risk score</p>
        </div>
      </div>

      <div className="mx-6 grid overflow-hidden rounded-lg border border-white/[0.06] md:grid-cols-4">
        {[
          ["TX", short(report.txHash), report.txHash],
          ["Controles OK", `${passed}/9`, ""],
          ["Alertas", `${failed.length}`, ""],
          ["Evidencia", hash ? short(hash) : "generando", hash || ""],
        ].map(([label, value, full]) => (
          <button key={label} onClick={() => full && onCopy(full)} className="border-b border-r border-white/[0.06] bg-[#090910] p-3 text-left last:border-r-0 md:border-b-0">
            <p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">{label}</p>
            <p className={`mt-1 truncate text-xs font-medium ${copy.tone}`}>{value}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_.9fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[.18em] text-zinc-500">Señales evaluadas</p>
            <p className="text-xs text-zinc-500">{failed.length === 0 ? "sin alertas" : `${failed.length} por atender`}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
            {report.factors.map((factor) => (
              <div key={factor.name} className="flex gap-3 border-b border-white/[0.05] p-3 last:border-0">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${factor.passed ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{factor.passed ? "✓" : "!"}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{factor.name}</p>
                  <p className="mt-1 text-xs leading-6 text-zinc-500">{factor.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`rounded-lg border-l-2 p-4 ${copy.border} ${copy.bg}`}>
            <p className="text-xs uppercase tracking-[.16em] text-zinc-500">Siguiente acción</p>
            <p className={`mt-2 text-sm leading-7 ${copy.tone}`}>{copy.action}</p>
          </div>
          {agent && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="text-xs uppercase tracking-[.16em] text-zinc-500">Explicación del agente</p>
              <p className="mt-3 text-sm leading-7 text-zinc-300">{agent.explanation}</p>
              <p className="mt-4 rounded-lg bg-white/[0.035] p-3 text-sm leading-7 text-zinc-400">{agent.recommendation}</p>
            </div>
          )}
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-[.16em] text-zinc-500">Auditoría Arbitrum</p>
            <p className="mt-3 text-sm leading-7 text-zinc-400">El reporte completo se mantiene privado. Solo el hash queda listo para registrarse como prueba de integridad.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrustPayProduct() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [ui, setUi] = useState<UIState>({ report: null, agent: null, hash: null, loading: false, scenario: -1, ollamaOnline: false, toast: null });

  useEffect(() => {
    checkOllamaStatus().then((status) => setUi((prev) => ({ ...prev, ollamaOnline: status.available })));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => setUi((prev) => ({ ...prev, toast: { message, type } })), []);

  async function evaluate(invoice: Invoice, tx: Transaction, wallet: WalletContext, scenario = -1) {
    setUi((prev) => ({ ...prev, loading: true, scenario }));
    const report = evaluatePayment(invoice, tx, wallet);
    const [hash, agent] = await Promise.all([hashReport(report), analyzeWithAgent(report)]);
    setUi((prev) => ({ ...prev, report, agent, hash, loading: false, scenario }));
    showToast(`Decisión generada: ${verdictCopy[report.verdict].label}`, report.verdict === "REJECTED" ? "error" : report.verdict === "REVIEW" ? "info" : "success");
  }

  function runCustom() {
    const input = buildCustomInput(form);
    evaluate(input.invoice, input.tx, input.wallet, -1);
  }

  function runScenario(index: number) {
    const item = ALL_SCENARIOS[index];
    evaluate(item.invoice, item.tx, item.wallet, index);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    showToast("Copiado al portapapeles", "success");
  }

  const riskPreview = useMemo(() => {
    const input = buildCustomInput(form);
    return evaluatePayment(input.invoice, input.tx, input.wallet).score;
  }, [form]);

  return (
    <main className="min-h-screen">
      {ui.toast && <Toast message={ui.toast.message} type={ui.toast.type} onClose={() => setUi((prev) => ({ ...prev, toast: null }))} />}

      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <a href="#inicio" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-sm font-bold text-emerald-300">TP</span>
          <span><span className="block text-sm font-bold tracking-wide">TrustPay Agent</span><span className="block text-[10px] uppercase tracking-[.14em] text-zinc-500">Stablecoin payment risk copilot</span></span>
        </a>
        <nav className="hidden items-center gap-6 text-xs text-zinc-400 md:flex">
          <a href="#producto" className="hover:text-zinc-100">Producto</a><a href="#consola" className="hover:text-zinc-100">Consola</a><a href="#capas" className="hover:text-zinc-100">Bitso + Arbitrum</a><a href="#consola" className="rounded-lg border border-white/10 px-3 py-2 text-zinc-100 hover:bg-white/[0.04]">Probar decisión</a>
        </nav>
      </header>

      <section id="inicio" className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-14">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-zinc-400">Bitso hace usable · Arbitrum verificable · TrustPay decidible</div>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] text-zinc-50 md:text-6xl" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Acepta pagos con stablecoins sin operar a ciegas.</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400 md:text-lg">TrustPay Agent revisa si el dinero llegó, si corresponde a una factura y si la fuente del pago parece confiable. El resultado no es un dato técnico: es una decisión clara para la empresa.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#consola" className="rounded-lg bg-emerald-300 px-5 py-3 text-center text-sm font-semibold text-zinc-950 hover:bg-emerald-200">Evaluar un pago</a><a href="#producto" className="rounded-lg border border-white/12 px-5 py-3 text-center text-sm font-semibold text-zinc-100 hover:bg-white/[0.04]">Ver propuesta</a></div>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[["9", "señales de riesgo"], ["3", "decisiones posibles"], ["0", "datos sensibles on-chain"]].map(([n, label]) => <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-2xl font-bold text-zinc-100">{n}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></div>)}
          </div>
        </div>
        <div className="glass-card overflow-hidden rounded-2xl p-5">
          <div className="flex items-start justify-between border-b border-white/[0.06] pb-4"><div><p className="text-xs uppercase tracking-[.18em] text-zinc-500">Live decision</p><p className="mt-1 text-xl font-semibold text-zinc-100">Factura B2B · USDC</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">Arbitrum</span></div>
          <div className="mt-5 space-y-3">{productModules.map(([title, text]) => <div key={title} className="rounded-lg bg-white/[0.03] p-4"><p className="text-sm font-semibold text-zinc-100">{title}</p><p className="mt-1 text-xs leading-6 text-zinc-500">{text}</p></div>)}</div>
        </div>
      </section>

      <section id="producto" className="border-y border-white/[0.06] bg-white/[0.02]"><div className="mx-auto grid max-w-7xl gap-5 px-5 py-14 md:grid-cols-4">{customerBenefits.map((benefit) => <div key={benefit} className="rounded-lg border border-white/[0.08] bg-[#0b0b12] p-5 text-sm leading-7 text-zinc-300">{benefit}</div>)}</div></section>

      <section id="consola" className="mx-auto grid max-w-7xl gap-6 px-5 py-16 lg:grid-cols-[.9fr_1.1fr]">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-zinc-500">Consola de evaluación</p><h2 className="mt-3 text-3xl font-bold text-zinc-50" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Configura el pago como lo revisaría una empresa.</h2></div><span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">Preview {riskPreview}/100</span></div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-zinc-500">Factura<input value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500">Canal Bitso<select value={form.bitsoSource} onChange={(e) => setForm({ ...form, bitsoSource: e.target.value as FormState["bitsoSource"] })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40"><option>Pay with Bitso</option><option>Bitso Business</option><option>Juno</option><option>Manual transfer</option></select></label>
            <label className="text-xs text-zinc-500">Monto esperado<input value={form.expectedAmount} onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500">Monto recibido<input value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500 md:col-span-2">TX hash<input value={form.txHash} onChange={(e) => setForm({ ...form, txHash: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500 md:col-span-2">Wallet origen<input value={form.payerWallet} onChange={(e) => setForm({ ...form, payerWallet: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500">Red<select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value as FormState["network"] })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40"><option value="arbitrum-sepolia">Arbitrum Sepolia</option><option value="arbitrum">Arbitrum One</option><option value="ethereum">Ethereum</option><option value="polygon">Polygon</option></select></label>
            <label className="text-xs text-zinc-500">Identidad pagador<select value={form.payerIdentity} onChange={(e) => setForm({ ...form, payerIdentity: e.target.value as FormState["payerIdentity"] })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40"><option value="verified">Verificada</option><option value="known">Conocida</option><option value="new">Nueva</option><option value="flagged">Marcada</option></select></label>
            <label className="text-xs text-zinc-500">Tx previas<input value={form.txCount} onChange={(e) => setForm({ ...form, txCount: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500">Pagos previos<input value={form.previousPayments} onChange={(e) => setForm({ ...form, previousPayments: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
            <label className="text-xs text-zinc-500 md:col-span-2">Fondeo reciente en minutos<input placeholder="vacío = sin señal" value={form.fundedMinutesAgo} onChange={(e) => setForm({ ...form, fundedMinutesAgo: e.target.value })} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40" /></label>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2"><Toggle checked={form.destinationMatch} label="Wallet destino coincide" onChange={(v) => setForm({ ...form, destinationMatch: v })} /><Toggle checked={form.tokenMatch} label="Token correcto" onChange={(v) => setForm({ ...form, tokenMatch: v })} /><Toggle checked={form.allowlisted} label="Allowlist empresa" onChange={(v) => setForm({ ...form, allowlisted: v })} /><Toggle checked={form.blacklisted} label="Blacklist / alerta" onChange={(v) => setForm({ ...form, blacklisted: v })} /></div>
          <button onClick={runCustom} disabled={ui.loading} className="mt-5 w-full rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-200 disabled:opacity-60">{ui.loading ? "Evaluando..." : "Generar decisión TrustPay"}</button>
          <div className="mt-5 grid gap-2 md:grid-cols-3">{["Confiable", "Dudoso", "Riesgoso"].map((label, index) => <button key={label} onClick={() => runScenario(index)} className={`rounded-lg border px-3 py-2 text-xs ${ui.scenario === index ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100" : "border-white/[0.08] text-zinc-400 hover:bg-white/[0.04]"}`}>Caso {label}</button>)}</div>
        </div>

        <div>{ui.loading ? <div className="glass-card flex min-h-[520px] flex-col items-center justify-center rounded-2xl p-8"><div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/25 border-t-emerald-300" /><p className="mt-5 text-sm text-zinc-400">Evaluando pago...</p></div> : <DecisionPanel report={ui.report} agent={ui.agent} hash={ui.hash} onCopy={copy} />}</div>
      </section>

      <section id="capas" className="border-t border-white/[0.06] bg-white/[0.02]"><div className="mx-auto grid max-w-7xl gap-5 px-5 py-14 md:grid-cols-3"><div className="rounded-lg border border-white/[0.08] bg-[#0b0b12] p-6"><h3 className="text-lg font-semibold text-zinc-100">Bitso como capa usable</h3><p className="mt-3 text-sm leading-7 text-zinc-500">Fiat-stablecoin, pesos mexicanos, posibles webhooks empresariales y canales como Pay with Bitso, Bitso Business o Juno según disponibilidad.</p></div><div className="rounded-lg border border-white/[0.08] bg-[#0b0b12] p-6"><h3 className="text-lg font-semibold text-zinc-100">Arbitrum como capa verificable</h3><p className="mt-3 text-sm leading-7 text-zinc-500">Pagos baratos, lectura rápida, trazabilidad pública y registro auditable de hashes sin exponer el reporte completo.</p></div><div className="rounded-lg border border-white/[0.08] bg-[#0b0b12] p-6"><h3 className="text-lg font-semibold text-zinc-100">Agente como capa de decisión</h3><p className="mt-3 text-sm leading-7 text-zinc-500">Traduce hash, wallet, monto, token, red, historial y reputación en una recomendación que finanzas sí puede usar.</p></div></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-zinc-600 md:flex-row md:items-center md:justify-between"><p>TrustPay Agent v0.1 · Producto de decisión para pagos con stablecoins</p><p>{ui.ollamaOnline ? "IA local disponible" : "Fallback local disponible"}</p></footer>
    </main>
  );
}

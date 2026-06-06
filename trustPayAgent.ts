// engine/trustPayAgent.ts
// Agente IA local — usa Ollama por defecto (100% offline).
// Si Ollama no está disponible, cae a Anthropic API como fallback.

import type { RiskReport } from "./riskEngine";

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────

const OLLAMA_URL   = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    || "llama3.2";

// ─────────────────────────────────────────────
//  TIPOS
// ─────────────────────────────────────────────

export interface AgentResponse {
  explanation:    string;   // explicación en lenguaje natural para la empresa
  recommendation: string;   // acción concreta sugerida
  source:         "ollama" | "anthropic" | "fallback";  // quién respondió
}

// ─────────────────────────────────────────────
//  PROMPT PRINCIPAL
// ─────────────────────────────────────────────

function buildPrompt(report: RiskReport): string {
  const factorLines = report.factors
    .map(f => `  [${f.passed ? "✓" : "✗"}] ${f.name}: ${f.detail}`)
    .join("\n");

  return `Eres el asistente de riesgo de TrustPay. Ayudas a empresas a decidir si deben confiar en un pago recibido con stablecoins.

Analiza este reporte y responde EN ESPAÑOL con dos secciones:

1. EXPLICACIÓN (2-3 oraciones): qué pasó con este pago y por qué tiene ese nivel de riesgo.
2. RECOMENDACIÓN (1 oración): qué debe hacer la empresa ahora mismo.

Sé directo y usa lenguaje empresarial, no técnico.

─── REPORTE ───
Factura:      ${report.invoiceId}
TX Hash:      ${report.txHash}
Puntaje:      ${report.score}/100
Veredicto:    ${report.verdict}
Nivel:        ${report.level}

Factores evaluados:
${factorLines}

Resumen técnico:
${report.summary}
───────────────

Responde SOLO con las dos secciones. Sin introducción ni despedida.`;
}

// ─────────────────────────────────────────────
//  OLLAMA — modelo local, offline
// ─────────────────────────────────────────────

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:  OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000), // 30s timeout
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

  const data = await res.json();
  return data.response as string;
}

// ─────────────────────────────────────────────
//  ANTHROPIC — fallback si no hay Ollama
// ─────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);

  const data = await res.json();
  return data.content[0].text as string;
}

// ─────────────────────────────────────────────
//  PARSER de respuesta del modelo
// ─────────────────────────────────────────────

function parseAgentResponse(raw: string): { explanation: string; recommendation: string } {
  const expMatch  = raw.match(/EXPLICACI[ÓO]N[:\s]+([\s\S]*?)(?=RECOMENDACI[ÓO]N|$)/i);
  const recMatch  = raw.match(/RECOMENDACI[ÓO]N[:\s]+([\s\S]*?)$/i);

  return {
    explanation:    expMatch?.[1]?.trim() || raw.trim(),
    recommendation: recMatch?.[1]?.trim() || "Consultar con el equipo de finanzas antes de proceder.",
  };
}

// ─────────────────────────────────────────────
//  RESPUESTA ESTÁTICA — sin IA disponible
// ─────────────────────────────────────────────

function staticResponse(report: RiskReport): AgentResponse {
  const verdictMap = {
    ACCEPTED: {
      explanation:    `El pago para la factura ${report.invoiceId} pasó todos los controles de verificación con un puntaje de riesgo de ${report.score}/100. La wallet origen, el monto y el token son correctos.`,
      recommendation: "El pago puede procesarse con normalidad.",
    },
    REVIEW: {
      explanation:    `El pago para la factura ${report.invoiceId} presenta algunos puntos de atención (riesgo ${report.score}/100). ${report.factors.filter(f => !f.passed).length} factor(es) no pasaron la verificación.`,
      recommendation: "Solicitar comprobante adicional o confirmación directa antes de liberar el pedido.",
    },
    REJECTED: {
      explanation:    `El pago para la factura ${report.invoiceId} muestra señales de alto riesgo (${report.score}/100). Se detectaron irregularidades que requieren investigación inmediata.`,
      recommendation: "No liberar el pedido. Contactar al equipo de compliance para revisión manual.",
    },
  };

  return {
    ...verdictMap[report.verdict],
    source: "fallback",
  };
}

// ─────────────────────────────────────────────
//  AGENTE PRINCIPAL — exportable
// ─────────────────────────────────────────────

export async function analyzeWithAgent(report: RiskReport): Promise<AgentResponse> {
  const prompt = buildPrompt(report);

  // 1. Intentar Ollama (local, sin internet)
  try {
    const raw = await callOllama(prompt);
    const { explanation, recommendation } = parseAgentResponse(raw);
    return { explanation, recommendation, source: "ollama" };
  } catch (ollamaErr) {
    console.warn("[TrustPay] Ollama no disponible:", (ollamaErr as Error).message);
  }

  // 2. Fallback: Anthropic API (requiere internet)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await callAnthropic(prompt);
      const { explanation, recommendation } = parseAgentResponse(raw);
      return { explanation, recommendation, source: "anthropic" };
    } catch (anthropicErr) {
      console.warn("[TrustPay] Anthropic no disponible:", (anthropicErr as Error).message);
    }
  }

  // 3. Respuesta estática — siempre disponible, sin IA
  return staticResponse(report);
}

// ─────────────────────────────────────────────
//  VERIFICAR disponibilidad de Ollama
// ─────────────────────────────────────────────

export async function checkOllamaStatus(): Promise<{
  available: boolean;
  model:     string;
  latencyMs: number | null;
}> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return { available: false, model: OLLAMA_MODEL, latencyMs: null };
    const latencyMs = Date.now() - t0;
    return { available: true, model: OLLAMA_MODEL, latencyMs };
  } catch {
    return { available: false, model: OLLAMA_MODEL, latencyMs: null };
  }
}

// engine/runDemo.ts
// Corre los 3 escenarios en consola — sin frontend, sin blockchain.
// Ideal para probar el motor de riesgo antes del hackathon.
//
// Uso:
//   npx tsx engine/runDemo.ts

import { evaluatePayment, hashReport }  from "./riskEngine";
import { analyzeWithAgent, checkOllamaStatus } from "./trustPayAgent";
import { ALL_SCENARIOS } from "./demoScenarios";

const COLORS = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  cyan:    "\x1b[36m",
  gray:    "\x1b[90m",
  white:   "\x1b[37m",
};

function colorVerdict(v: string): string {
  if (v === "ACCEPTED") return `${COLORS.green}${COLORS.bold}${v}${COLORS.reset}`;
  if (v === "REVIEW")   return `${COLORS.yellow}${COLORS.bold}${v}${COLORS.reset}`;
  return `${COLORS.red}${COLORS.bold}${v}${COLORS.reset}`;
}

function bar(score: number): string {
  const filled = Math.round(score / 5);
  const empty  = 20 - filled;
  const color  = score <= 30 ? COLORS.green : score <= 70 ? COLORS.yellow : COLORS.red;
  return `${color}${"█".repeat(filled)}${COLORS.gray}${"░".repeat(empty)}${COLORS.reset}`;
}

async function main() {
  console.log(`\n${COLORS.cyan}${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bold}   TrustPay Agent — Demo del Motor de Riesgo   ${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}\n`);

  // Estado de Ollama
  const ollamaStatus = await checkOllamaStatus();
  const aiLabel = ollamaStatus.available
    ? `${COLORS.green}● Ollama activo${COLORS.reset} (${ollamaStatus.model}, ${ollamaStatus.latencyMs}ms)`
    : `${COLORS.yellow}○ Ollama offline${COLORS.reset} — usando respuesta estática`;
  console.log(`  IA local: ${aiLabel}\n`);

  for (let i = 0; i < ALL_SCENARIOS.length; i++) {
    const s = ALL_SCENARIOS[i];

    console.log(`${COLORS.white}${COLORS.bold}─── Caso ${i + 1}: ${s.label} ───────────────────────────${COLORS.reset}`);

    // Evaluar
    const report = evaluatePayment(s.invoice, s.tx, s.wallet);
    const hash   = await hashReport(report);

    // Header
    console.log(`  Factura : ${COLORS.bold}${report.invoiceId}${COLORS.reset}`);
    console.log(`  TX Hash : ${COLORS.gray}${report.txHash.slice(0, 20)}…${COLORS.reset}`);
    console.log(`  Score   : ${bar(report.score)} ${COLORS.bold}${report.score}/100${COLORS.reset}`);
    console.log(`  Nivel   : ${colorVerdict(report.verdict)}\n`);

    // Factores
    console.log(`  ${COLORS.gray}Factores evaluados:${COLORS.reset}`);
    for (const f of report.factors) {
      const icon  = f.passed ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
      const label = f.passed ? COLORS.gray : COLORS.white;
      console.log(`    ${icon} ${label}${f.name}${COLORS.reset}: ${COLORS.gray}${f.detail}${COLORS.reset}`);
    }

    // Agente IA
    console.log(`\n  ${COLORS.cyan}Análisis del agente:${COLORS.reset}`);
    const agent = await analyzeWithAgent(report);
    console.log(`  ${COLORS.gray}[${agent.source}]${COLORS.reset}`);
    console.log(`  📋 ${agent.explanation}`);
    console.log(`  👉 ${COLORS.bold}${agent.recommendation}${COLORS.reset}`);

    // Hash para on-chain
    console.log(`\n  ${COLORS.gray}Report hash (on-chain): ${hash}${COLORS.reset}`);
    console.log();
  }

  console.log(`${COLORS.cyan}${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}\n`);
}

main().catch(console.error);

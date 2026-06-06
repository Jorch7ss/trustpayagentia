// engine/riskEngine.ts
// Motor de riesgo local — corre 100% offline, sin APIs externas.
// Evalúa una transacción contra una factura y produce un score 0–100.

export interface Invoice {
  invoiceId:      string;
  merchantWallet: string;       // wallet oficial registrada
  expectedAmount: bigint;       // en unidades base del token
  acceptedToken:  string;       // dirección del token aceptado
}

export interface Transaction {
  txHash:      string;
  from:        string;          // payer wallet
  to:          string;          // receiver wallet
  token:       string;          // token address
  amount:      bigint;
  network:     string;          // "arbitrum" | "arbitrum-sepolia"
  blockNumber: number;
  timestamp:   number;          // unix
}

export interface WalletContext {
  isAllowlisted:      boolean;
  isBlacklisted:      boolean;
  firstSeenTimestamp: number | null;   // null = desconocida
  txCount:            number;
  previousPayments:   number;          // pagos previos a esta empresa
  fundedMinutesAgo:   number | null;   // null = no aplica / antigüedad normal
}

export interface RiskFactor {
  name:    string;
  passed:  boolean;
  weight:  number;   // penalización si falla (suma al score de riesgo)
  detail:  string;
}

export interface RiskReport {
  invoiceId:   string;
  txHash:      string;
  score:       number;           // 0–100
  verdict:     "ACCEPTED" | "REVIEW" | "REJECTED";
  level:       "LOW" | "MEDIUM" | "HIGH";
  factors:     RiskFactor[];
  summary:     string;           // para el agente IA
  timestamp:   number;
}

// ─────────────────────────────────────────────
//  CONSTANTES DE PESO
//  La suma de todos los pesos = 100
// ─────────────────────────────────────────────
const W = {
  DESTINATION_MATCH:    20,  // wallet destino coincide con empresa registrada
  AMOUNT_MATCH:         15,  // monto exacto coincide
  TOKEN_CORRECT:        10,  // token correcto
  NETWORK_CORRECT:      10,  // red correcta (Arbitrum)
  NOT_BLACKLISTED:      15,  // wallet origen NO está en blacklist
  ALLOWLISTED:          10,  // wallet origen SÍ está en allowlist
  WALLET_HISTORY:       10,  // wallet origen tiene historial sano (>5 txs)
  NO_FRESH_FUNDING:      5,  // wallet no recibió fondos hace <10 min
  PRIOR_RELATIONSHIP:    5,  // pagos previos a esta empresa
} as const;

// ─────────────────────────────────────────────
//  MOTOR PRINCIPAL
// ─────────────────────────────────────────────

export function evaluatePayment(
  invoice: Invoice,
  tx:      Transaction,
  wallet:  WalletContext
): RiskReport {

  const factors: RiskFactor[] = [];
  let   riskAccumulated = 0;

  // 1. Wallet destino coincide con wallet oficial de la empresa
  const destMatch = tx.to.toLowerCase() === invoice.merchantWallet.toLowerCase();
  factors.push({
    name:   "Wallet destino",
    passed: destMatch,
    weight: W.DESTINATION_MATCH,
    detail: destMatch
      ? `La wallet destino (${short(tx.to)}) coincide con la registrada.`
      : `La wallet destino (${short(tx.to)}) NO coincide con la oficial (${short(invoice.merchantWallet)}).`,
  });
  if (!destMatch) riskAccumulated += W.DESTINATION_MATCH;

  // 2. Monto
  const TOLERANCE = 1n; // 1 unidad base de tolerancia para redondeos
  const amountMatch = tx.amount >= invoice.expectedAmount - TOLERANCE &&
                      tx.amount <= invoice.expectedAmount + TOLERANCE;
  const isPartial   = tx.amount < invoice.expectedAmount - TOLERANCE;
  factors.push({
    name:   "Monto del pago",
    passed: amountMatch,
    weight: W.AMOUNT_MATCH,
    detail: amountMatch
      ? `Monto correcto: ${tx.amount} (esperado: ${invoice.expectedAmount}).`
      : isPartial
        ? `Pago PARCIAL: ${tx.amount} (esperado: ${invoice.expectedAmount}). Diferencia: ${invoice.expectedAmount - tx.amount}.`
        : `Monto EXCESIVO: ${tx.amount} (esperado: ${invoice.expectedAmount}).`,
  });
  if (!amountMatch) riskAccumulated += W.AMOUNT_MATCH;

  // 3. Token correcto
  const tokenMatch = tx.token.toLowerCase() === invoice.acceptedToken.toLowerCase();
  factors.push({
    name:   "Token de pago",
    passed: tokenMatch,
    weight: W.TOKEN_CORRECT,
    detail: tokenMatch
      ? `Token correcto: ${short(tx.token)}.`
      : `Token INCORRECTO: se recibió ${short(tx.token)}, se esperaba ${short(invoice.acceptedToken)}.`,
  });
  if (!tokenMatch) riskAccumulated += W.TOKEN_CORRECT;

  // 4. Red correcta
  const networkOk = tx.network === "arbitrum" || tx.network === "arbitrum-sepolia";
  factors.push({
    name:   "Red de la transacción",
    passed: networkOk,
    weight: W.NETWORK_CORRECT,
    detail: networkOk
      ? `Red correcta: ${tx.network}.`
      : `Red INCORRECTA: ${tx.network}. Solo se aceptan pagos en Arbitrum.`,
  });
  if (!networkOk) riskAccumulated += W.NETWORK_CORRECT;

  // 5. Blacklist
  factors.push({
    name:   "Blacklist",
    passed: !wallet.isBlacklisted,
    weight: W.NOT_BLACKLISTED,
    detail: wallet.isBlacklisted
      ? `⚠️  La wallet origen (${short(tx.from)}) está en la blacklist.`
      : `La wallet origen no aparece en listas de riesgo conocidas.`,
  });
  if (wallet.isBlacklisted) riskAccumulated += W.NOT_BLACKLISTED;

  // 6. Allowlist
  factors.push({
    name:   "Allowlist",
    passed: wallet.isAllowlisted,
    weight: W.ALLOWLISTED,
    detail: wallet.isAllowlisted
      ? `La wallet origen (${short(tx.from)}) está en la allowlist de la empresa.`
      : `La wallet origen no está en la allowlist. Sin historial previo de confianza.`,
  });
  if (!wallet.isAllowlisted) riskAccumulated += W.ALLOWLISTED;

  // 7. Historial de la wallet
  const hasHistory = wallet.txCount >= 5;
  factors.push({
    name:   "Historial de wallet",
    passed: hasHistory,
    weight: W.WALLET_HISTORY,
    detail: hasHistory
      ? `Wallet con historial: ${wallet.txCount} transacciones previas.`
      : `Wallet con poco historial: solo ${wallet.txCount} transacciones. Podría ser nueva o descartable.`,
  });
  if (!hasHistory) riskAccumulated += W.WALLET_HISTORY;

  // 8. Financiamiento reciente sospechoso
  const freshFunding = wallet.fundedMinutesAgo !== null && wallet.fundedMinutesAgo < 10;
  factors.push({
    name:   "Financiamiento reciente",
    passed: !freshFunding,
    weight: W.NO_FRESH_FUNDING,
    detail: freshFunding
      ? `⚠️  La wallet recibió fondos hace solo ${wallet.fundedMinutesAgo} minutos desde otra wallet desconocida.`
      : `Sin señales de financiamiento repentino sospechoso.`,
  });
  if (freshFunding) riskAccumulated += W.NO_FRESH_FUNDING;

  // 9. Relación previa con la empresa
  const hasPrior = wallet.previousPayments > 0;
  factors.push({
    name:   "Relación previa",
    passed: hasPrior,
    weight: W.PRIOR_RELATIONSHIP,
    detail: hasPrior
      ? `${wallet.previousPayments} pago(s) previo(s) registrado(s) con esta empresa.`
      : `No hay pagos previos con esta empresa.`,
  });
  if (!hasPrior) riskAccumulated += W.PRIOR_RELATIONSHIP;

  // ── Veredicto ─────────────────────────────
  const score = Math.min(100, riskAccumulated);

  let verdict:  RiskReport["verdict"];
  let level:    RiskReport["level"];

  if (score <= 30) {
    verdict = "ACCEPTED";
    level   = "LOW";
  } else if (score <= 70) {
    verdict = "REVIEW";
    level   = "MEDIUM";
  } else {
    verdict = "REJECTED";
    level   = "HIGH";
  }

  // ── Resumen para el agente IA ──────────────
  const failedFactors = factors.filter(f => !f.passed);
  const summary = buildSummary(invoice.invoiceId, verdict, score, failedFactors);

  return {
    invoiceId: invoice.invoiceId,
    txHash:    tx.txHash,
    score,
    verdict,
    level,
    factors,
    summary,
    timestamp: Date.now(),
  };
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function buildSummary(
  invoiceId:     string,
  verdict:       string,
  score:         number,
  failedFactors: RiskFactor[]
): string {
  const issues = failedFactors.map(f => `- ${f.detail}`).join("\n");

  return `Factura ${invoiceId} — Veredicto: ${verdict} (riesgo ${score}/100).
${failedFactors.length === 0
  ? "Todos los controles pasaron correctamente."
  : `Se detectaron ${failedFactors.length} problema(s):\n${issues}`}`;
}

// ─────────────────────────────────────────────
//  HASH DEL REPORTE (para guardar on-chain)
// ─────────────────────────────────────────────

export async function hashReport(report: RiskReport): Promise<`0x${string}`> {
  const json    = JSON.stringify(report);
  const encoder = new TextEncoder();
  const data    = encoder.encode(json);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hashHex = hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
  return `0x${hashHex}`;
}

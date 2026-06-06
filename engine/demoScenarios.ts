// engine/demoScenarios.ts
// Tres casos de demo listos para el hackathon.
// Se pueden correr sin conexión ni wallet real.

import type { Invoice, Transaction, WalletContext } from "./riskEngine";

// Wallets ficticias para demo
const MERCHANT_WALLET = "0xA1b2C3d4E5f6A1b2C3d4E5f6A1b2C3d4E5f6A1b2";
const USDC_ADDRESS    = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"; // USDC Arbitrum Sepolia

// ─────────────────────────────────────────────
//  CASO 1 — Pago confiable (debería dar ACCEPTED)
// ─────────────────────────────────────────────
export const scenario1 = {
  label: "✅ Pago confiable",
  invoice: {
    invoiceId:      "F-1029",
    merchantWallet: MERCHANT_WALLET,
    expectedAmount: 500_000_000n, // 500 USDC (6 decimales)
    acceptedToken:  USDC_ADDRESS,
  } satisfies Invoice,

  tx: {
    txHash:      "0xabc111000000000000000000000000000000000000000000000000000000001",
    from:        "0xCLIENTE_CONOCIDO_111111111111111111111111",
    to:          MERCHANT_WALLET,
    token:       USDC_ADDRESS,
    amount:      500_000_000n,
    network:     "arbitrum-sepolia",
    blockNumber: 12_450_001,
    timestamp:   Date.now() - 60_000,
  } satisfies Transaction,

  wallet: {
    isAllowlisted:      true,
    isBlacklisted:      false,
    firstSeenTimestamp: Date.now() - 1_000 * 60 * 60 * 24 * 90, // 90 días
    txCount:            47,
    previousPayments:   3,
    fundedMinutesAgo:   null,
  } satisfies WalletContext,
};

// ─────────────────────────────────────────────
//  CASO 2 — Pago dudoso (debería dar REVIEW)
// ─────────────────────────────────────────────
export const scenario2 = {
  label: "⚠️  Pago dudoso",
  invoice: {
    invoiceId:      "F-1030",
    merchantWallet: MERCHANT_WALLET,
    expectedAmount: 1_200_000_000n, // 1,200 USDC
    acceptedToken:  USDC_ADDRESS,
  } satisfies Invoice,

  tx: {
    txHash:      "0xabc222000000000000000000000000000000000000000000000000000000002",
    from:        "0xCLIENTE_NUEVO_222222222222222222222222222",
    to:          MERCHANT_WALLET,
    token:       USDC_ADDRESS,
    amount:      1_200_000_000n,
    network:     "arbitrum-sepolia",
    blockNumber: 12_450_100,
    timestamp:   Date.now() - 120_000,
  } satisfies Transaction,

  wallet: {
    isAllowlisted:      false,  // no está en allowlist
    isBlacklisted:      false,
    firstSeenTimestamp: Date.now() - 1_000 * 60 * 60 * 24 * 3, // 3 días
    txCount:            2,      // poco historial
    previousPayments:   0,      // sin relación previa
    fundedMinutesAgo:   7,      // recibió fondos hace 7 min ⚠️
  } satisfies WalletContext,
};

// ─────────────────────────────────────────────
//  CASO 3 — Pago riesgoso (debería dar REJECTED)
// ─────────────────────────────────────────────
export const scenario3 = {
  label: "🚨 Pago riesgoso",
  invoice: {
    invoiceId:      "F-1031",
    merchantWallet: MERCHANT_WALLET,
    expectedAmount: 800_000_000n, // 800 USDC
    acceptedToken:  USDC_ADDRESS,
  } satisfies Invoice,

  tx: {
    txHash:      "0xabc333000000000000000000000000000000000000000000000000000000003",
    from:        "0xWALLET_SOSPECHOSA_3333333333333333333333",
    to:          "0xWALLET_INCORRECTA_4444444444444444444444", // destino incorrecto
    token:       "0xTOKEN_INCORRECTO_5555555555555555555555",  // token incorrecto
    amount:      400_000_000n,  // pago parcial (50%)
    network:     "arbitrum-sepolia",
    blockNumber: 12_450_200,
    timestamp:   Date.now() - 30_000,
  } satisfies Transaction,

  wallet: {
    isAllowlisted:      false,
    isBlacklisted:      true,   // en blacklist ⚠️
    firstSeenTimestamp: Date.now() - 1_000 * 60 * 5, // wallet de 5 minutos
    txCount:            1,
    previousPayments:   0,
    fundedMinutesAgo:   3,      // fondos hace 3 min ⚠️
  } satisfies WalletContext,
};

export const ALL_SCENARIOS = [scenario1, scenario2, scenario3];

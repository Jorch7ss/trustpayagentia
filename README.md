# TrustPay Agent

> Verificación de confianza para pagos con stablecoins.  
> Bitso como capa de pagos · Arbitrum como capa de trazabilidad · Agente local para el veredicto.

## Estructura del proyecto

```
trustpay-agent/
│
├── contracts/
│   └── TrustPayRegistry.sol     # Contrato en Arbitrum (Capa 1)
│
├── scripts/
│   └── deploy.ts                # Script de despliegue con Hardhat
│
├── engine/
│   ├── riskEngine.ts            # Motor de riesgo 0–100 (Capa 2)
│   ├── trustPayAgent.ts         # Agente IA local (Ollama / Anthropic)
│   ├── demoScenarios.ts         # Tres casos de demo
│   └── runDemo.ts               # CLI para probar el motor sin frontend
│
├── app/
│   ├── layout.tsx               # Layout de Next.js
│   ├── page.tsx                 # Dashboard principal (Capa 3)
│   └── globals.css
│
├── hardhat.config.ts
├── package.json
├── .env.example                 # Variables de entorno (no subir .env)
└── README.md
```

## Inicio rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp env.example .env
# Editar .env con tu DEPLOYER_PRIVATE_KEY
```

### 3. Probar el motor de riesgo (sin frontend, sin blockchain)
```bash
npm run demo
```

### 4. Compilar y desplegar el contrato en Arbitrum Sepolia
```bash
npm run compile
npm run deploy:testnet
```

### 5. Levantar el dashboard
```bash
npm run dev
# http://localhost:3000
```

## Preparar Git

```bash
git status
git add .
git commit -m "Prepare TrustPay Agent frontend for Vercel"
git branch -M main
git remote add origin <URL_DE_TU_REPO>
git push -u origin main
```

Antes del commit revisa que `.env` no aparezca en `git status`. El archivo seguro para subir es `env.example`.

## Deploy en Vercel

1. Crea un nuevo proyecto en Vercel desde tu repo de GitHub.
2. Framework: `Next.js`.
3. Install Command: `npm ci`.
4. Build Command: `npm run vercel-build`.
5. Output Directory: dejar vacio.
6. En Environment Variables agrega solo las variables `NEXT_PUBLIC_*` que quieras usar en el frontend. No subas `DEPLOYER_PRIVATE_KEY` a Vercel salvo que vayas a ejecutar acciones server-side con wallet, que este dashboard no necesita para la demo estatica.

Comandos utiles:

```bash
npm run typecheck
npm run build
```

## Privacidad

- El motor de riesgo corre 100% local.
- Los datos sensibles (reporte completo) nunca se envían a la blockchain.
- On-chain solo se guarda el `keccak256` del reporte — prueba de integridad sin exponer datos.
- El agente IA usa **Ollama** por defecto (sin internet). Anthropic API como fallback opcional.

## Stack

| Capa | Tecnología |
|------|-----------|
| Contrato | Solidity 0.8.20 · Arbitrum One |
| Deploy | Hardhat · TypeScript |
| Motor de riesgo | TypeScript (sin dependencias) |
| Agente IA | Ollama (llama3.2) · Anthropic API (fallback) |
| Frontend | Next.js 14 · Tailwind CSS · Viem |
| Stablecoin | USDC en Arbitrum |

## Flujo de verificación

```
Empresa registra factura (on-chain)
        ↓
Cliente paga en USDC → Arbitrum
        ↓
Empresa ingresa txHash en el dashboard
        ↓
Motor de riesgo evalúa 9 factores (local)
        ↓
Agente IA traduce el reporte a lenguaje natural
        ↓
Hash del reporte se registra on-chain
        ↓
Veredicto: ACEPTADO / REVISAR / RECHAZADO
```

## Tokens soportados (Arbitrum Sepolia testnet)

| Token | Dirección |
|-------|-----------|
| USDC  | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

## Hackathon: Ethereum México 2026

Construido con:
- **Arbitrum** — trazabilidad pública, costos bajos, EVM compatible
- **Bitso** — liquidez empresarial, rieles locales MXN/SPEI, stablecoins

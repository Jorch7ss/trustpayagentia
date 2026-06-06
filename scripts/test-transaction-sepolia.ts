import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

  if (!contractAddress) {
    throw new Error("No contract address found in .env");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  TrustPay — Ejecutando Transacción Real en Arbitrum Sepolia");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Deployer/Owner : ${deployer.address}`);
  console.log(`  Balance        : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`  Contrato       : ${contractAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Instanciar el contrato ya desplegado
  const TrustPayRegistry = await ethers.getContractFactory("TrustPayRegistry");
  const contract = TrustPayRegistry.attach(contractAddress) as any;

  // 1. Registrar un Merchant
  const mockMerchant = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // merchant de prueba
  console.log("1. Registrando Merchant en Arbitrum Sepolia...");
  const regTx = await contract.registerMerchant(mockMerchant, "Empresa Sepolia S.A.");
  console.log(`   Tx enviada. Esperando confirmación...`);
  const regReceipt = await regTx.wait();
  console.log(`   ✅ Merchant registrado!`);
  console.log(`      Tx Hash: ${regReceipt?.hash}`);
  console.log(`      Ver en Arbiscan: https://sepolia.arbiscan.io/tx/${regReceipt?.hash}\n`);

  // 2. Registrar una Factura (Invoice)
  const invoiceId = "F-" + Math.floor(Math.random() * 100000); // ID aleatorio para evitar colisión si se corre de nuevo
  const expectedAmount = ethers.parseUnits("100", 6); // 100 USDC (6 decimales)
  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  
  console.log(`2. Registrando Factura ${invoiceId} en Arbitrum Sepolia...`);
  const invTx = await contract.registerInvoice(invoiceId, mockMerchant, expectedAmount, USDC_ADDRESS);
  console.log(`   Tx enviada. Esperando confirmación...`);
  const invReceipt = await invTx.wait();
  console.log(`   ✅ Factura registrada!`);
  console.log(`      Tx Hash: ${invReceipt?.hash}`);
  console.log(`      Ver en Arbiscan: https://sepolia.arbiscan.io/tx/${invReceipt?.hash}\n`);

  // 3. Verificar un Pago (verifyPayment)
  const mockTxHash = ethers.id("some-real-sepolia-transaction-hash-" + Date.now());
  const mockReportHash = ethers.id("some-report-hash-data-" + Date.now());
  const riskScore = 10; // Bajo riesgo, veredicto esperado: ACCEPTED (status = 1)
  const mockPayer = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

  console.log(`3. Verificando Pago de Factura ${invoiceId} en Arbitrum Sepolia...`);
  const verifyTx = await contract.verifyPayment(
    invoiceId,
    mockTxHash,
    mockPayer,
    expectedAmount,
    USDC_ADDRESS,
    riskScore,
    mockReportHash
  );
  console.log(`   Tx enviada. Esperando confirmación...`);
  const verifyReceipt = await verifyTx.wait();
  console.log(`   ✅ Pago verificado!`);
  console.log(`      Tx Hash: ${verifyReceipt?.hash}`);
  console.log(`      Ver en Arbiscan: https://sepolia.arbiscan.io/tx/${verifyReceipt?.hash}\n`);

  // 4. Consultar el estado final guardado on-chain
  console.log("4. Consultando el estado final del contrato...");
  const savedInvoice = await contract.getInvoice(invoiceId);
  const statusLabels = ["PENDING", "ACCEPTED", "REVIEW", "REJECTED"];
  console.log(`   ✅ Factura en blockchain:`);
  console.log(`      Estado Factura : ${statusLabels[Number(savedInvoice.status)]}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

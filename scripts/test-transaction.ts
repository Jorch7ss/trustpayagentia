import { ethers } from "hardhat";

async function main() {
  const [owner, merchant, payer] = await ethers.getSigners();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  TrustPay — Prueba de Transacción Local");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Owner/Deployer : ${owner.address}`);
  console.log(`  Merchant       : ${merchant.address}`);
  console.log(`  Payer          : ${payer.address}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. Desplegar el contrato
  console.log("1. Desplegando TrustPayRegistry...");
  const TrustPayRegistry = await ethers.getContractFactory("TrustPayRegistry");
  const contract = await TrustPayRegistry.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`   ✅ Contrato desplegado en: ${contractAddress}\n`);

  // 2. Registrar el Merchant
  console.log("2. Registrando Merchant...");
  const regTx = await contract.registerMerchant(merchant.address, "Empresa Demo S.A.");
  const regReceipt = await regTx.wait();
  console.log(`   ✅ Merchant registrado. Tx Hash: ${regReceipt?.hash}`);
  
  // Verificar que el merchant está en la allowlist
  const isAllow = await contract.isAllowlisted(merchant.address);
  const profile = await contract.merchants(merchant.address);
  console.log(`   Profile Name: ${profile.name}, Active: ${profile.active}, Allowlisted: ${isAllow}\n`);

  // 3. Registrar una Factura (Invoice)
  const invoiceId = "F-1029";
  const expectedAmount = ethers.parseUnits("500", 6); // 500 USDC (6 decimales)
  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  
  console.log(`3. Registrando Factura ${invoiceId}...`);
  console.log(`   Monto Esperado: 500 USDC (${expectedAmount.toString()} unidades base)`);
  const invTx = await contract.registerInvoice(invoiceId, merchant.address, expectedAmount, USDC_ADDRESS);
  const invReceipt = await invTx.wait();
  console.log(`   ✅ Factura registrada. Tx Hash: ${invReceipt?.hash}`);

  // Verificar la factura guardada
  const savedInvoice = await contract.getInvoice(invoiceId);
  console.log(`   Factura guardada en contrato:`);
  console.log(`     Merchant Wallet: ${savedInvoice.merchantWallet}`);
  console.log(`     Expected Amount: ${savedInvoice.expectedAmount.toString()}`);
  console.log(`     Accepted Token:  ${savedInvoice.acceptedToken}`);
  console.log(`     Status:          ${savedInvoice.status} (0 = PENDING)\n`);

  // 4. Verificar un Pago (Transaction Verification)
  // Simulamos el pago verificado por el agente off-chain:
  const mockTxHash = ethers.id("some-arbitrum-transaction-hash");
  const mockReportHash = ethers.id("some-json-report-content-hash");
  const riskScore = 15; // Bajo riesgo, veredicto esperado: ACCEPTED (status = 1)
  
  console.log(`4. Verificando Pago de Factura ${invoiceId}...`);
  console.log(`   Puntaje de Riesgo: ${riskScore}/100`);
  console.log(`   Hash de Tx de Pago: ${mockTxHash}`);
  console.log(`   Hash de Reporte:    ${mockReportHash}`);

  const verifyTx = await contract.verifyPayment(
    invoiceId,
    mockTxHash,
    payer.address,
    expectedAmount, // Monto completo
    USDC_ADDRESS,
    riskScore,
    mockReportHash
  );
  const verifyReceipt = await verifyTx.wait();
  console.log(`   ✅ Pago verificado. Tx Hash: ${verifyReceipt?.hash}\n`);

  // 5. Leer los resultados finales del contrato
  console.log("5. Consultando estado final del contrato...");
  const updatedInvoice = await contract.getInvoice(invoiceId);
  const paymentRecord = await contract.getPaymentRecord(invoiceId);

  const statusLabels = ["PENDING", "ACCEPTED", "REVIEW", "REJECTED"];
  console.log(`   Estado Factura:  ${statusLabels[Number(updatedInvoice.status)]}`);
  console.log(`   Registro de Pago en Blockchain:`);
  console.log(`     Tx Hash en Arbitrum: ${paymentRecord.txHash}`);
  console.log(`     Payer Wallet:        ${paymentRecord.payerWallet}`);
  console.log(`     Paid Amount:         ${paymentRecord.paidAmount.toString()}`);
  console.log(`     Risk Score:          ${paymentRecord.riskScore}`);
  console.log(`     Verdict:             ${statusLabels[Number(paymentRecord.verdict)]}`);
  console.log(`     Report Integrity:    ${paymentRecord.reportHash === mockReportHash ? "VALIDA ✓" : "INVALIDA ✗"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

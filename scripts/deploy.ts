// scripts/deploy.ts
// Despliega TrustPayRegistry en Arbitrum Sepolia (testnet) o Arbitrum One (mainnet)
//
// Uso:
//   npx hardhat run scripts/deploy.ts --network arbitrumSepolia
//   npx hardhat run scripts/deploy.ts --network arbitrumOne

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  TrustPay — Deploy en Arbitrum");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const TrustPayRegistry = await ethers.getContractFactory("TrustPayRegistry");
  const contract = await TrustPayRegistry.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log(`\n✅  TrustPayRegistry desplegado en: ${address}`);
  console.log(`\n🔗  Verificar en Arbiscan:`);
  console.log(`    https://sepolia.arbiscan.io/address/${address}`);
  console.log(`\n📋  Guarda esta dirección en tu .env:`);
  console.log(`    NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

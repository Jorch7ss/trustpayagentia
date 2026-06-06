import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  TrustPay — Deploy en Arbitrum");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance  : ${ethers.utils.formatEther(balance)} ETH`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const TrustPayRegistry = await ethers.getContractFactory("TrustPayRegistry");
  const contract = await TrustPayRegistry.deploy();
  await contract.deployed();

  const address = contract.address;

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

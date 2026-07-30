// Проверяет, что КОММИТИРУЕМЫЙ build/SafeDealEscrow.json (его читает backend)
// реально деплоится и работает через ethers — тот же путь, что в evmEscrowService.
// Запуск: npx hardhat run scripts/verifyBuildArtifact.js
const { ethers } = require("hardhat");
const artifact = require("../build/SafeDealEscrow.json");

async function main() {
  const [client, freelancer, arbitrator] = await ethers.getSigners();

  // USDT-мок (нестандартный, как Tether)
  const Token = await ethers.getContractFactory("MockTetherUSD");
  const token = await Token.deploy();
  const amount = 100_000000n; // 100 USDT

  // Деплой ИЗ build-артефакта (abi+bytecode), как это делает backend
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, arbitrator);
  const deadline = Math.floor(Date.now() / 1000) + 86400;
  const escrow = await factory.deploy(
    await token.getAddress(), client.address, freelancer.address,
    arbitrator.address, amount, 200, deadline
  );
  await escrow.waitForDeployment();

  await token.mint(client.address, amount);
  await token.connect(client).approve(await escrow.getAddress(), amount);
  await escrow.connect(client).deposit();
  const statusAfterDeposit = Number(await escrow.status());
  await escrow.connect(arbitrator).release();

  const fl = await token.balanceOf(freelancer.address);
  const arb = await token.balanceOf(arbitrator.address);

  const ok = statusAfterDeposit === 1 && fl === 98_000000n && arb === 2_000000n;
  console.log("статус после депозита:", statusAfterDeposit, "(1=Frozen)");
  console.log("фрилансер:", ethers.formatUnits(fl, 6), "USDT | арбитр:", ethers.formatUnits(arb, 6), "USDT");
  console.log(ok ? "✅ build-артефакт деплоится и работает через ethers" : "❌ несоответствие");
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

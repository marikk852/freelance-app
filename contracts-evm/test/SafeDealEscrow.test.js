const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

// ============================================================
// SafeDealEscrow — тесты безопасности (порт набора из escrow.spec.ts, TON)
// Токен по умолчанию — MockTetherUSD (НЕ возвращает bool, как реальный USDT).
// ============================================================

const USDT = (n) => BigInt(Math.round(n * 1e6)); // 6 знаков
const AMOUNT = USDT(100);
const FEE_BPS = 200; // 2%

describe("SafeDealEscrow", function () {
  async function deploy(tokenName = "MockTetherUSD") {
    const [deployer, client, freelancer, arbitrator, attacker] = await ethers.getSigners();

    const Token = await ethers.getContractFactory(tokenName);
    const token = await Token.deploy();

    const deadline = (await time.latest()) + 7 * 86400;
    const Escrow = await ethers.getContractFactory("SafeDealEscrow");
    const escrow = await Escrow.deploy(
      await token.getAddress(),
      client.address,
      freelancer.address,
      arbitrator.address,
      AMOUNT,
      FEE_BPS,
      deadline
    );

    // Клиенту выдаём USDT и он аппрувит эскроу
    await token.mint(client.address, USDT(1000));
    await token.connect(client).approve(await escrow.getAddress(), USDT(1000));

    return { token, escrow, deployer, client, freelancer, arbitrator, attacker, deadline };
  }

  async function deposited() {
    const ctx = await deploy();
    await ctx.escrow.connect(ctx.client).deposit();
    return ctx;
  }

  // -------- Статусы --------
  const Status = { Waiting: 0n, Frozen: 1n, Released: 2n, Refunded: 3n };

  describe("✅ Нормальная сделка", function () {
    it("deposit → release: фрилансер 98, арбитр 2", async function () {
      const { token, escrow, client, freelancer, arbitrator } = await loadFixture(deploy);

      await escrow.connect(client).deposit();
      expect(await escrow.status()).to.equal(Status.Frozen);
      expect(await escrow.frozenAmount()).to.equal(AMOUNT);

      await escrow.connect(arbitrator).release();

      expect(await escrow.status()).to.equal(Status.Released);
      expect(await token.balanceOf(freelancer.address)).to.equal(USDT(98));
      expect(await token.balanceOf(arbitrator.address)).to.equal(USDT(2));
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
    });
  });

  describe("⏰ Возврат", function () {
    it("refund возвращает клиенту 100%", async function () {
      const { token, escrow, client } = await loadFixture(deposited);
      const before = await token.balanceOf(client.address);

      await escrow.connect(await ethers.getSigner((await escrow.arbitrator()))).refund();

      expect(await escrow.status()).to.equal(Status.Refunded);
      expect(await token.balanceOf(client.address)).to.equal(before + AMOUNT);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
    });

    it("refund после дедлайна без депозита", async function () {
      const { escrow, arbitrator, deadline } = await loadFixture(deploy);
      await time.increaseTo(deadline + 1);
      expect(await escrow.isExpired()).to.equal(true);
      await escrow.connect(arbitrator).refund();
      expect(await escrow.status()).to.equal(Status.Refunded);
    });
  });

  describe("⚖️ Спор / split", function () {
    it("split 60/40 распределяет корректно", async function () {
      const { token, escrow, client, freelancer, arbitrator } = await loadFixture(deposited);
      const clientBefore = await token.balanceOf(client.address);

      await escrow.connect(arbitrator).split(6000); // 60% фрилансеру

      // distributable = 98; фрилансер 58.8; клиент 39.2; комиссия 2
      expect(await token.balanceOf(freelancer.address)).to.equal(USDT(58.8));
      expect(await token.balanceOf(client.address)).to.equal(clientBefore + USDT(39.2));
      expect(await token.balanceOf(arbitrator.address)).to.equal(USDT(2));
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
    });

    it("split 0% = полный возврат клиенту (минус комиссия)", async function () {
      const { token, escrow, client, freelancer, arbitrator } = await loadFixture(deposited);
      const clientBefore = await token.balanceOf(client.address);
      await escrow.connect(arbitrator).split(0);
      expect(await token.balanceOf(freelancer.address)).to.equal(0n);
      expect(await token.balanceOf(client.address)).to.equal(clientBefore + USDT(98));
    });
  });

  describe("🔒 Атаки (должны реверти́ться)", function () {
    it("release не от арбитра", async function () {
      const { escrow, client, freelancer, attacker } = await loadFixture(deposited);
      await expect(escrow.connect(attacker).release()).to.be.revertedWithCustomError(escrow, "NotArbitrator");
      await expect(escrow.connect(client).release()).to.be.revertedWithCustomError(escrow, "NotArbitrator");
      await expect(escrow.connect(freelancer).release()).to.be.revertedWithCustomError(escrow, "NotArbitrator");
    });

    it("refund/split не от арбитра", async function () {
      const { escrow, attacker } = await loadFixture(deposited);
      await expect(escrow.connect(attacker).refund()).to.be.revertedWithCustomError(escrow, "NotArbitrator");
      await expect(escrow.connect(attacker).split(5000)).to.be.revertedWithCustomError(escrow, "NotArbitrator");
    });
  });

  describe("🚫 Неверные состояния", function () {
    it("двойной release", async function () {
      const { escrow, arbitrator } = await loadFixture(deposited);
      await escrow.connect(arbitrator).release();
      await expect(escrow.connect(arbitrator).release()).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    it("release до депозита", async function () {
      const { escrow, arbitrator } = await loadFixture(deploy);
      await expect(escrow.connect(arbitrator).release()).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    it("split percent > 100%", async function () {
      const { escrow, arbitrator } = await loadFixture(deposited);
      await expect(escrow.connect(arbitrator).split(10001)).to.be.revertedWithCustomError(escrow, "InvalidSplit");
    });

    it("повторный deposit после заморозки", async function () {
      const { escrow, client } = await loadFixture(deposited);
      await expect(escrow.connect(client).deposit()).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });
  });

  describe("💵 Специфика USDT", function () {
    it("работает с нестандартным USDT (без возврата bool)", async function () {
      // Весь набор выше уже гоняется на MockTetherUSD, который не возвращает bool.
      // Здесь явно подтверждаем полный happy-path на нём.
      const { token, escrow, client, freelancer } = await loadFixture(deploy);
      await escrow.connect(client).deposit();
      const arb = await ethers.getSigner(await escrow.arbitrator());
      await escrow.connect(arb).release();
      expect(await token.balanceOf(freelancer.address)).to.equal(USDT(98));
    });

    it("fee-on-transfer токен: недобор депозита отбивается (Underfunded)", async function () {
      const [, client, freelancer, arbitrator] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("MockFeeUSD");
      const token = await Token.deploy();
      const deadline = (await time.latest()) + 7 * 86400;
      const Escrow = await ethers.getContractFactory("SafeDealEscrow");
      const escrow = await Escrow.deploy(
        await token.getAddress(), client.address, freelancer.address, arbitrator.address,
        AMOUNT, FEE_BPS, deadline
      );
      await token.mint(client.address, USDT(1000));
      await token.connect(client).approve(await escrow.getAddress(), USDT(1000));

      // 1% комиссия токена → контракт получит 99, а ждёт 100 → revert
      await expect(escrow.connect(client).deposit()).to.be.revertedWithCustomError(escrow, "Underfunded");
      expect(await escrow.status()).to.equal(Status.Waiting);
    });
  });
});

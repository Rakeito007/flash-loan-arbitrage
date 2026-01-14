const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashLoanReceiver", function () {
  let flashLoanReceiver;
  let owner;
  let user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Mock Aave addresses provider (in real tests, use actual addresses)
    const mockAddressesProvider = ethers.Wallet.createRandom().address;
    const maxLoanAmount = ethers.parseEther("10");
    const minProfitThreshold = 50; // 0.5%
    const maxSlippageBps = 100; // 1%

    const FlashLoanReceiver = await ethers.getContractFactory("FlashLoanReceiver");
    flashLoanReceiver = await FlashLoanReceiver.deploy(
      mockAddressesProvider,
      maxLoanAmount,
      minProfitThreshold,
      maxSlippageBps
    );
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await flashLoanReceiver.owner()).to.equal(owner.address);
    });

    it("Should set safety parameters correctly", async function () {
      const params = await flashLoanReceiver.getSafetyParams();
      expect(params[0]).to.equal(ethers.parseEther("10"));
      expect(params[1]).to.equal(50);
      expect(params[2]).to.equal(100);
    });
  });

  describe("Safety Parameters", function () {
    it("Should allow owner to update safety parameters", async function () {
      await flashLoanReceiver.updateSafetyParams(
        ethers.parseEther("20"),
        100,
        200
      );

      const params = await flashLoanReceiver.getSafetyParams();
      expect(params[0]).to.equal(ethers.parseEther("20"));
      expect(params[1]).to.equal(100);
      expect(params[2]).to.equal(200);
    });

    it("Should reject updates from non-owner", async function () {
      await expect(
        flashLoanReceiver.connect(user).updateSafetyParams(
          ethers.parseEther("20"),
          100,
          200
        )
      ).to.be.revertedWithCustomError(flashLoanReceiver, "OwnableUnauthorizedAccount");
    });

    it("Should reject profit threshold above 10%", async function () {
      await expect(
        flashLoanReceiver.updateSafetyParams(
          ethers.parseEther("20"),
          1001,
          200
        )
      ).to.be.revertedWith("Profit threshold too high");
    });
  });
});

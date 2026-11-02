import type {} from "../types/ethers-contracts/index.js";
import { expect } from "chai";
import { network } from "hardhat";

/**
 * Unit tests for the CrowdfundingDemo contract (in-memory Hardhat network).
 * Covered: successful donation, zero-value rejection, per-campaign totals,
 * per-donor contributions, event values, unauthorized withdrawal, and
 * authorized withdrawal.
 */

const { ethers, networkHelpers } = await network.create();

describe("CrowdfundingDemo", function () {
  const CAMPAIGN_ID_1 = ethers.id("community-library-renovation");
  const CAMPAIGN_ID_2 = ethers.id("clean-water-rural");
  const DONATION_AMOUNT = ethers.parseEther("0.01");
  const SECOND_DONATION_AMOUNT = ethers.parseEther("0.5");

  async function deployFixture() {
    const [owner, attacker] = await ethers.getSigners();
    const contract = await ethers.deployContract("CrowdfundingDemo");
    return { contract, owner, attacker };
  }

  it("records a successful donation and updates accounting", async function () {
    const { contract, owner } = await networkHelpers.loadFixture(deployFixture);

    const tx = await contract.donate(CAMPAIGN_ID_1, {
      value: DONATION_AMOUNT,
    });
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);

    expect(await contract.totalRaisedFor(CAMPAIGN_ID_1)).to.equal(
      DONATION_AMOUNT,
    );
    expect(
      await contract.contributionFor(CAMPAIGN_ID_1, owner.address),
    ).to.equal(DONATION_AMOUNT);
  });

  it("rejects zero-value donations", async function () {
    const { contract } = await networkHelpers.loadFixture(deployFixture);

    await expect(
      contract.donate(CAMPAIGN_ID_1, { value: 0 }),
    ).to.be.revertedWithCustomError(contract, "ZeroValueDonation");
  });

  it("rejects plain ETH transfers without a campaign id", async function () {
    const { contract, owner } = await networkHelpers.loadFixture(deployFixture);

    await expect(
      owner.sendTransaction({
        to: await contract.getAddress(),
        value: DONATION_AMOUNT,
      }),
    ).to.be.revertedWithCustomError(contract, "CallToContract");
  });

  it("emits DonationReceived with the event values", async function () {
    const { contract, owner } = await networkHelpers.loadFixture(deployFixture);

    await expect(contract.donate(CAMPAIGN_ID_1, { value: DONATION_AMOUNT }))
      .to.emit(contract, "DonationReceived")
      .withArgs(CAMPAIGN_ID_1, owner.address, DONATION_AMOUNT);
  });

  it("tracks totals and contributions across campaigns and donors", async function () {
    const { contract, owner, attacker: otherDonor } = await networkHelpers.loadFixture(deployFixture);

    await contract.donate(CAMPAIGN_ID_1, { value: DONATION_AMOUNT });
    await contract
      .connect(otherDonor)
      .donate(CAMPAIGN_ID_1, { value: SECOND_DONATION_AMOUNT });
    await contract.donate(CAMPAIGN_ID_2, { value: DONATION_AMOUNT });

    expect(await contract.totalRaisedFor(CAMPAIGN_ID_1)).to.equal(
      DONATION_AMOUNT + SECOND_DONATION_AMOUNT,
    );
    expect(await contract.totalRaisedFor(CAMPAIGN_ID_2)).to.equal(
      DONATION_AMOUNT,
    );
    expect(
      await contract.contributionFor(CAMPAIGN_ID_1, owner.address),
    ).to.equal(DONATION_AMOUNT);
    expect(
      await contract.contributionFor(CAMPAIGN_ID_1, otherDonor.address),
    ).to.equal(SECOND_DONATION_AMOUNT);
  });

  it("rejects withdrawal from a non-owner account", async function () {
    const { contract, attacker } = await networkHelpers.loadFixture(deployFixture);

    await expect(
      contract.connect(attacker).withdraw(attacker.address, DONATION_AMOUNT),
    ).to.be.revertedWithCustomError(contract, "NotOwner");
  });

  it("rejects zero-value and over-balanced withdrawals", async function () {
    const { contract, owner } = await networkHelpers.loadFixture(deployFixture);

    await expect(
      contract.withdraw(owner.address, 0),
    ).to.be.revertedWithCustomError(contract, "ZeroValueWithdrawal");

    await expect(
      contract.withdraw(owner.address, DONATION_AMOUNT),
    ).to.be.revertedWithCustomError(contract, "InsufficientContractBalance");
  });

  it("lets the owner withdraw deposited funds", async function () {
    const { contract, owner } = await networkHelpers.loadFixture(deployFixture);

    await contract.donate(CAMPAIGN_ID_1, { value: DONATION_AMOUNT });

    const before = await ethers.provider.getBalance(owner.address);
    await expect(contract.withdraw(owner.address, DONATION_AMOUNT))
      .to.emit(contract, "Withdrawn")
      .withArgs(owner.address, DONATION_AMOUNT);

    const after = await ethers.provider.getBalance(owner.address);
    // Balance increased modulo gas costs.
    expect(after).to.be.gt(before - DONATION_AMOUNT * 2n);
    expect(
      await ethers.provider.getBalance(await contract.getAddress()),
    ).to.equal(0);
  });

  it("lets the owner withdraw the full balance with withdrawAll", async function () {
    const { contract, owner } = await networkHelpers.loadFixture(deployFixture);

    await contract.donate(CAMPAIGN_ID_1, { value: DONATION_AMOUNT });

    await expect(contract.withdrawAll(owner.address))
      .to.emit(contract, "Withdrawn")
      .withArgs(owner.address, DONATION_AMOUNT);

    expect(
      await ethers.provider.getBalance(await contract.getAddress()),
    ).to.equal(0);
  });
});

import assert from "node:assert/strict";
import hre from "hardhat";

const { ethers } = await hre.network.create();
const expectRevert = async (promise) => assert.rejects(promise);

describe("PaperCut payment contracts", function () {
  let owner;
  let publisher;
  let reader;
  let token;

  beforeEach(async function () {
    [owner, publisher, reader] = await ethers.getSigners();
    token = await ethers.deployContract("DaveyTest");
    await token.waitForDeployment();
    await (await token.transfer(reader.address, 1_000_000n)).wait();
  });

  it("uses only the registered vault recipient and price", async function () {
    const vault = await ethers.deployContract("PaperCutRevenueVault", [await token.getAddress(), 500]);
    await vault.waitForDeployment();
    await (await vault.registerArticle("article-1", publisher.address, 50_000n, true)).wait();
    await (await token.connect(reader).approve(await vault.getAddress(), 1_000_000n)).wait();

    await (await vault.connect(reader).purchaseArticle("article-1")).wait();
    assert.equal(await vault.totalEarned(publisher.address), 47_500n);
    assert.equal(await vault.accumulatedPlatformFees(), 2_500n);
    await expectRevert(vault.connect(reader).purchaseArticle("article-1"));

    const before = await token.balanceOf(publisher.address);
    await (await vault.connect(publisher).claim()).wait();
    assert.equal(await token.balanceOf(publisher.address) - before, 47_500n);
  });

  it("allows only the owner to register or change article terms", async function () {
    const vault = await ethers.deployContract("PaperCutRevenueVault", [await token.getAddress(), 0]);
    await vault.waitForDeployment();
    await expectRevert(vault.connect(reader).registerArticle("article-1", reader.address, 1n, true));
    await (await vault.registerArticle("article-1", publisher.address, 50_000n, false)).wait();
    await (await token.connect(reader).approve(await vault.getAddress(), 50_000n)).wait();
    await expectRevert(vault.connect(reader).purchaseArticle("article-1"));
  });

  it("uses fixed terms for direct publisher payments", async function () {
    const payments = await ethers.deployContract("PaperCutPublisher", [await token.getAddress()]);
    await payments.waitForDeployment();
    await (await payments.setPublisherAuthorization(publisher.address, true)).wait();
    await (await payments.registerArticle("article-2", publisher.address, 75_000n, true)).wait();
    await (await token.connect(reader).approve(await payments.getAddress(), 75_000n)).wait();

    const before = await token.balanceOf(publisher.address);
    await (await payments.connect(reader).unlockArticle("article-2")).wait();
    assert.equal(await token.balanceOf(publisher.address) - before, 75_000n);
    await expectRevert(payments.connect(reader).unlockArticle("article-2"));
  });

  it("requires the proposed owner to accept ownership", async function () {
    const payments = await ethers.deployContract("PaperCutPublisher", [await token.getAddress()]);
    await payments.waitForDeployment();

    await (await payments.transferOwnership(reader.address)).wait();
    assert.equal(await payments.owner(), owner.address);
    assert.equal(await payments.pendingOwner(), reader.address);
    await expectRevert(payments.connect(publisher).acceptOwnership());

    await (await payments.connect(reader).acceptOwnership()).wait();
    assert.equal(await payments.owner(), reader.address);
  });
});

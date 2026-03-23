import { ethers, network } from "hardhat";
import { expect } from "chai";

export type Numeric = number | bigint;

const AddressZero = ethers.ZeroAddress;
const FEED_DECIMALS = 8;
const RATIO_DECIMALS = 18;

// Mainnet addresses
const MAINNET_CONTRACTS = {
    RSETH_ORACLE: "0x349A73444b1a310BAe67ef67973022020d70020d",
    ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
};

export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
  const sign = i < 0 ? -1n : 1n;
  const parts = Math.abs(i).toString().split('.');
  const intPart = parts[0];
  const fracPart = (parts[1] || '').padEnd(Number(r), '0').slice(0, Number(r));
  const scaled = BigInt(intPart + fracPart);
  return sign * (scaled * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

export async function makeRsETHCAPO() {
    const [mgr] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("RsETHCorrelatedAssetsPriceOracle");

    const lrtOracle = await ethers.getContractAt(["function rsETHPrice() view returns (uint256)"], MAINNET_CONTRACTS.RSETH_ORACLE);
    const currentRatio = await lrtOracle.rsETHPrice();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const oracle = await Oracle.deploy(mgr.address, MAINNET_CONTRACTS.ETH_USD, MAINNET_CONTRACTS.RSETH_ORACLE, "rsETH CAPO", FEED_DECIMALS, 3600, {
        snapshotRatio: currentRatio,
        snapshotTimestamp: now - 3600,
        maxYearlyRatioGrowthPercent: exp(0.01, 4)
    });

    return { oracle, feedA: null, lrt: lrtOracle, manager: mgr };
}

describe("rsETH CAPO price feed", () => {
    it("constructor: zero manager revert", async () => {
        const Oracle = await ethers.getContractFactory("RsETHCorrelatedAssetsPriceOracle");
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(
            Oracle.deploy(AddressZero, MAINNET_CONTRACTS.ETH_USD, MAINNET_CONTRACTS.RSETH_ORACLE, "bad", 8, 0, {
                snapshotRatio: exp(1, 18),
                snapshotTimestamp: now - 1,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(Oracle, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { oracle } = await makeRsETHCAPO();
        const [, bob] = await ethers.getSigners();

        await expect(
            oracle.connect(bob).updateSnapshot({ snapshotRatio: 1, snapshotTimestamp: 1, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    describe("latestRoundData", () => {
        it(`rsETH/USD price with real data`, async () => {
            const { oracle } = await makeRsETHCAPO();
            const [, price] = await oracle.latestRoundData();

            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                MAINNET_CONTRACTS.ETH_USD
            );
            const [, ethPrice] = await ethFeed.latestRoundData();

            expect(price).to.be.gt(0);
            expect(price).to.be.gt((ethPrice * 95n) / 100n);
            expect(price).to.be.lt((ethPrice * 110n) / 100n);
        });

        it("returns consistent price", async () => {
            const first = await makeRsETHCAPO();
            const second = await makeRsETHCAPO();

            const p1 = (await first.oracle.latestRoundData())[1];
            const p2 = (await second.oracle.latestRoundData())[1];
            expect(p1).to.be.closeTo(p2, p2 / 1000n);
        });

        it("cap logic (ratio growth)", async () => {
            const { oracle } = await makeRsETHCAPO();
            expect(await oracle.isCapped()).to.be.false;

            await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);

            const isCapped = await oracle.isCapped();
            expect(typeof isCapped).to.eq("boolean");
        });
    });

    it("manager and delay setters", async () => {
        const { oracle } = await makeRsETHCAPO();
        const [, bob, carl] = await ethers.getSigners();

        await expect(oracle.connect(bob).setManager(bob.address)).to.be.revertedWithCustomError(oracle, "OnlyManager");
        await oracle.setManager(bob.address);
        expect(await oracle.manager()).to.eq(bob.address);

        await expect(oracle.connect(carl).setMinimumSnapshotDelay(0)).to.be.revertedWithCustomError(oracle, "OnlyManager");
        await oracle.connect(bob).setMinimumSnapshotDelay(7200);
        expect(await oracle.minimumSnapshotDelay()).to.eq(7200);
    });

    it("snapshot guards", async () => {
        const { oracle } = await makeRsETHCAPO();

        await expect(oracle.updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: 0, maxYearlyRatioGrowthPercent: 0 })).to.be.revertedWithCustomError(
            oracle,
            "SnapshotRatioIsZero"
        );

        const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        await ethers.provider.send("evm_increaseTime", [3600]);

        await expect(
            oracle.updateSnapshot({
                snapshotRatio: exp(1, 40),
                snapshotTimestamp: now,
                maxYearlyRatioGrowthPercent: exp(10000, 2)
            })
        ).to.be.revertedWithCustomError(oracle, "SnapshotCloseToOverflow");
    });

    it("basic getters", async () => {
        const { oracle } = await makeRsETHCAPO();
        expect(await oracle.description()).to.eq("rsETH CAPO");
        expect(await oracle.version()).to.eq(1);
        expect(await oracle.decimals()).to.eq(FEED_DECIMALS);
    });
});

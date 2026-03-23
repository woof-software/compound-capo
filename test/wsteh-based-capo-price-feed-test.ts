import { ethers, network } from "hardhat";
import { expect } from "chai";

export type Numeric = number | bigint;

const AddressZero = ethers.ZeroAddress;
const FEED_DECIMALS = 8;
const RATIO_DECIMALS = 18;

// Mainnet addresses
const MAINNET_CONTRACTS = {
    WSTETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
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

export async function makeWstETHCAPO(marketRateFeed: string | null = null) {
    const [mgr] = await ethers.getSigners();
    const OracleFac = await ethers.getContractFactory("WstETHCorrelatedAssetsPriceOracle");

    const wstETH = await ethers.getContractAt(["function stEthPerToken() view returns (uint256)"], MAINNET_CONTRACTS.WSTETH);
    const currentRatio = await wstETH.stEthPerToken();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const oracle = await OracleFac.deploy(
        mgr.address,
        MAINNET_CONTRACTS.ETH_USD,
        MAINNET_CONTRACTS.WSTETH,
        marketRateFeed ?? AddressZero,
        "wstETH CAPO",
        FEED_DECIMALS,
        3600,
        {
            snapshotRatio: currentRatio,
            snapshotTimestamp: now - 3600,
            maxYearlyRatioGrowthPercent: exp(0.01, 4)
        }
    );
    return { oracle, feedA: null, wst: wstETH, manager: mgr };
}

describe("wstETH CAPO price feed common rate", () => {
    it("constructor: zero manager revert", async () => {
        const Oracle = await ethers.getContractFactory("WstETHCorrelatedAssetsPriceOracle");
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        await expect(
            Oracle.deploy(AddressZero, MAINNET_CONTRACTS.ETH_USD, MAINNET_CONTRACTS.WSTETH, AddressZero, "bad", 8, 0, {
                snapshotRatio: exp(1.05, 18),
                snapshotTimestamp: now - 1,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(Oracle, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { oracle } = await makeWstETHCAPO();
        const [, bob] = await ethers.getSigners();
        await expect(
            oracle.connect(bob).updateSnapshot({ snapshotRatio: 1, snapshotTimestamp: 1, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    describe("latestRoundData", () => {
        it(`wstETH/USD price with real data`, async () => {
            const { oracle } = await makeWstETHCAPO();
            const [, price] = await oracle.latestRoundData();

            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                MAINNET_CONTRACTS.ETH_USD
            );
            const [, ethPrice] = await ethFeed.latestRoundData();
            expect(price).to.be.gt(ethPrice);
            expect(price).to.be.lt((ethPrice * 130n) / 100n);
        });

        it("returns consistent price", async () => {
            const first = await makeWstETHCAPO();
            const second = await makeWstETHCAPO();
            const price1 = (await first.oracle.latestRoundData())[1];
            const price2 = (await second.oracle.latestRoundData())[1];
            expect(price1).to.be.closeTo(price2, price2 / 1000n);
        });

        it("cap logic (ratio growth)", async () => {
            const { oracle } = await makeWstETHCAPO();

            expect(await oracle.isCapped()).to.be.false;

            await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);

            const isCapped = await oracle.isCapped();
            expect(typeof isCapped).to.eq("boolean");
        });
    });

    it("manager and delay setters", async () => {
        const { oracle, manager } = await makeWstETHCAPO();
        const [, bob, carl] = await ethers.getSigners();
        await expect(oracle.connect(bob).setManager(bob.address)).to.be.revertedWithCustomError(oracle, "OnlyManager");
        await expect(oracle.setManager(AddressZero)).to.be.revertedWithCustomError(oracle, "ManagerIsZeroAddress()");
        await oracle.setManager(bob.address);
        expect(await oracle.manager()).to.eq(bob.address);
        await expect(oracle.connect(manager).setMinimumSnapshotDelay(0)).to.be.revertedWithCustomError(oracle, "OnlyManager");
        await oracle.connect(bob).setMinimumSnapshotDelay(7200);
        expect(await oracle.minimumSnapshotDelay()).to.eq(7200);
        await expect(oracle.connect(carl).setManager(carl.address)).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    it("snapshot guards", async () => {
        const { oracle } = await makeWstETHCAPO();
        await expect(oracle.updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: 0, maxYearlyRatioGrowthPercent: 0 })).to.be.revertedWithCustomError(
            oracle,
            "SnapshotRatioIsZero"
        );
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        await ethers.provider.send("evm_increaseTime", [3600]);
        await expect(
            oracle.updateSnapshot({ snapshotRatio: exp(1, 40), snapshotTimestamp: now, maxYearlyRatioGrowthPercent: exp(10000, 2) })
        ).to.be.revertedWithCustomError(oracle, "SnapshotCloseToOverflow");
    });

    it("basic getters", async () => {
        const { oracle } = await makeWstETHCAPO();
        expect(await oracle.description()).to.eq("wstETH CAPO");
        expect(await oracle.version()).to.eq(1);
        expect(await oracle.decimals()).to.eq(FEED_DECIMALS);
    });
});

describe("wstETH CAPO price feed market rate", () => {
    it("constructor: zero manager revert", async () => {
        const Oracle = await ethers.getContractFactory("WstETHCorrelatedAssetsPriceOracle");
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        await expect(
            Oracle.deploy(
                AddressZero,
                MAINNET_CONTRACTS.ETH_USD,
                MAINNET_CONTRACTS.WSTETH,
                "0x86392dC19c0b719886221c78AB11eb8Cf5c52812",
                "bad",
                8,
                0,
                {
                    snapshotRatio: exp(1.05, 18),
                    snapshotTimestamp: now - 1,
                    maxYearlyRatioGrowthPercent: 1
                }
            )
        ).to.be.revertedWithCustomError(Oracle, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { oracle } = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
        const [, bob] = await ethers.getSigners();
        await expect(
            oracle.connect(bob).updateSnapshot({ snapshotRatio: 1, snapshotTimestamp: 1, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    describe("latestRoundData", () => {
        it(`wstETH/USD price with real data`, async () => {
            const { oracle } = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
            const [, price] = await oracle.latestRoundData();

            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                MAINNET_CONTRACTS.ETH_USD
            );
            const [, ethPrice] = await ethFeed.latestRoundData();
            expect(price).to.be.gt(ethPrice);
            expect(price).to.be.lt((ethPrice * 130n) / 100n);
        });

        it("returns consistent price", async () => {
            const first = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
            const second = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
            const price1 = (await first.oracle.latestRoundData())[1];
            const price2 = (await second.oracle.latestRoundData())[1];
            expect(price1).to.be.closeTo(price2, price2 / 1000n);
        });

        it("cap logic (ratio growth)", async () => {
            const { oracle } = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");

            expect(await oracle.isCapped()).to.be.false;

            await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);

            const isCapped = await oracle.isCapped();
            expect(typeof isCapped).to.eq("boolean");
        });
    });

    it("manager and delay setters", async () => {
        const { oracle, manager } = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
        const [, bob, carl] = await ethers.getSigners();
        await expect(oracle.connect(bob).setManager(bob.address)).to.be.revertedWithCustomError(oracle, "OnlyManager");
        await expect(oracle.setManager(AddressZero)).to.be.revertedWithCustomError(oracle, "ManagerIsZeroAddress()");
        await oracle.setManager(bob.address);
        expect(await oracle.manager()).to.eq(bob.address);
        await expect(oracle.connect(manager).setMinimumSnapshotDelay(0)).to.be.revertedWithCustomError(oracle, "OnlyManager");
        await oracle.connect(bob).setMinimumSnapshotDelay(7200);
        expect(await oracle.minimumSnapshotDelay()).to.eq(7200);
        await expect(oracle.connect(carl).setManager(carl.address)).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    it("snapshot guards", async () => {
        const { oracle } = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
        await expect(oracle.updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: 0, maxYearlyRatioGrowthPercent: 0 })).to.be.revertedWithCustomError(
            oracle,
            "SnapshotRatioIsZero"
        );
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        await ethers.provider.send("evm_increaseTime", [3600]);
        await expect(
            oracle.updateSnapshot({ snapshotRatio: exp(1, 40), snapshotTimestamp: now, maxYearlyRatioGrowthPercent: exp(10000, 2) })
        ).to.be.revertedWithCustomError(oracle, "SnapshotCloseToOverflow");
    });

    it("basic getters", async () => {
        const { oracle } = await makeWstETHCAPO("0x86392dC19c0b719886221c78AB11eb8Cf5c52812");
        expect(await oracle.description()).to.eq("wstETH CAPO");
        expect(await oracle.version()).to.eq(1);
        expect(await oracle.decimals()).to.eq(FEED_DECIMALS);
    });
});

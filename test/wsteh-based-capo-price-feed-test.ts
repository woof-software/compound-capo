import { ethers } from "hardhat";
import { expect } from "chai";

export type Numeric = number | bigint;

const AddressZero = "0x0000000000000000000000000000000000000000";
const FEED_DECIMALS = 8;
const RATIO_DECIMALS = 18;

export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
    return (BigInt(Math.floor(i * 10 ** Number(r))) * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

function expected(priceA: bigint, ratio: bigint, decA: number): bigint {
    const raw = (priceA * ratio) / 10n ** BigInt(RATIO_DECIMALS);
    if (decA < FEED_DECIMALS) return raw * 10n ** BigInt(FEED_DECIMALS - decA);
    if (decA > FEED_DECIMALS) return raw / 10n ** BigInt(decA - FEED_DECIMALS);
    return raw;
}

export async function makeWstETHCAPO({ priceA, ratio, decimalsA = 8 }: { priceA: Numeric; ratio: Numeric; decimalsA?: Numeric }) {
    const [mgr] = await ethers.getSigners();
    const MockAgg = await ethers.getContractFactory("SimplePriceFeed");
    const MockWst = await ethers.getContractFactory("MockWstETH");
    const OracleFac = await ethers.getContractFactory("WstETHCorrelatedAssetsPriceOracle");
    const feedA = await MockAgg.deploy(priceA, decimalsA);
    const wst = await MockWst.deploy(ratio);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const oracle = await OracleFac.deploy(mgr.address, await feedA.getAddress(), await wst.getAddress(), "wstETH CAPO", FEED_DECIMALS, 3600, {
        snapshotRatio: ratio,
        snapshotTimestamp: now - 3600,
        maxYearlyRatioGrowthPercent: exp(0.01, 4)
    });
    return { oracle, feedA, wst, manager: mgr };
}

const cases = [
    { priceA: exp(1, 8), ratio: exp(1.05, 18), result: exp(1.05, 8) },
    { priceA: 212345600n, ratio: exp(1.0523, 18), result: 223451274n },
    { priceA: exp(100, 8), ratio: exp(1.05, 18), result: 10500000000n },
    { priceA: exp(0.9999, 8), ratio: exp(1.05, 18), result: 104989500n },
    { priceA: exp(0.987937, 8), ratio: exp(1.112345, 18), result: 109892678n },
    { priceA: exp(0.5, 8), ratio: exp(1.05, 18), result: 52500000n },
    { priceA: exp(0.00555, 8), ratio: exp(1.05, 18), result: 582750n },
    { priceA: exp(0, 8), ratio: 1n, result: exp(0, 8) },
    { priceA: exp(1, 18), ratio: exp(1.05, 18), decimalsA: 18, result: 105000000n },
    { priceA: exp(1.25, 18), ratio: exp(1.05, 18), decimalsA: 18, result: 131250000n },
    { priceA: exp(0.72, 18), ratio: exp(1.05, 18), decimalsA: 18, result: 75600000n }
];

describe("wstETH CAPO price feed", () => {
    it("constructor: zero manager revert", async () => {
        const MockAgg = await ethers.getContractFactory("SimplePriceFeed");
        const MockWst = await ethers.getContractFactory("MockWstETH");
        const Oracle = await ethers.getContractFactory("WstETHCorrelatedAssetsPriceOracle");
        const agg = await MockAgg.deploy(exp(1, 8), 8);
        const wst = await MockWst.deploy(exp(1.05, 18));
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        await expect(
            Oracle.deploy(AddressZero, await agg.getAddress(), await wst.getAddress(), "bad", 8, 0, {
                snapshotRatio: exp(1.05, 18),
                snapshotTimestamp: now - 1,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(Oracle, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { oracle } = await makeWstETHCAPO({ priceA: exp(1, 8), ratio: exp(1.05, 18) });
        const [, bob] = await ethers.getSigners();
        await expect(
            oracle.connect(bob).updateSnapshot({ snapshotRatio: 1, snapshotTimestamp: 1, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    describe("latestRoundData", () => {
        for (const { priceA, ratio, decimalsA = 8, result } of cases) {
            it(`priceA=${priceA}(dec${decimalsA}) ratio=${ratio} -> ${result}`, async () => {
                const { oracle } = await makeWstETHCAPO({ priceA, ratio, decimalsA });
                const [, price] = await oracle.latestRoundData();
                expect(price).to.eq(expected(priceA, ratio, Number(decimalsA)));
                expect(price).to.eq(result);
            });
        }

        it("returns same price for different decimals A", async () => {
            const first = await makeWstETHCAPO({ priceA: exp(30, 18), ratio: exp(1.1, 18), decimalsA: 18 });
            const second = await makeWstETHCAPO({ priceA: exp(30, 8), ratio: exp(1.1, 18), decimalsA: 8 });
            const price1 = (await first.oracle.latestRoundData())[1];
            const price2 = (await second.oracle.latestRoundData())[1];
            expect(price1).to.eq(price2);
        });

        it("cap logic (ratio growth)", async () => {
            const baseRatio = exp(1.05, 18);
            const { oracle, wst } = await makeWstETHCAPO({ priceA: exp(2_000, 8), ratio: baseRatio });
            await ethers.provider.send("evm_increaseTime", [3600]);
            await wst.setRatio(exp(1.16, 18));
            const [, price] = await oracle.latestRoundData();
            expect(await oracle.isCapped()).to.be.true;
            expect(price).to.be.lt(expected(exp(2_000, 8), exp(1.16, 18), 8));
        });
    });

    it("manager and delay setters", async () => {
        const { oracle, manager } = await makeWstETHCAPO({ priceA: exp(1, 8), ratio: exp(1.05, 18) });
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
        const { oracle } = await makeWstETHCAPO({ priceA: exp(1, 8), ratio: exp(1.05, 18) });
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
        const { oracle } = await makeWstETHCAPO({ priceA: exp(1, 8), ratio: exp(1.05, 18) });
        expect(await oracle.description()).to.eq("wstETH CAPO");
        expect(await oracle.version()).to.eq(1);
        expect(await oracle.decimals()).to.eq(FEED_DECIMALS);
    });
});

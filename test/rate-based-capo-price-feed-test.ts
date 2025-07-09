import { ethers } from "hardhat";
import { expect } from "chai";

export type Numeric = number | bigint;

const AddressZero = "0x0000000000000000000000000000000000000000";
const FEED_DECIMALS = 8;
const RATE_DECIMALS = 18;

export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
    return (BigInt(Math.floor(i * 10 ** Number(r))) * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

function expected(priceA: bigint, rate: bigint, decA: number): bigint {
    const raw = (priceA * rate) / 10n ** BigInt(RATE_DECIMALS);
    if (decA < FEED_DECIMALS) return raw * 10n ** BigInt(FEED_DECIMALS - decA);
    if (decA > FEED_DECIMALS) return raw / 10n ** BigInt(decA - FEED_DECIMALS);
    return raw;
}

export async function makeRateBasedCAPO({ priceA, rate, decimalsA = 8 }: { priceA: Numeric; rate: Numeric; decimalsA?: Numeric }) {
    const [signer] = await ethers.getSigners();

    const MockAgg = await ethers.getContractFactory("SimplePriceFeed");
    const MockRateProv = await ethers.getContractFactory("MockRateProvider");
    const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");
    const PriceFeedA = await MockAgg.deploy(priceA, decimalsA);
    const RateProv = await MockRateProv.deploy(rate);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const CapoPriceFeed = await OracleFac.deploy(
        signer.address,
        await PriceFeedA.getAddress(),
        await RateProv.getAddress(),
        "Rate-Based CAPO",
        FEED_DECIMALS,
        3600,
        18,
        {
            snapshotRatio: rate,
            snapshotTimestamp: now - 3600,
            maxYearlyRatioGrowthPercent: exp(0.01, 4)
        }
    );

    return { CapoPriceFeed, PriceFeedA, RateProv };
}

const testCases = [
    { priceA: exp(1, 8), rate: exp(30_000, 18), result: exp(30_000, 8) },
    { priceA: exp(2.123456, 8), rate: exp(31_333.123, 18), result: 6653450803308n },
    { priceA: exp(100, 8), rate: exp(30_000, 18), result: exp(3_000_000, 8) },
    { priceA: exp(0.9999, 8), rate: exp(30_000, 18), result: exp(29_997, 8) },
    { priceA: exp(0.987937, 8), rate: exp(31_947.71623, 18), result: 3156233092911n },
    { priceA: exp(0.5, 8), rate: exp(30_000, 18), result: exp(15_000, 8) },
    { priceA: exp(0.00555, 8), rate: exp(30_000, 18), result: exp(166.5, 8) },
    { priceA: exp(0, 8), rate: 1n, result: exp(0, 8) },
    { priceA: exp(1, 18), rate: exp(1_800, 18), decimalsA: 18, result: exp(1_800, 8) },
    { priceA: exp(1.25, 18), rate: exp(1_800, 18), decimalsA: 18, result: exp(2_250, 8) },
    { priceA: exp(0.72, 18), rate: exp(1_800, 18), decimalsA: 18, result: exp(1_296, 8) }
];

describe("Rate-Based CAPO price feed", () => {
    it("reverts with zero manager", async () => {
        const MockAgg = await ethers.getContractFactory("SimplePriceFeed");
        const MockRateProv = await ethers.getContractFactory("MockRateProvider");
        const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");

        const agg = await MockAgg.deploy(exp(1, 8), 8);
        const rp = await MockRateProv.deploy(exp(1, 18));
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(
            OracleFac.deploy(AddressZero, await agg.getAddress(), await rp.getAddress(), "CAPO", 8, 0, 18, {
                snapshotRatio: exp(1, 18),
                snapshotTimestamp: now - 1,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(OracleFac, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { CapoPriceFeed } = await makeRateBasedCAPO({
            priceA: exp(1, 8),
            rate: exp(30_000, 18)
        });
        const [, bob] = await ethers.getSigners();

        await expect(
            CapoPriceFeed.connect(bob).updateSnapshot({
                snapshotRatio: 1,
                snapshotTimestamp: 1,
                maxYearlyRatioGrowthPercent: 0
            })
        ).to.be.revertedWithCustomError(CapoPriceFeed, "OnlyManager");
    });
    describe("latestRoundData", () => {
        for (const { priceA, rate, decimalsA = 8, result } of testCases) {
            it(`priceA=${priceA} (dec${decimalsA}) * rate=${rate} -> ${result}`, async () => {
                const { CapoPriceFeed } = await makeRateBasedCAPO({ priceA, rate, decimalsA });
                const [, price] = await CapoPriceFeed.latestRoundData();
                expect(price).to.eq(expected(priceA, rate, Number(decimalsA)));
                expect(price).to.eq(result);
            });
        }

        it("returns same price for different decimals A", async () => {
            const common = { priceA: exp(30, 18), rate: exp(33.45, 18) };

            const first = await makeRateBasedCAPO({ ...common, decimalsA: 18 });
            const second = await makeRateBasedCAPO({
                priceA: exp(30, 8),
                rate: exp(33.45, 18),
                decimalsA: 8
            });

            const price1 = (await first.CapoPriceFeed.latestRoundData())[1];
            const price2 = (await second.CapoPriceFeed.latestRoundData())[1];
            expect(price1).to.eq(price2);
        });

        it("cap: if rate > max", async () => {
            const base = exp(30_000, 18);
            const { CapoPriceFeed, RateProv } = await makeRateBasedCAPO({
                priceA: base,
                rate: base,
                decimalsA: 18
            });

            await ethers.provider.send("evm_increaseTime", [3600]);
            await RateProv.setRate(exp(35_000, 18));

            const [, price] = await CapoPriceFeed.latestRoundData();
            expect(await CapoPriceFeed.isCapped()).to.be.true;
            expect(price).to.be.lt(expected(base, exp(35_000, 18), 18));
        });
    });

    it("public getters", async () => {
        const { CapoPriceFeed } = await makeRateBasedCAPO({
            priceA: exp(1, 8),
            rate: exp(30_000, 18)
        });
        expect(await CapoPriceFeed.description()).to.eq("Rate-Based CAPO");
        expect(await CapoPriceFeed.version()).to.eq(1);
        expect(await CapoPriceFeed.decimals()).to.eq(FEED_DECIMALS);
    });
});

import { ethers } from "hardhat";
import { expect } from "chai";

type Numeric = number | bigint;
const ZERO = "0x0000000000000000000000000000000000000000";
const OUT_DECIMALS = 8;

function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
    return (BigInt(Math.floor(i * 10 ** Number(r))) * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

async function makeCAPO({
    priceA,
    rate = exp(1, 18),
    feedDecimals = 8,
    ratioFeedDecimals = 18,
    outDecimals = OUT_DECIMALS
}: {
    priceA: Numeric;
    rate?: Numeric;
    feedDecimals?: Numeric;
    ratioFeedDecimals?: Numeric;
    outDecimals?: number;
}) {
    const [manager] = await ethers.getSigners();

    const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed");
    const OracleFactory = await ethers.getContractFactory("ChainlinkCorrelatedAssetsPriceOracle");

    const baseFeed = await SimplePriceFeed.deploy(priceA, feedDecimals);

    const ratioFeed = await SimplePriceFeed.deploy(rate, ratioFeedDecimals);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const oracle = await OracleFactory.deploy(
        manager.address,
        await baseFeed.getAddress(),
        await ratioFeed.getAddress(),
        "Chainlink CAPO",
        outDecimals,
        3600,
        {
            snapshotRatio: rate,
            snapshotTimestamp: now - 3600,
            maxYearlyRatioGrowthPercent: exp(0.01, 4)
        }
    );

    return { oracle, baseFeed, ratioFeed, manager };
}

describe("Chainlink CAPO price feed", () => {
    it("reverts with zero manager", async () => {
        const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed");
        const OracleFactory = await ethers.getContractFactory("ChainlinkCorrelatedAssetsPriceOracle");

        const feed = await SimplePriceFeed.deploy(exp(1, 8), 8);
        const ratioFeed = await SimplePriceFeed.deploy(exp(1, 18), 18);
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(
            OracleFactory.deploy(ZERO, await feed.getAddress(), await ratioFeed.getAddress(), "bad", 8, 3600, {
                snapshotRatio: 1,
                snapshotTimestamp: now - 3600,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(OracleFactory, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { oracle } = await makeCAPO({ priceA: exp(1, 8) });
        const [, bob] = await ethers.getSigners();

        await expect(
            oracle.connect(bob).updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: 0, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    it("manager and delay setters", async () => {
        const { oracle } = await makeCAPO({ priceA: exp(1, 8) });
        const [, alice] = await ethers.getSigners();

        await oracle.setManager(alice.address);
        expect(await oracle.manager()).to.eq(alice.address);

        await oracle.connect(alice).setMinimumSnapshotDelay(7200);
        expect(await oracle.minimumSnapshotDelay()).to.eq(7200);
    });

    it("snapshot guards", async () => {
        const { oracle } = await makeCAPO({ priceA: exp(1, 8) });
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(oracle.updateSnapshot({ snapshotRatio: 1, snapshotTimestamp: now, maxYearlyRatioGrowthPercent: 0 }))
            .to.be.revertedWithCustomError(oracle, "InvalidRatioTimestamp")
            .withArgs(now);

        await ethers.provider.send("evm_increaseTime", [3600]);
        await expect(
            oracle.updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: now, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "SnapshotRatioIsZero");
    });

    it("public getters", async () => {
        const { oracle, manager } = await makeCAPO({ priceA: exp(1234, 8) });

        expect(await oracle.version()).to.eq(1);
        expect(await oracle.decimals()).to.eq(OUT_DECIMALS);
        expect(await oracle.ratioDecimals()).to.eq(18);
        expect(await oracle.manager()).to.eq(manager.address);
        expect(await oracle.isCapped()).to.be.false;
    });

    describe("latestRoundData", () => {
        const cases = [
            { priceA: exp(1_000, 8), feedDec: 8, result: exp(1_000, 8) },
            { priceA: exp(2_123.456, 8), feedDec: 8, result: exp(2_123.456, 8) },
            { priceA: exp(50, 18), feedDec: 18, result: exp(50, 8) },
            { priceA: exp(0.555, 18), feedDec: 18, result: exp(0.555, 8) }
        ] as const;

        for (const t of cases) {
            it(`priceA=${t.priceA}(dec${t.feedDec}) -> ${t.result}`, async () => {
                const { oracle } = await makeCAPO({ priceA: t.priceA, feedDecimals: t.feedDec });
                const [, answer] = await oracle.latestRoundData();
                expect(answer).to.eq(t.result);
            });
        }

        it("returns same price for different feed decimals", async () => {
            const { oracle } = await makeCAPO({ priceA: exp(30, 8) });
            const price8 = (await oracle.latestRoundData())[1];

            const { oracle: or18 } = await makeCAPO({ priceA: exp(30, 18), feedDecimals: 18 });
            const price18 = (await or18.latestRoundData())[1];

            expect(price8).to.eq(price18);
        });

        it("passes round meta fields from feed", async () => {
            const { oracle, baseFeed } = await makeCAPO({ priceA: exp(1, 8) });

            await baseFeed.setRoundData(11, exp(2, 8), 100, 101, 11);

            const rd = await oracle.latestRoundData();
            expect(rd[0]).to.eq(11n);
            expect(rd[1]).to.eq(exp(2, 8));
            expect(rd[2]).to.eq(100n);
            expect(rd[3]).to.eq(101n);
            expect(rd[4]).to.eq(11n);
        });
    });
});

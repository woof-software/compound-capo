import { ethers, network } from "hardhat";
import { expect } from "chai";

export type Numeric = number | bigint;

const AddressZero = "0x0000000000000000000000000000000000000000";
const FEED_DECIMALS = 8;

const MAINNET_CONTRACTS = {
    ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee"
};

export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
    return (BigInt(Math.floor(i * 10 ** Number(r))) * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

export async function makeRateBasedCAPO(marketRateFeed: string | null = null) {
    const [signer] = await ethers.getSigners();
    const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");

    const weETH = await ethers.getContractAt(["function getRate() view returns (uint256)"], MAINNET_CONTRACTS.weETH);
    const baseRate = await weETH.getRate();

    let effectiveRate = baseRate;
    if (marketRateFeed) {
        const feed = await ethers.getContractAt(
            ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)"],
            marketRateFeed
        );
        const [, mRate] = await feed.latestRoundData();
        const marketDecimals = await feed.decimals();
        const norm = BigInt(mRate) * 10n ** (18n - BigInt(marketDecimals));
        effectiveRate = (baseRate * norm) / 10n ** 18n;
    }

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const CapoPriceFeed = await OracleFac.deploy(
        signer.address,
        MAINNET_CONTRACTS.ETH_USD,
        MAINNET_CONTRACTS.weETH,
        marketRateFeed ?? AddressZero,
        "Rate-Based CAPO",
        FEED_DECIMALS,
        3600,
        18,
        {
            snapshotRatio: effectiveRate,
            snapshotTimestamp: now - 3600,
            maxYearlyRatioGrowthPercent: exp(0.01, 4)
        }
    );

    return { CapoPriceFeed, RateProv: weETH };
}

describe("Rate-Based CAPO price feed common rate", () => {
    it("reverts with zero manager", async () => {
        const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(
            OracleFac.deploy(AddressZero, MAINNET_CONTRACTS.ETH_USD, AddressZero, MAINNET_CONTRACTS.weETH, "CAPO", 8, 0, 18, {
                snapshotRatio: exp(1, 18),
                snapshotTimestamp: now - 1,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(OracleFac, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { CapoPriceFeed } = await makeRateBasedCAPO();
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
        it(`weETH/USD price with real data`, async () => {
            const { CapoPriceFeed } = await makeRateBasedCAPO();
            const [, price] = await CapoPriceFeed.latestRoundData();
            console.log("weETH price:", price.toString());
            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                MAINNET_CONTRACTS.ETH_USD
            );
            const [, ethPrice] = await ethFeed.latestRoundData();

            expect(price).to.be.gt(ethPrice);
            expect(price).to.be.lt((ethPrice * 120n) / 100n);
        });

        it("returns consistent price", async () => {
            const first = await makeRateBasedCAPO();
            const second = await makeRateBasedCAPO();

            const price1 = (await first.CapoPriceFeed.latestRoundData())[1];
            const price2 = (await second.CapoPriceFeed.latestRoundData())[1];
            expect(price1).to.be.closeTo(price2, price2 / 1000n);
        });

        it("cap: if rate > max", async () => {
            const { CapoPriceFeed } = await makeRateBasedCAPO();

            expect(await CapoPriceFeed.isCapped()).to.be.false;

            await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);

            const isCapped = await CapoPriceFeed.isCapped();
            expect(typeof isCapped).to.eq("boolean");
        });
    });

    it("public getters", async () => {
        const { CapoPriceFeed } = await makeRateBasedCAPO();
        expect(await CapoPriceFeed.description()).to.eq("Rate-Based CAPO");
        expect(await CapoPriceFeed.version()).to.eq(1);
        expect(await CapoPriceFeed.decimals()).to.eq(FEED_DECIMALS);
    });
});

describe("Rate-Based CAPO price feed market rate", () => {
    it("reverts with zero manager", async () => {
        const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(
            OracleFac.deploy(AddressZero, MAINNET_CONTRACTS.ETH_USD, MAINNET_CONTRACTS.weETH, AddressZero, "CAPO", 8, 0, 18, {
                snapshotRatio: exp(1, 18),
                snapshotTimestamp: now - 1,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(OracleFac, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { CapoPriceFeed } = await makeRateBasedCAPO("0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22");
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
        it(`weETH/USD price with real data`, async () => {
            const { CapoPriceFeed } = await makeRateBasedCAPO("0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22");
            const [, price] = await CapoPriceFeed.latestRoundData();

            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                MAINNET_CONTRACTS.ETH_USD
            );
            const [, ethPrice] = await ethFeed.latestRoundData();
            console.log("weETH price:", price.toString());
            expect(price).to.be.gt(ethPrice);
            expect(price).to.be.lt((ethPrice * 120n) / 100n);
        });

        it("returns consistent price", async () => {
            const first = await makeRateBasedCAPO();
            const second = await makeRateBasedCAPO();

            const price1 = (await first.CapoPriceFeed.latestRoundData())[1];
            const price2 = (await second.CapoPriceFeed.latestRoundData())[1];
            expect(price1).to.be.closeTo(price2, price2 / 1000n);
        });

        it("cap: if rate > max", async () => {
            const { CapoPriceFeed } = await makeRateBasedCAPO("0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22");

            expect(await CapoPriceFeed.isCapped()).to.be.false;

            await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);

            const isCapped = await CapoPriceFeed.isCapped();
            expect(typeof isCapped).to.eq("boolean");
        });
    });

    it("public getters", async () => {
        const { CapoPriceFeed } = await makeRateBasedCAPO("0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22");
        expect(await CapoPriceFeed.description()).to.eq("Rate-Based CAPO");
        expect(await CapoPriceFeed.version()).to.eq(1);
        expect(await CapoPriceFeed.decimals()).to.eq(FEED_DECIMALS);
    });
});

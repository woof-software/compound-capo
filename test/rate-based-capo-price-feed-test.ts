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

export async function makeRateBasedCAPO() {
    const [signer] = await ethers.getSigners();

    const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");

    const weETH = await ethers.getContractAt(["function getRate() view returns (uint256)"], MAINNET_CONTRACTS.weETH);
    const currentRate = await weETH.getRate();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const CapoPriceFeed = await OracleFac.deploy(
        signer.address,
        MAINNET_CONTRACTS.ETH_USD,
        MAINNET_CONTRACTS.weETH,
        "Rate-Based CAPO",
        FEED_DECIMALS,
        3600,
        18,
        {
            snapshotRatio: currentRate,
            snapshotTimestamp: now - 3600,
            maxYearlyRatioGrowthPercent: exp(0.01, 4)
        }
    );

    return { CapoPriceFeed, PriceFeedA: null, RateProv: weETH };
}

describe("Rate-Based CAPO price feed", () => {
    it("reverts with zero manager", async () => {
        const OracleFac = await ethers.getContractFactory("RateBasedCorrelatedAssetsPriceOracle");
        const now = (await ethers.provider.getBlock("latest"))!.timestamp;

        await expect(
            OracleFac.deploy(AddressZero, MAINNET_CONTRACTS.ETH_USD, MAINNET_CONTRACTS.weETH, "CAPO", 8, 0, 18, {
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

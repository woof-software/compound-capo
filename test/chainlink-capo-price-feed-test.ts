import { ethers } from "hardhat";
import { expect } from "chai";
import { ChainlinkCorrelatedAssetsPriceOracle } from "../typechain-types";

type Numeric = number | bigint;
const AddressZero = ethers.ZeroAddress;
const OUT_DECIMALS = 8;

const CHAINLINK_FEEDS = {
    ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    STETH_ETH: "0x86392dC19c0b719886221c78AB11eb8Cf5c52812",
    RETH_ETH: "0x536218f9E9Eb48863970252233c8F271f554C2d0",
    CBETH_ETH: "0xF017fcB346A1885194689bA23Eff2fE6fA5C483b"
};

export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
  const sign = i < 0 ? -1n : 1n;
  const parts = Math.abs(i).toString().split('.');
  const intPart = parts[0];
  const fracPart = (parts[1] || '').padEnd(Number(r), '0').slice(0, Number(r));
  const scaled = BigInt(intPart + fracPart);
  return sign * (scaled * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

async function makeCAPO({ baseFeed, ratioFeed, outDecimals = OUT_DECIMALS, snapshotTimestamp  }: { baseFeed: string; ratioFeed: string; snapshotTimestamp?: number; outDecimals?: number }) {
    const [manager] = await ethers.getSigners();
    const OracleFactory = await ethers.getContractFactory("ChainlinkCorrelatedAssetsPriceOracle");

    const ratioFeedContract = await ethers.getContractAt(
        ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
        ratioFeed
    ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
    const [, currentRatio] = await ratioFeedContract.latestRoundData();

    const now = (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;

    const oracle = await OracleFactory.deploy(manager.address, baseFeed, ratioFeed, "Chainlink CAPO", outDecimals, 3600, {
        snapshotRatio: currentRatio,
        snapshotTimestamp: snapshotTimestamp ?? now - 3600,
        maxYearlyRatioGrowthPercent: exp(0.01, 4)
    });

    return { oracle, manager };
}

describe("Chainlink CAPO price feed", () => {
    it("reverts with zero manager", async () => {
        const OracleFactory = await ethers.getContractFactory("ChainlinkCorrelatedAssetsPriceOracle");

        const ratioFeedContract = await ethers.getContractAt(
            ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
            CHAINLINK_FEEDS.STETH_ETH
        ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
        const [, currentRatio] = await ratioFeedContract.latestRoundData();
        const now = (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;

        await expect(
            OracleFactory.deploy(AddressZero, CHAINLINK_FEEDS.ETH_USD, CHAINLINK_FEEDS.STETH_ETH, "bad", 8, 3600, {
                snapshotRatio: currentRatio,
                snapshotTimestamp: now - 3600,
                maxYearlyRatioGrowthPercent: 1
            })
        ).to.be.revertedWithCustomError(OracleFactory, "ManagerIsZeroAddress()");
    });

    it("reverts if non-manager sets snapshot", async () => {
        const { oracle } = await makeCAPO({ baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH });
        const [, bob] = await ethers.getSigners();

        await expect(
            oracle.connect(bob).updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: 0, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "OnlyManager");
    });

    it("manager and delay setters", async () => {
        const { oracle } = await makeCAPO({ baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH });
        const [, alice] = await ethers.getSigners();

        await oracle.setManager(alice.address);
        expect(await oracle.manager()).to.eq(alice.address);

        await oracle.connect(alice).setMinimumSnapshotDelay(7200);
        expect(await oracle.minimumSnapshotDelay()).to.eq(7200);
    });

    it("snapshot guards", async () => {
        const now = (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;
        const { oracle } = await makeCAPO({ baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH, snapshotTimestamp: now });
        await expect(oracle.updateSnapshot({ snapshotRatio: 1, snapshotTimestamp: now, maxYearlyRatioGrowthPercent: 0 }))
            .to.be.revertedWithCustomError(oracle, "InvalidRatioTimestamp")
            .withArgs(now);

        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine", []);
        await expect(
            oracle.updateSnapshot({ snapshotRatio: 0, snapshotTimestamp: now, maxYearlyRatioGrowthPercent: 0 })
        ).to.be.revertedWithCustomError(oracle, "SnapshotRatioIsZero");
    });

    it("public getters", async () => {
        const { oracle, manager } = await makeCAPO({ baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH });

        expect(await oracle.version()).to.eq(1);
        expect(await oracle.decimals()).to.eq(OUT_DECIMALS);
        expect(await oracle.ratioDecimals()).to.eq(18);
        expect(await oracle.manager()).to.eq(manager.address);
        expect(await oracle.isCapped()).to.be.false;
    });

    describe("latestRoundData", () => {
        const cases = [
            { baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH, name: "stETH/USD (Lido)" },
            { baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.RETH_ETH, name: "rETH/USD (Rocket Pool)" },
            { baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.CBETH_ETH, name: "cbETH/USD (Coinbase)" }
        ];

        for (const t of cases) {
            it(`calculates ${t.name} correctly`, async () => {
                const { oracle } = await makeCAPO({ baseFeed: t.baseFeed, ratioFeed: t.ratioFeed });
                const [, answer] = await oracle.latestRoundData();

                expect(answer).to.be.gt(0);

                expect(answer).to.be.gt(exp(1000, 8)); // > 1000
                expect(answer).to.be.lt(exp(5000, 8)); // < 5000

                const ethFeed = await ethers.getContractAt(
                    ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                    CHAINLINK_FEEDS.ETH_USD
                ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
                const [, ethPrice] = await ethFeed.latestRoundData();

                const minPrice = (ethPrice * 95n) / 100n; // 0.95 - 1.2
                const maxPrice = (ethPrice * 120n) / 100n;

                expect(answer).to.be.gte(minPrice);
                expect(answer).to.be.lte(maxPrice);
            });
        }

        it("returns same price for different output decimals", async () => {
            const { oracle: oracle8 } = await makeCAPO({
                baseFeed: CHAINLINK_FEEDS.ETH_USD,
                ratioFeed: CHAINLINK_FEEDS.STETH_ETH,
                outDecimals: 8
            });
            const { oracle: oracle18 } = await makeCAPO({
                baseFeed: CHAINLINK_FEEDS.ETH_USD,
                ratioFeed: CHAINLINK_FEEDS.STETH_ETH,
                outDecimals: 18
            });

            const [, price8] = await oracle8.latestRoundData();
            const [, price18] = await oracle18.latestRoundData();

            const price8In18Dec = price8 * 10n ** 10n;
            expect(price18).to.be.closeTo(price8In18Dec, price8In18Dec / 1000n);
        });

        it("passes round meta fields from base feed", async () => {
            const { oracle } = await makeCAPO({ baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH });

            const baseFeedContract = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                CHAINLINK_FEEDS.ETH_USD
            ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
            const [baseRoundId, , baseStartedAt, baseUpdatedAt, baseAnsweredInRound] = await baseFeedContract.latestRoundData();

            const [roundId, , startedAt, updatedAt, answeredInRound] = await oracle.latestRoundData();

            expect(roundId).to.eq(baseRoundId);
            expect(startedAt).to.eq(baseStartedAt);
            expect(updatedAt).to.eq(baseUpdatedAt);
            expect(answeredInRound).to.eq(baseAnsweredInRound);
        });

        it("verifies LST ratios are reasonable", async () => {
            for (const [name, feedAddress] of Object.entries({
                stETH: CHAINLINK_FEEDS.STETH_ETH,
                rETH: CHAINLINK_FEEDS.RETH_ETH,
                cbETH: CHAINLINK_FEEDS.CBETH_ETH
            })) {
                const feed = await ethers.getContractAt(
                    ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)"],
                    feedAddress
                ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
                const [, ratio] = await feed.latestRoundData();
                const decimals = await feed.decimals();

                const normalizedRatio = decimals == 18n ? ratio : ratio * 10n ** (18n - BigInt(decimals));

                if (name === "stETH") {
                    expect(normalizedRatio).to.be.gte(exp(0.9, 18));
                    expect(normalizedRatio).to.be.lte(exp(1.2, 18));
                }

                if (name === "rETH") {
                    expect(normalizedRatio).to.be.gte(exp(0.9, 18));
                    expect(normalizedRatio).to.be.lte(exp(1.2, 18));
                }

                if (name === "cbETH") {
                    expect(normalizedRatio).to.be.gte(exp(0.9, 18));
                    expect(normalizedRatio).to.be.lte(exp(1.2, 18));
                }
            }
        });

        it("correctly handles different LST depeg scenarios", async () => {
            const { oracle: stethOracle } = await makeCAPO({
                baseFeed: CHAINLINK_FEEDS.ETH_USD,
                ratioFeed: CHAINLINK_FEEDS.STETH_ETH
            });

            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                CHAINLINK_FEEDS.ETH_USD
            ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
            const stethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
                CHAINLINK_FEEDS.STETH_ETH
            ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;

            const [, ethPrice] = await ethFeed.latestRoundData();
            const [, stethRatio] = await stethFeed.latestRoundData();
            const [, stethPrice] = await stethOracle.latestRoundData();

            if (stethRatio < exp(1, 18)) {
                expect(stethPrice).to.be.lt(ethPrice);
            } else if (stethRatio > exp(1, 18)) {
                expect(stethPrice).to.be.gt(ethPrice);
            } else {
                expect(stethPrice).to.eq(ethPrice);
            }
        });

        it("correctly calculates price with real Chainlink data", async () => {
            const { oracle } = await makeCAPO({ baseFeed: CHAINLINK_FEEDS.ETH_USD, ratioFeed: CHAINLINK_FEEDS.STETH_ETH });
            const ethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)"],
                CHAINLINK_FEEDS.ETH_USD
            ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;
            const stethFeed = await ethers.getContractAt(
                ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)"],
                CHAINLINK_FEEDS.STETH_ETH
            ) as unknown as ChainlinkCorrelatedAssetsPriceOracle;

            const [, ethPrice] = await ethFeed.latestRoundData();
            const [, stethRatio] = await stethFeed.latestRoundData();
            const stethDecimals = await stethFeed.decimals();

            const expectedPrice = (BigInt(ethPrice) * stethRatio) / 10n ** BigInt(stethDecimals);

            const [, oraclePrice] = await oracle.latestRoundData();

            expect(oraclePrice).to.be.closeTo(expectedPrice, expectedPrice / 1000n);
        });
    });
});

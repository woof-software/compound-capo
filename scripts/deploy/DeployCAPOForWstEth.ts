/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ethers } from "hardhat";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config();

const jsonPath = process.env.WSTETH_CAPO_ARGS_PATH;
if (!jsonPath) {
    throw new Error("Missing WSTETH_CAPO_ARGS_PATH in .env");
}

const rawJson = JSON.parse(readFileSync(join(__dirname, "..", "..", jsonPath), "utf-8"));

const constructorArgs = {
    ...rawJson,
    priceCapSnapshot: {
        snapshotRatio: BigInt(rawJson.priceCapSnapshot.snapshotRatio),
        snapshotTimestamp: BigInt(rawJson.priceCapSnapshot.snapshotTimestamp),
        maxYearlyRatioGrowthPercent: rawJson.priceCapSnapshot.maxYearlyRatioGrowthPercent
    }
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying WstETH CAPO from:", deployer.address);

    const CAPO = await ethers.getContractFactory("WstETHCorrelatedAssetsPriceOracle");

    if (constructorArgs.priceCapSnapshot.snapshotRatio === 0n) {
        console.log("Fetching current ratio from wstETH...");
        const wstETH = await ethers.getContractAt(["function stEthPerToken() view returns (uint256)"], constructorArgs.wstETH);
        const stEthPerToken = await wstETH.stEthPerToken();

        const STETH_ETH_FEED = "0x86392dC19c0b719886221c78AB11eb8Cf5c52812";
        const stEthFeed = await ethers.getContractAt(
            ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
            STETH_ETH_FEED
        );
        const [, stEthToEth] = await stEthFeed.latestRoundData();

        const ratio = (stEthPerToken * BigInt(stEthToEth)) / 10n ** 18n;
        constructorArgs.priceCapSnapshot.snapshotRatio = ratio;
        console.log("Current wstETH/ETH ratio:", ratio.toString());
    }

    if (constructorArgs.priceCapSnapshot.snapshotTimestamp === 0n) {
        console.log("Fetching current block timestamp for snapshot...");
        const currentBlock = await ethers.provider.getBlock("latest");
        if (!currentBlock) {
            throw new Error("Failed to fetch the latest block.");
        }
        constructorArgs.priceCapSnapshot.snapshotTimestamp = BigInt(currentBlock.timestamp) - BigInt(constructorArgs.minimumSnapshotDelay);
        console.log("Snapshot timestamp:", constructorArgs.priceCapSnapshot.snapshotTimestamp.toString());
    }

    const capo = await CAPO.deploy(
        constructorArgs.manager,
        constructorArgs.baseAggregator,
        constructorArgs.wstETH,
        constructorArgs.description,
        constructorArgs.priceFeedDecimals,
        constructorArgs.minimumSnapshotDelay,
        constructorArgs.priceCapSnapshot
    );

    await capo.waitForDeployment();
    console.log("WstETH CAPO deployed to:", await capo.getAddress());
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});

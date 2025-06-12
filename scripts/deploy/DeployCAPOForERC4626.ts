/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ethers } from "hardhat";

import { IERC4626__factory } from "../../typechain-types";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config();

const jsonPath = process.env.CAPO_ARGS_PATH;
if (!jsonPath) {
  throw new Error("Missing CAPO_ARGS_PATH in .env");
}

// Read and parse JSON file
const rawJson = JSON.parse(readFileSync(join(__dirname, "..", "..", jsonPath), "utf-8"));

// Parse constructorArgs with BigInt conversion
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
    console.log("Deploying CAPO from:", deployer.address);

    const CAPO = await ethers.getContractFactory("ERC4626CorrelatedAssetsPriceOracle");

    if (constructorArgs.priceCapSnapshot.snapshotRatio === 0n) {
        console.log("Fetching current ratio from the ratio provider...");
        const ERC4626 = IERC4626__factory.connect(
            constructorArgs.ratioProvider,
            deployer
        );
        const decimals = await ERC4626.decimals();
        const ratio = await ERC4626.convertToAssets(10n ** BigInt(decimals));
        constructorArgs.priceCapSnapshot.snapshotRatio = ratio;
        console.log("Current ratio:", ratio.toString());
    }


    if(constructorArgs.priceCapSnapshot.snapshotTimestamp === 0n) {
        console.log("Fetching current block timestamp for snapshot...");
        const currentBlock = await ethers.provider.getBlock("latest");
        if (!currentBlock) {
            throw new Error("Failed to fetch the latest block.");
        }
        constructorArgs.priceCapSnapshot.snapshotTimestamp = BigInt(currentBlock.timestamp) - BigInt(constructorArgs.minimumSnapshotDelay);
        console.log("Current block timestamp:", constructorArgs.priceCapSnapshot.snapshotTimestamp.toString());
    }

    const capo = await CAPO.deploy(
        constructorArgs.manager,
        constructorArgs.baseAggregator,
        constructorArgs.ratioProvider,
        constructorArgs.description,
        constructorArgs.priceFeedDecimals,
        constructorArgs.minimumSnapshotDelay,
        constructorArgs.priceCapSnapshot
    );

    await capo.waitForDeployment();
    console.log("CAPO deployed to:", await capo.getAddress());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

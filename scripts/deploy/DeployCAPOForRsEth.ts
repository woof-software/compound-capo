/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ethers } from "hardhat";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config();

const jsonPath = process.env.RSETH_CAPO_ARGS_PATH;
if (!jsonPath) {
    throw new Error("Missing RSETH_CAPO_ARGS_PATH in .env");
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
    console.log("Deploying RsETH CAPO from:", deployer.address);

    const CAPO = await ethers.getContractFactory("RsETHCorrelatedAssetsPriceOracle");

    if (constructorArgs.priceCapSnapshot.snapshotRatio === 0n) {
        console.log("Fetching current ratio from LRT Oracle...");
        const lrtOracle = await ethers.getContractAt(["function rsETHPrice() view returns (uint256)"], constructorArgs.lrtOracle);
        const ratio = await lrtOracle.rsETHPrice();
        constructorArgs.priceCapSnapshot.snapshotRatio = ratio;
        console.log("Current rsETH price:", ratio.toString());
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
        constructorArgs.lrtOracle,
        constructorArgs.description,
        constructorArgs.priceFeedDecimals,
        constructorArgs.minimumSnapshotDelay,
        constructorArgs.priceCapSnapshot
    );

    await capo.waitForDeployment();
    console.log("RsETH CAPO deployed to:", await capo.getAddress());
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ethers } from "hardhat";

import { IERC4626__factory } from "../../typechain-types";

// Constructor arguments

const constructorArgs = {
    manager: "0xYourManagerAddress", // Admin or protocol manager
    baseAggregator: "0xBaseAggregatorAddress", // Chainlink feed, e.g. USDM/USD
    ratioProvider: "0xRatioProviderAddress", // ERC-4626 or LST ratio provider
    description: "CAPO: wUSDM / USD",
    priceFeedDecimals: 8,
    minimumSnapshotDelay: 86400, // 24 hours
    priceCapSnapshot: {
        snapshotRatio: 0n, // Initial ratio snapshot, will be set to current ratio if 0
        snapshotTimestamp: 0n, // Initial timestamp snapshot, will be set to current time if 0
        maxYearlyRatioGrowthPercent: 800 // 8% growth per year in basis points
    }
};

// example constructorArgs for wUSDM / USD on Optimism mainnet
// const constructorArgs = {
//     manager: "0x05ED81814BE2D9731c8906133236FFE9C62B013E", // Admin or protocol manager
//     baseAggregator: "0xA45881b63ff9BE3F9a3439CA0c002686e65a8ED5", // Chainlink feed, e.g. USDM/USD
//     ratioProvider: "0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812", // ERC-4626 or LST ratio provider
//     description: "CAPO: wUSDM / USD",
//     priceFeedDecimals: 8,
//     minimumSnapshotDelay: 86400, // 24 hours
//     priceCapSnapshot: {
//         snapshotRatio: 0n, // Initial ratio snapshot, will be set to current ratio if 0
//         snapshotTimestamp: 0n, // Initial timestamp snapshot, will be set to current time if 0
//         maxYearlyRatioGrowthPercent: 800 // 8% growth per year in basis points
//     }
// };

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

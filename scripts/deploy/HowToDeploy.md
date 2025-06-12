# How to Deploy CAPO for ERC-4626 Vaults

This guide explains how to deploy the ERC4626CorrelatedAssetsPriceOracle (CAPO) contract using Hardhat and a JSON-based configuration.

## 1. Configure the Deployment Parameters

Create a JSON file for the network and vault you're deploying CAPO for, e.g. `optimism-wusdm.json`:

```json
{
  "manager": "0xYourManagerAddress",
  "baseAggregator": "0xBaseAggregatorAddress",
  "ratioProvider": "0xRatioProviderAddress",
  "description": "CAPO: wUSDM / USD",
  "priceFeedDecimals": 8,
  "minimumSnapshotDelay": 86400,
  "priceCapSnapshot": {
    "snapshotRatio": 0,
    "snapshotTimestamp": 0,
    "maxYearlyRatioGrowthPercent": 800
  }
}
```

> **Note:** Set `snapshotRatio` and `snapshotTimestamp` to `0` to fetch them automatically during deployment.

## 2. Configure .env

In the project root, create or update your .env file to include the path to the JSON file you created above and other necessary environment variables:

```ini
CAPO_CONSTRUCTOR_PATH=./optimism-wusdm.json
ETHERSCAN_API_KEY="ABC123ABC123ABC123ABC123ABC123ABC1"
ANKR_KEY="X7f39Bc8Jw1zTpAqvMGY2Rdk6oVNUh4x9K3sEPLtHmZQbjiFOyWlcuAn5DgXreMS"
UNICHAIN_QUICKNODE_KEY="f1NpXqJtL7hRVkE2aZBcTY9osgUmwdC43PHeMAOj"

```

## 3. Deploy the Contract

Use Hardhat to run the deployment script on your chosen network. For example, to deploy to Optimism:

```bash
pnpm hardhat run scripts/deploy/DeployCAPOForERC4626.ts --network optimism
```

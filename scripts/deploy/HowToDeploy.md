# Correlated Assets Price Oracles (CAPO) Guide

This guide explains the different types of CAPO oracles available, their use cases, and deployment instructions.

## Overview

CAPO oracles provide price feeds for correlated assets (assets whose value is derived from another asset) with built-in price cap protection to prevent oracle manipulation. All oracles inherit from `PriceCapAdapterBase` which implements the growth cap mechanism.

## Oracle Types

### 1. ERC4626CorrelatedAssetsPriceOracle

**Purpose**: For ERC-4626 compliant vaults and yield-bearing tokens.

**Use Cases**:

- Yield-bearing stablecoins (e.g., sDAI, sUSDC)
- Lending protocol shares (e.g., aTokens)
- Any ERC-4626 vault token

**How it works**: Uses the vault's `convertToAssets()` function to get the exchange rate.

**Deployment Example**:

```json
{
  "manager": "0xYourManagerAddress",
  "baseAggregator": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", // USDC/USD Chainlink
  "ratioProvider": "0x83F20F44975D03b1b09e64809B757c47f942BEeA", // sDAI vault
  "description": "sDAI / USD Oracle",
  "priceFeedDecimals": 8,
  "minimumSnapshotDelay": 86400,
  "priceCapSnapshot": {
    "snapshotRatio": 0,
    "snapshotTimestamp": 0,
    "maxYearlyRatioGrowthPercent": 800 // 8% max yearly growth
  }
}
```

### 2. WstETHCorrelatedAssetsPriceOracle

**Purpose**: Specifically for Lido's wrapped staked ETH (wstETH).

**Use Cases**:

- wstETH price feeds for lending protocols
- wstETH collateral valuation

**How it works**:

- Gets stETH per wstETH from the wstETH contract
- Gets stETH/ETH rate from Chainlink (hardcoded address)
- Calculates: wstETH/USD = ETH/USD × (stETH/wstETH) × (stETH/ETH)

**Deployment Example**:

```json
{
  "manager": "0xYourManagerAddress",
  "baseAggregator": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD Chainlink
  "wstETH": "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", // wstETH contract
  "description": "wstETH / USD Oracle",
  "priceFeedDecimals": 8,
  "minimumSnapshotDelay": 3600,
  "priceCapSnapshot": {
    "snapshotRatio": 0,
    "snapshotTimestamp": 0,
    "maxYearlyRatioGrowthPercent": 500 // 5% max yearly growth
  }
}
```

### 3. RsETHCorrelatedAssetsPriceOracle

**Purpose**: For Kelp DAO's rsETH (Liquid Restaked Token).

**Use Cases**:

- rsETH price feeds for DeFi protocols
- Restaked ETH derivatives valuation

**How it works**: Gets the rsETH price directly from Kelp's LRT Oracle.

**Deployment Example**:

```json
{
  "manager": "0xYourManagerAddress",
  "baseAggregator": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD Chainlink
  "lrtOracle": "0x349A73444b1a310BAe67ef67973022020d70020d", // Kelp LRT Oracle
  "description": "rsETH / USD Oracle",
  "priceFeedDecimals": 8,
  "minimumSnapshotDelay": 3600,
  "priceCapSnapshot": {
    "snapshotRatio": 0,
    "snapshotTimestamp": 0,
    "maxYearlyRatioGrowthPercent": 500 // 5% max yearly growth
  }
}
```

### 4. ChainlinkCorrelatedAssetsPriceOracle

**Purpose**: For assets where both base price and ratio are available via Chainlink feeds.

**Use Cases**:

- Any asset pair where Chainlink provides both feeds

**How it works**: Multiplies two Chainlink price feeds to get the final price.

**Deployment Example**:

```json
{
  "manager": "0xYourManagerAddress",
  "baseAggregator": "0xb49f677943BC038e9857d61E7d053CaA2C1734C1", // EUR/USD Chainlink
  "ratioProvider": "0xb49f677943BC038e9857d61E7d053CaA2C1734C1", // EURS/EUR Chainlink
  "description": "EURS / USD Oracle",
  "priceFeedDecimals": 8,
  "minimumSnapshotDelay": 86400,
  "priceCapSnapshot": {
    "snapshotRatio": 0,
    "snapshotTimestamp": 0,
    "maxYearlyRatioGrowthPercent": 100 // 1% max yearly growth for stablecoins
  }
}
```

### 5. RateBasedCorrelatedAssetsPriceOracle

**Purpose**: For LSTs and other tokens that implement the `IRateProvider` interface.

**Use Cases**:

- Rocket Pool ETH (rETH)
- Coinbase Wrapped Staked ETH (cbETH)
- Frax Ether (frxETH)
- Other liquid staking tokens with rate providers

**How it works**: Calls `getRate()` on the token contract to get the exchange rate.

**Deployment Example**:

```json
{
  "manager": "0xYourManagerAddress",
  "baseAggregator": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD Chainlink
  "rateProvider": "0xae78736Cd615f374D3085123A210448E74Fc6393", // rETH contract
  "description": "rETH / USD Oracle",
  "priceFeedDecimals": 8,
  "minimumSnapshotDelay": 3600,
  "rateDecimals": 18, // Additional parameter for rate decimals
  "priceCapSnapshot": {
    "snapshotRatio": 0,
    "snapshotTimestamp": 0,
    "maxYearlyRatioGrowthPercent": 500 // 5% max yearly growth
  }
}
```

## Deployment Instructions

### 1. Configure Environment Variables

Create or update your `.env` file:

```ini
# Network RPC URLs
ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/your-api-key"
OPTIMISM_RPC_URL="https://opt-mainnet.g.alchemy.com/v2/your-api-key"

# Deployment configuration paths
ERC4626_CAPO_ARGS_PATH=./configs/optimism-wusdms.json
WSTETH_CAPO_ARGS_PATH=./configs/wsteth-usd.json
RSETH_CAPO_ARGS_PATH=./configs/rseth-usd.json
CHAINLINK_CAPO_ARGS_PATH=./configs/steth-usd.json
RATE_BASED_CAPO_ARGS_PATH=./configs/reth-usd.json

# Etherscan API keys for verification
ETHERSCAN_API_KEY="your-etherscan-api-key"
OPTIMISTIC_ETHERSCAN_API_KEY="your-optimism-api-key"
```

### 2. Create Configuration File

Create a JSON configuration file based on the examples above. Key parameters:

- **manager**: Address that can update oracle parameters
- **baseAggregator**: Chainlink price feed for the base asset (usually USD)
- **ratioProvider/wstETH/lrtOracle/rateProvider**: Address of the ratio/rate provider
- **priceFeedDecimals**: Output decimals (typically 8 for USD feeds)
- **minimumSnapshotDelay**: Minimum time before snapshot can be updated (in seconds)
- **maxYearlyRatioGrowthPercent**: Maximum allowed yearly growth in basis points (100 = 1%)

> **Note:** Set `snapshotRatio` and `snapshotTimestamp` to `0` to fetch them automatically during deployment.

### 3. Deploy the Contract

Run the appropriate deployment script:

```bash
# For ERC-4626 vaults
pnpm hardhat run scripts/deploy/deploy-erc4626-capo.ts --network mainnet

# For wstETH
pnpm hardhat run scripts/deploy/deploy-wsteth-capo.ts --network mainnet

# For rsETH
pnpm hardhat run scripts/deploy/deploy-rseth-capo.ts --network mainnet

# For Chainlink-based oracles
pnpm hardhat run scripts/deploy/deploy-chainlink-capo.ts --network mainnet

# For Rate-based LSTs
pnpm hardhat run scripts/deploy/deploy-rate-based-capo.ts --network mainnet
```

## Choosing the Right Oracle

| Asset Type          | Recommended Oracle                   | Key Requirement              |
| ------------------- | ------------------------------------ | ---------------------------- |
| ERC-4626 Vaults     | ERC4626CorrelatedAssetsPriceOracle   | Must implement ERC-4626      |
| wstETH              | WstETHCorrelatedAssetsPriceOracle    | Specific to Lido's wstETH    |
| rsETH               | RsETHCorrelatedAssetsPriceOracle     | Specific to Kelp's rsETH     |
| LSTs with getRate() | RateBasedCorrelatedAssetsPriceOracle | Must implement IRateProvider |
| Synthetic Assets    | ChainlinkCorrelatedAssetsPriceOracle | Both feeds on Chainlink      |

## Price Cap Parameters

The price cap mechanism prevents sudden price spikes that could be used for oracle manipulation:

- **Low volatility assets** (stablecoins): 100-200 bps (1-2% yearly)
- **Moderate volatility** (LSTs): 300-500 bps (3-5% yearly)
- **Higher volatility** (yield vaults): 500-1000 bps (5-10% yearly)

Always set conservative caps based on historical growth patterns of the asset.

## Security Considerations

1. **Manager Role**: The manager can update price cap parameters. Use a multisig or governance contract.
2. **Snapshot Delay**: Set appropriate delays to prevent frequent updates (minimum 1 hour recommended).
3. **Initial Snapshot**: Ensure the initial ratio is accurate - consider multiple sources for verification.
4. **Growth Caps**: Set conservative caps to prevent manipulation while allowing for legitimate growth.

## Monitoring

After deployment, monitor:

- Current ratio vs capped ratio (`getRatio()` vs `_getMaxRatio()`)
- Whether the oracle is capped (`isCapped()`)
- Time since last snapshot update
- Deviation from other price sources

Regular monitoring ensures the oracle continues to function correctly and the price cap parameters remain appropriate.

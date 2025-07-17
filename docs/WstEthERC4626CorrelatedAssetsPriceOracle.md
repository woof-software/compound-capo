# Solidity API

## WstEthERC4626CorrelatedAssetsPriceOracle

### wstETH

```solidity
address wstETH
```

### scale

```solidity
int256 scale
```

### feedDecimals

```solidity
uint8 feedDecimals
```

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregatorAddress, address _ratioProviderAddress, string _description, uint8 _priceFeedDecimals, uint48 _minimumSnapshotDelay, struct PriceCapAdapterBase.PriceCapSnapshot _priceCapSnapshot, address _wstETH) public
```

### latestRoundData

```solidity
function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

WstETH price for the latest round

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| roundId | uint80 | Round id from the stETH price feed |
| answer | int256 | Latest price for wstETH / USD |
| startedAt | uint256 | Timestamp when the round was started; passed on from stETH price feed |
| updatedAt | uint256 | Timestamp when the round was last updated; passed on from stETH price feed |
| answeredInRound | uint80 | Round id in which the answer was computed; passed on from stETH price feed |

### signed256

```solidity
function signed256(uint256 n) internal pure returns (int256)
```


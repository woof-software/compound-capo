# Solidity API

## SimpleERC4626CorrelatedAssetsPriceOracle

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregatorAddress, address _ratioProviderAddress, string _description, uint8 _priceFeedDecimals, uint48 _minimumSnapshotDelay, struct PriceCapAdapterBase.PriceCapSnapshot _priceCapSnapshot) public
```

### latestRoundData

```solidity
function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

Price for the latest round

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| roundId | uint80 | Round id from the underlying price feed |
| answer | int256 | Latest price for the asset in terms of ETH |
| startedAt | uint256 | Timestamp when the round was started; passed on from underlying price feed |
| updatedAt | uint256 | Timestamp when the round was last updated; passed on from underlying price feed |
| answeredInRound | uint80 | Round id in which the answer was computed; passed on from underlying price feed |

### scalePrice

```solidity
function scalePrice(int256 price) internal view returns (int256)
```


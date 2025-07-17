# Solidity API

## MarketPriceAdapter

Base contract for price oracles that optionally adjust an LST-native ratio using an external market price feed.

### marketAggregator

```solidity
contract AggregatorV3Interface marketAggregator
```

External price feed for LST-to-asset market rate.

_If zero, assumes 1:1 ratio between LST and asset._

### _marketPrecision

```solidity
int256 _marketPrecision
```

Scaling factor based on marketAggregator's decimals (10^decimals).

_If zero, market rate is skipped and raw ratio is used (1:1 mode)._

### constructor

```solidity
constructor(address _marketAggregator) internal
```

### _convertWithMarketRate

```solidity
function _convertWithMarketRate(int256 rawRatio) internal view returns (int256)
```

Converts the raw ratio using the market rate if available.


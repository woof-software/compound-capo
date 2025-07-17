# Solidity API

## RateBasedCorrelatedAssetsPriceOracle

### _ratioDecimals

```solidity
uint8 _ratioDecimals
```

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregator, address _rateProvider, address _marketAggregator, string _description, uint8 _priceFeedDecimals, uint48 _minSnapshotDelay, uint8 _rateDecimals, struct PriceCapAdapterBase.PriceCapSnapshot _snap) public
```

### getRatio

```solidity
function getRatio() public view returns (int256)
```

Returns the current exchange ratio of lst to the underlying(base) asset

### ratioDecimals

```solidity
function ratioDecimals() public view returns (uint8)
```

Returns the number of decimals for (lst asset / underlying asset) ratio


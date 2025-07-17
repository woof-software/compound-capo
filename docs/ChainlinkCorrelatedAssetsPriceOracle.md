# Solidity API

## ChainlinkCorrelatedAssetsPriceOracle

### _ratioDecimals

```solidity
uint8 _ratioDecimals
```

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregatorAddress, address _ratioProviderAddress, string _description, uint8 _priceFeedDecimals, uint48 _minSnapshotDelay, struct PriceCapAdapterBase.PriceCapSnapshot _snap) public
```

### getRatio

```solidity
function getRatio() public view returns (int256 ratio)
```

Returns the current exchange ratio of lst to the underlying(base) asset

### ratioDecimals

```solidity
function ratioDecimals() public view returns (uint8)
```

Returns the number of decimals for (lst asset / underlying asset) ratio


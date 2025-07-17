# Solidity API

## WstETHCorrelatedAssetsPriceOracle

### _ratioDecimals

```solidity
uint8 _ratioDecimals
```

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregator, address _wstETH, address _marketAggregator, string _description, uint8 _priceFeedDecimals, uint48 _minSnapshotDelay, struct PriceCapAdapterBase.PriceCapSnapshot _snap) public
```

### getRatio

```solidity
function getRatio() public view returns (int256)
```

@inheritdoc PriceCapAdapterBase

### ratioDecimals

```solidity
function ratioDecimals() public view returns (uint8)
```

@inheritdoc PriceCapAdapterBase


# Solidity API

## ERC4626CorrelatedAssetsPriceOracle

### _ratioDecimals

```solidity
uint8 _ratioDecimals
```

### _providerDecimals

```solidity
uint8 _providerDecimals
```

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregatorAddress, address _ratioProviderAddress, string _description, uint8 _priceFeedDecimals, uint48 _minimumSnapshotDelay, struct PriceCapAdapterBase.PriceCapSnapshot _priceCapSnapshot) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _manager | address | address of the manager |
| _baseAggregatorAddress | contract AggregatorV3Interface | address of the base aggregator |
| _ratioProviderAddress | address | address of the ratio provider |
| _description | string | description of the pair |
| _priceFeedDecimals | uint8 | number of decimals for the price feed |
| _minimumSnapshotDelay | uint48 | minimum time that should have passed from the snapshot timestamp to the current block.timestamp |
| _priceCapSnapshot | struct PriceCapAdapterBase.PriceCapSnapshot | parameters to set price cap |

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


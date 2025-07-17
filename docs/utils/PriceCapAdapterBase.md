# Solidity API

## PriceCapAdapterBase

Price adapter to cap the price of the underlying asset.

### NewPriceCapSnapshot

```solidity
event NewPriceCapSnapshot(uint256 snapshotRatio, uint256 snapshotTimestamp, uint256 maxRatioGrowthPerSecond, uint32 maxYearlyRatioGrowthPercent)
```

Event emitted when a new price cap snapshot is set

### NewManager

```solidity
event NewManager(address newManager)
```

Event emitted when the manager is updated

### NewMinimumSnapshotDelay

```solidity
event NewMinimumSnapshotDelay(uint256 newMinimumSnapshotDelay)
```

Event emitted when the minimum snapshot delay is updated

### PriceCapSnapshot

```solidity
struct PriceCapSnapshot {
  uint256 snapshotRatio;
  uint48 snapshotTimestamp;
  uint32 maxYearlyRatioGrowthPercent;
}
```

### ManagerIsZeroAddress

```solidity
error ManagerIsZeroAddress()
```

### SnapshotRatioIsZero

```solidity
error SnapshotRatioIsZero()
```

### SnapshotCloseToOverflow

```solidity
error SnapshotCloseToOverflow(uint256 snapshotRatio, uint32 maxYearlyRatioGrowthPercent)
```

### InvalidRatioTimestamp

```solidity
error InvalidRatioTimestamp(uint48 timestamp)
```

### OnlyManager

```solidity
error OnlyManager()
```

### InvalidInt256

```solidity
error InvalidInt256()
```

### InvalidCheckpointDuration

```solidity
error InvalidCheckpointDuration()
```

### InvalidAddress

```solidity
error InvalidAddress()
```

### onlyManager

```solidity
modifier onlyManager()
```

Modifier to restrict access to the manager

### VERSION

```solidity
uint256 VERSION
```

Version of the price feed

### BASIS_POINTS

```solidity
uint256 BASIS_POINTS
```

Decimal factor for percentage

### SECONDS_PER_YEAR

```solidity
uint256 SECONDS_PER_YEAR
```

Number of seconds per year (365 days)

### assetToBaseAggregator

```solidity
contract AggregatorV3Interface assetToBaseAggregator
```

Price feed for (ASSET / BASE) pair

### manager

```solidity
address manager
```

Manager address

### ratioProvider

```solidity
address ratioProvider
```

Ratio feed for (LST_ASSET / BASE_ASSET) pair

### decimals

```solidity
uint8 decimals
```

Number of decimals in the output of this price feed

### minimumSnapshotDelay

```solidity
uint48 minimumSnapshotDelay
```

Minimum time (in seconds) that should have passed from the snapshot timestamp to the current block.timestamp

### description

```solidity
string description
```

Description of the pair

### snapshotRatio

```solidity
uint256 snapshotRatio
```

Ratio at the time of snapshot

### snapshotTimestamp

```solidity
uint48 snapshotTimestamp
```

Timestamp at the time of snapshot

### maxRatioGrowthPerSecond

```solidity
uint256 maxRatioGrowthPerSecond
```

Ratio growth per second

### GROWTH_RATIO_SCALE

```solidity
uint256 GROWTH_RATIO_SCALE
```

Growth ratio scale

### maxYearlyRatioGrowthPercent

```solidity
uint32 maxYearlyRatioGrowthPercent
```

Max yearly growth percent, scaled by BASIS_POINTS

### shouldUpscale

```solidity
bool shouldUpscale
```

Whether or not the price should be upscaled

### rescaleFactor

```solidity
int256 rescaleFactor
```

The amount to upscale or downscale the price by

### lastSnapshotUpdateTimestamp

```solidity
uint256 lastSnapshotUpdateTimestamp
```

Timestamp of the last snapshot update

### constructor

```solidity
constructor(address _manager, contract AggregatorV3Interface _baseAggregatorAddress, address _ratioProviderAddress, string _description, uint8 _priceFeedDecimals, uint48 _minimumSnapshotDelay, struct PriceCapAdapterBase.PriceCapSnapshot _priceCapSnapshot) internal
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _manager | address | Address of the manager |
| _baseAggregatorAddress | contract AggregatorV3Interface | Address of the base aggregator |
| _ratioProviderAddress | address | Address of the ratio provider |
| _description | string | Description of the pair |
| _priceFeedDecimals | uint8 | Number of decimals for the price feed |
| _minimumSnapshotDelay | uint48 | Minimum time that should have passed from the snapshot timestamp to the current block.timestamp |
| _priceCapSnapshot | struct PriceCapAdapterBase.PriceCapSnapshot | Parameters to set price cap |

### updateSnapshot

```solidity
function updateSnapshot(struct PriceCapAdapterBase.PriceCapSnapshot priceCapParams) external
```

Updates price cap parameters

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceCapParams | struct PriceCapAdapterBase.PriceCapSnapshot | Parameters to set price cap |

### setManager

```solidity
function setManager(address newManager) external
```

Sets the manager address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newManager | address | Address of the new manager |

### setMinimumSnapshotDelay

```solidity
function setMinimumSnapshotDelay(uint48 newMinimumSnapshotDelay) external
```

Sets the minimum snapshot delay

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newMinimumSnapshotDelay | uint48 | Minimum time that should have passed from the snapshot timestamp to the current block.timestamp |

### latestRoundData

```solidity
function latestRoundData() external view virtual returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

Price for the latest round

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| roundId | uint80 | Round id from the underlying price feed |
| answer | int256 | Latest price for the asset in terms of the underlying asset |
| startedAt | uint256 | Timestamp when the round was started; passed on from underlying price feed |
| updatedAt | uint256 | Timestamp when the round was last updated; passed on from underlying price feed |
| answeredInRound | uint80 | Round id in which the answer was computed; passed on from underlying price feed |

### _scalePrice

```solidity
function _scalePrice(int256 price) internal view returns (int256)
```

Scales the price based on the rescale factor

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | int256 | Price to scale |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | scaled Price |

### _setSnapshot

```solidity
function _setSnapshot(struct PriceCapAdapterBase.PriceCapSnapshot priceCapParams) internal
```

Updates price cap parameters from recent snapshot

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceCapParams | struct PriceCapAdapterBase.PriceCapSnapshot | Parameters to set price cap |

### getRatio

```solidity
function getRatio() public view virtual returns (int256)
```

Returns the current exchange ratio of lst to the underlying(base) asset

### ratioDecimals

```solidity
function ratioDecimals() public view virtual returns (uint8)
```

Returns the number of decimals for (lst asset / underlying asset) ratio

### isCapped

```solidity
function isCapped() public view returns (bool)
```

Returns if the price is currently capped

### version

```solidity
function version() external pure returns (uint256)
```

Version of the price feed contract

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The version of the price feed contract |

### _getMaxRatio

```solidity
function _getMaxRatio() internal view returns (int256)
```

Returns the maximum ratio that can be achieved at the current block.timestamp

### _signed256

```solidity
function _signed256(uint256 n) internal pure returns (int256)
```


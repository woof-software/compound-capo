# Solidity API

## IWstETH

_Interface for interacting with WstETH contract
Note Not a comprehensive interface_

### decimals

```solidity
function decimals() external view returns (uint8)
```

### stETH

```solidity
function stETH() external returns (address)
```

### wrap

```solidity
function wrap(uint256 _stETHAmount) external returns (uint256)
```

### unwrap

```solidity
function unwrap(uint256 _wstETHAmount) external returns (uint256)
```

### receive

```solidity
function receive() external payable
```

### getWstETHByStETH

```solidity
function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256)
```

### getStETHByWstETH

```solidity
function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256)
```

### stEthPerToken

```solidity
function stEthPerToken() external view returns (uint256)
```

### tokensPerStEth

```solidity
function tokensPerStEth() external view returns (uint256)
```


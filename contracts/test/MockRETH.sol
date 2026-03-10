// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

contract MockRETH {
    uint256 private _exchangeRate;
    uint8 public constant decimals = 18;

    constructor(uint256 initialRate) {
        _exchangeRate = initialRate;
    }

    function getExchangeRate() external view returns (uint256) {
        return _exchangeRate;
    }

    function setRETHRate(uint256 newRate) external {
        _exchangeRate = newRate;
    }
}

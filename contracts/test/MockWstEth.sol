// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

interface IWstETHMock {
    function setRate(uint256) external;
}

contract MockWstETH is IWstETHMock {
    uint256 private _rate;
    uint8 public immutable decimals;

    constructor(uint8 _dec, uint256 initialRate) {
        decimals = _dec;
        _rate = initialRate;
    }

    function tokensPerStEth() external view returns (uint256) {
        return _rate;
    }

    function setRate(uint256 r) external override {
        _rate = r;
    }
}

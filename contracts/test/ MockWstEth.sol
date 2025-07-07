// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

contract MockWstETH {
    uint256 private _ratio;
    uint8 public constant decimals = 18;

    constructor(uint256 ratio_) {
        _ratio = ratio_;
    }

    function tokensPerStEth() external view returns (uint256) {
        return _ratio;
    }

    function setRatio(uint256 newRatio) external {
        _ratio = newRatio;
    }
}

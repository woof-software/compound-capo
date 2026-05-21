// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

interface IRETHProvider {
    function getExchangeRate() external view returns (uint256);
}

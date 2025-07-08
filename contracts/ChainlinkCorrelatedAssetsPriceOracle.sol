// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";

contract ChainlinkCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    uint256 public constant VERSION = 1;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregatorAddress,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregatorAddress, address(this), _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {}

    function getRatio() public pure override returns (int256) {
        return 1e18;
    }

    function ratioDecimals() public pure override returns (uint8) {
        return 18;
    }

    function version() external pure returns (uint256) {
        return VERSION;
    }
}

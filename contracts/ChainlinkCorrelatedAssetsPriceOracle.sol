// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { IRateProvider } from "./interfaces/IRateProvider.sol";

contract ChainlinkCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    uint256 public constant VERSION = 1;
    uint8 internal immutable _ratioDecimals;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregatorAddress,
        address _ratioProviderAddress,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregatorAddress, _ratioProviderAddress, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {
        _ratioDecimals = AggregatorV3Interface(_ratioProviderAddress).decimals();
    }

    function getRatio() public view override returns (int256 ratio) {
        (, ratio, , , ) = AggregatorV3Interface(ratioProvider).latestRoundData();
    }

    function ratioDecimals() public view override returns (uint8) {
        return _ratioDecimals;
    }

    function version() external pure returns (uint256) {
        return VERSION;
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { ILRTOracle } from "./interfaces/ILRTOracle.sol";

contract RsETHCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    uint256 public constant VERSION = 1;

    uint8 internal immutable _ratioDecimals;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _lrtOracle,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregator, _lrtOracle, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {
        _ratioDecimals = 18;
    }

    function getRatio() public view override returns (int256) {
        return int256(ILRTOracle(ratioProvider).rsETHPrice());
    }

    function ratioDecimals() public view override returns (uint8) {
        return _ratioDecimals;
    }

    function version() external pure returns (uint256) {
        return VERSION;
    }
}

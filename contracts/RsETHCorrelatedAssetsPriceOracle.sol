// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { ILRTOracle } from "./interfaces/ILRTOracle.sol";

/**
 * @title RsETHCorrelatedAssetsPriceOracle
 * @author Compound
 */
contract RsETHCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _lrtOracle,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregator, _lrtOracle, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {}

    /// @inheritdoc PriceCapAdapterBase
    function getRatio() public view override returns (int256) {
        return int256(ILRTOracle(ratioProvider).rsETHPrice());
    }

    /// @inheritdoc PriceCapAdapterBase
    function ratioDecimals() public pure override returns (uint8) {
        return 18;
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { MarketPriceAdapter } from "./utils/MarketPriceAdapter.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { IRateProvider } from "./interfaces/IRateProvider.sol";

/**
 * @title RateBasedCorrelatedAssetsPriceOracle
 * @author Compound
 */
contract RateBasedCorrelatedAssetsPriceOracle is PriceCapAdapterBase, MarketPriceAdapter {
    uint8 internal immutable _ratioDecimals;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _rateProvider,
        address _marketAggregator,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        uint8 _rateDecimals,
        PriceCapSnapshot memory _snap
    )
        MarketPriceAdapter(_marketAggregator)
        PriceCapAdapterBase(_manager, _baseAggregator, _rateProvider, _description, _priceFeedDecimals, _minSnapshotDelay, _snap)
    {
        _ratioDecimals = _rateDecimals;
    }

    /// @inheritdoc PriceCapAdapterBase
    function getRatio() public view override returns (int256) {
        int256 ratio = int256(IRateProvider(ratioProvider).getRate());
        return _convertWithMarketRate(ratio);
    }

    /// @inheritdoc PriceCapAdapterBase
    function ratioDecimals() public view override returns (uint8) {
        return _ratioDecimals;
    }
}

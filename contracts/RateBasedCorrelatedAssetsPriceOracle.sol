// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { IRateProvider } from "./interfaces/IRateProvider.sol";

/**
 * @title RateBasedCorrelatedAssetsPriceOracle
 * @author Compound
 */
contract RateBasedCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    AggregatorV3Interface public immutable marketAggregator;
    int256 internal immutable _marketPreceison;
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
    ) PriceCapAdapterBase(_manager, _baseAggregator, _rateProvider, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {
        _ratioDecimals = _rateDecimals;
        marketAggregator = AggregatorV3Interface(_marketAggregator);
        _marketPreceison = int256(_marketAggregator == address(0) ? 0 : 10 ** AggregatorV3Interface(_marketAggregator).decimals());
    }

    /// @inheritdoc PriceCapAdapterBase
    function getRatio() public view override returns (int256) {
        int256 ratio = int256(IRateProvider(ratioProvider).getRate());

        if (_marketPreceison > 0) {
            (, int256 marketRate, , , ) = marketAggregator.latestRoundData();
            if (marketRate > 0) {
                ratio = (ratio * marketRate) / _marketPreceison;
            }
        }

        return ratio;
    }

    /// @inheritdoc PriceCapAdapterBase
    function ratioDecimals() public view override returns (uint8) {
        return _ratioDecimals;
    }
}

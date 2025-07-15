// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { IWstETH } from "./interfaces/IWstETH.sol";

/**
 * @title WstETHCorrelatedAssetsPriceOracle
 * @author Compound
 */
contract WstETHCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    AggregatorV3Interface public immutable marketAggregator;
    int256 internal immutable _marketPreceison;
    uint8 internal immutable _ratioDecimals;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _wstETH,
        address _marketAggregator,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregator, _wstETH, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {
        marketAggregator = AggregatorV3Interface(_marketAggregator);
        _marketPreceison = int256(_marketAggregator == address(0) ? 0 : 10 ** AggregatorV3Interface(_marketAggregator).decimals());
        _ratioDecimals = 18;
    }

    /// @inheritdoc PriceCapAdapterBase
    function getRatio() public view override returns (int256) {
        int256 stEthPerWstETH = int256(IWstETH(ratioProvider).stEthPerToken());

        if (_marketPreceison > 0) {
            (, int256 stEthToEth, , , ) = marketAggregator.latestRoundData();
            return (stEthPerWstETH * stEthToEth) / _marketPreceison;
        } else {
            return stEthPerWstETH;
        }
    }

    /// @inheritdoc PriceCapAdapterBase
    function ratioDecimals() public view override returns (uint8) {
        return _ratioDecimals;
    }
}

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
    /// @notice Version of the price feed
    uint public constant VERSION = 1;
    uint8 internal immutable _ratioDecimals;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _rateProvider,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        uint8 _rateDecimals,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregator, _rateProvider, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {
        _ratioDecimals = _rateDecimals;
    }

    function getRatio() public view override returns (int256) {
        return int256(IRateProvider(ratioProvider).getRate());
    }

    function ratioDecimals() public view override returns (uint8) {
        return _ratioDecimals;
    }

    /**
     * @notice Version of the price feed contract
     * @return The version of the price feed contract
     **/
    function version() external pure returns (uint256) {
        return VERSION;
    }
}

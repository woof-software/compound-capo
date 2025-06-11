// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { IERC4626 } from "./interfaces/IERC4626.sol";
import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";

/**
 * @title ERC4626CorrelatedAssetsPriceOracle
 * @author Compound
 */
contract ERC4626CorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    /// @notice Version of the price feed
    uint public constant VERSION = 1;

    uint8 internal _ratioDecimals;
    uint8 internal _providerDecimals;

    /**
     * @param _manager address of the manager
     * @param _baseAggregatorAddress address of the base aggregator
     * @param _ratioProviderAddress address of the ratio provider
     * @param _description description of the pair
     * @param _priceFeedDecimals number of decimals for the price feed
     * @param _minimumSnapshotDelay minimum time that should have passed from the snapshot timestamp to the current block.timestamp
     * @param _priceCapSnapshot parameters to set price cap
     */
    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregatorAddress,
        address _ratioProviderAddress,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minimumSnapshotDelay,
        PriceCapSnapshot memory _priceCapSnapshot
    )
        PriceCapAdapterBase(
            _manager,
            _baseAggregatorAddress,
            _ratioProviderAddress,
            _description,
            _priceFeedDecimals,
            _minimumSnapshotDelay,
            _priceCapSnapshot
        )
    {
        _ratioDecimals = IERC4626(IERC4626(ratioProvider).asset()).decimals();
        _providerDecimals = IERC4626(ratioProvider).decimals();
    }

    /**
     * @notice Returns the current exchange ratio of lst to the underlying(base) asset
     */
    function getRatio() public view override returns (int256) {
        return int256(IERC4626(ratioProvider).convertToAssets(10 ** _providerDecimals));
    }

    /// @notice Returns the number of decimals for (lst asset / underlying asset) ratio
    /// @dev The decimals of the underlying asset are used since the ratio is expressed in terms of the underlying asset.
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

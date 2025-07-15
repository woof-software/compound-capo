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
    address public constant STETH_ETH_FEED = 0x86392dC19c0b719886221c78AB11eb8Cf5c52812;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _wstETH,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregator, _wstETH, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {}

    /// @inheritdoc PriceCapAdapterBase
    function getRatio() public view override returns (int256) {
        uint256 stEthPerWstETH = IWstETH(ratioProvider).stEthPerToken();
        (, int256 stEthToEth, , , ) = AggregatorV3Interface(STETH_ETH_FEED).latestRoundData();
        return int256((stEthPerWstETH * uint256(stEthToEth)) / 1e18);
    }

    /// @inheritdoc PriceCapAdapterBase
    function ratioDecimals() public pure override returns (uint8) {
        return 18;
    }
}

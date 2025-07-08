// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.15;

import { AggregatorV3Interface } from "./interfaces/AggregatorV3Interface.sol";
import { PriceCapAdapterBase } from "./utils/PriceCapAdapterBase.sol";
import { IWstETH } from "./interfaces/IWstETH.sol";

contract WstETHCorrelatedAssetsPriceOracle is PriceCapAdapterBase {
    uint256 public constant VERSION = 1;

    constructor(
        address _manager,
        AggregatorV3Interface _baseAggregator,
        address _wstETH,
        string memory _description,
        uint8 _priceFeedDecimals,
        uint48 _minSnapshotDelay,
        PriceCapSnapshot memory _snap
    ) PriceCapAdapterBase(_manager, _baseAggregator, _wstETH, _description, _priceFeedDecimals, _minSnapshotDelay, _snap) {}

    function getRatio() public view override returns (int256) {
        return int256(IWstETH(ratioProvider).tokensPerStEth());
    }

    function ratioDecimals() public pure override returns (uint8) {
        return 18;
    }

    function version() external pure returns (uint256) {
        return VERSION;
    }
}

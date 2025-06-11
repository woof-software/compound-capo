
import { ethers } from 'hardhat';
import { expect } from 'chai';
export type Numeric = number | bigint;

const AddressZero = "0x0000000000000000000000000000000000000000";

export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
  return (BigInt(Math.floor(i * 10 ** Number(r))) * 10n ** BigInt(d)) / 10n ** BigInt(r);
}

export async function makeCAPOPriceFeed({
  priceA,
  priceB,
  decimalsA = 8,
  decimalsB = 8
}: { priceA: Numeric; priceB: Numeric; decimalsA?: Numeric; decimalsB?: Numeric }) {
  const [signer] = await ethers.getSigners();
  const SimplePriceFeedFactory = await ethers.getContractFactory(
    'SimplePriceFeed'
  );

  const SimpleERC4626RatePriceFeed = await ethers.getContractFactory(
    'SimpleERC4626RatePriceFeed'
  );

  const MockERC20 = await ethers.getContractFactory(
    'MockERC20'
  );

  const assetA = await MockERC20.deploy('Asset A', 'ASSET_A', decimalsB);
  await assetA.waitForDeployment();
  const PriceFeedA = await SimplePriceFeedFactory.deploy(priceA, decimalsA);
  const PriceFeedB = await SimpleERC4626RatePriceFeed.deploy(priceB, decimalsB, await assetA.getAddress());

  await PriceFeedA.waitForDeployment();
  await PriceFeedB.waitForDeployment();

  const ERC4626CorrelatedAssetsPriceOracleFactory = await ethers.getContractFactory(
    'ERC4626CorrelatedAssetsPriceOracle'
  );

  const currentTimestamp = await ethers.provider.getBlock('latest').then(b => {
    if (!b) throw new Error('Block not found');
    return b.timestamp;
  });

  const CapoPriceFeed = await ERC4626CorrelatedAssetsPriceOracleFactory.deploy(
    signer.address,
    await PriceFeedA.getAddress(),
    await PriceFeedB.getAddress(),
    'CAPO Price Feed',
    8,
    3600,
    {
      snapshotRatio: priceB,
      snapshotTimestamp: currentTimestamp - 3600,
      maxYearlyRatioGrowthPercent: exp(0.01, 4)
    }
  );

  return {
    PriceFeedA,
    PriceFeedB,
    CapoPriceFeed
  };
}

const testCases = [
  {
    priceA: exp(1, 8),
    priceB: exp(30_000, 8),
    result: exp(30_000, 8)
  },
  {
    priceA: exp(2.123456, 8),
    priceB: exp(31_333.123, 8),
    result: 6653450803308n
  },
  {
    priceA: exp(100, 8),
    priceB: exp(30_000, 8),
    result: exp(3_000_000, 8)
  },
  {
    priceA: exp(0.9999, 8),
    priceB: exp(30_000, 8),
    result: exp(29_997, 8)
  },
  {
    priceA: exp(0.987937, 8),
    priceB: exp(31_947.71623, 8),
    result: 3156233092911n
  },
  {
    priceA: exp(0.5, 8),
    priceB: exp(30_000, 8),
    result: exp(15_000, 8)
  },
  {
    priceA: exp(0.00555, 8),
    priceB: exp(30_000, 8),
    result: exp(166.5, 8)
  },
  {
    priceA: exp(0, 8),
    priceB: exp(30_000, 8),
    result: exp(0, 8)
  },
  {
    priceA: exp(1, 18),
    priceB: exp(1800, 8),
    decimalsA: 18,
    decimalsB: 8,
    result: exp(1800, 8)
  },
  {
    priceA: exp(1.25, 18),
    priceB: exp(1800, 8),
    decimalsA: 18,
    decimalsB: 8,
    result: exp(2250, 8)
  },
  {
    priceA: exp(0.72, 18),
    priceB: exp(1800, 8),
    decimalsA: 18,
    decimalsB: 8,
    result: exp(1296, 8)
  }
];

describe('CAPO price feed', function() {
  it('reverts if constructed with bad manager address', async () => {
    const SimplePriceFeedFactory = await ethers.getContractFactory(
      'SimplePriceFeed'
    );

    const MockERC20 = await ethers.getContractFactory(
        'MockERC20'
    );

  const assetA = await MockERC20.deploy('Asset A', 'ASSET_A', 8);
  await assetA.waitForDeployment();
    const SimpleERC4626RatePriceFeed = await ethers.getContractFactory(
      'SimpleERC4626RatePriceFeed'
    );

    const PriceFeedA = await SimplePriceFeedFactory.deploy(exp(1, 8), 8);

    const PriceFeedB = await SimpleERC4626RatePriceFeed.deploy(exp(30_000), 8, await assetA.getAddress());

    const ERC4626CorrelatedAssetsPriceOracle = await ethers.getContractFactory(
      'ERC4626CorrelatedAssetsPriceOracle'
    );

    await expect(
      ERC4626CorrelatedAssetsPriceOracle.deploy(
        AddressZero,
        await PriceFeedA.getAddress(),
        await PriceFeedB.getAddress(),
        'CAPO Price Feed',
        8,
        0,
        {
          snapshotRatio: 0,
          snapshotTimestamp: 1,
          maxYearlyRatioGrowthPercent: 0
        }
      )).to.be.revertedWithCustomError(ERC4626CorrelatedAssetsPriceOracle, 'ManagerIsZeroAddress()');
  });

  it('reverts if constructed with bad price feed', async () => {
    const [signer] = await ethers.getSigners();
    const SimplePriceFeedFactory = await ethers.getContractFactory(
      'SimplePriceFeed'
    );

    const MockERC20 = await ethers.getContractFactory(
      'MockERC20'
    );
    const assetA = await MockERC20.deploy('Asset A', 'ASSET_A', 8);
    await assetA.waitForDeployment();

    const SimpleERC4626RatePriceFeed = await ethers.getContractFactory(
      'SimpleERC4626RatePriceFeed'
    );

    const PriceFeedA = await SimplePriceFeedFactory.deploy(exp(1, 8), 8);
    await PriceFeedA.waitForDeployment();

    const PriceFeedB = await SimpleERC4626RatePriceFeed.deploy(exp(30_000), 8, await assetA.getAddress());
    await PriceFeedB.waitForDeployment();

    const ERC4626CorrelatedAssetsPriceOracle = await ethers.getContractFactory(
      'ERC4626CorrelatedAssetsPriceOracle'
    );

    await expect(
      ERC4626CorrelatedAssetsPriceOracle.deploy(
        signer.address,
        AddressZero,
        await PriceFeedB.getAddress(),
        'CAPO Price Feed',
        8,
        0,
        {
          snapshotRatio: 0,
          snapshotTimestamp: 1,
          maxYearlyRatioGrowthPercent: 0
        }
      )).to.be.revertedWithCustomError(ERC4626CorrelatedAssetsPriceOracle, 'InvalidAddress()');
    await expect(
      ERC4626CorrelatedAssetsPriceOracle.deploy(
        signer.address,
        await PriceFeedA.getAddress(),
        AddressZero,
        'CAPO Price Feed',
        8,
        0,
        {
          snapshotRatio: 0,
          snapshotTimestamp: 1,
          maxYearlyRatioGrowthPercent: 0
        }
      )).to.be.revertedWithCustomError(ERC4626CorrelatedAssetsPriceOracle, 'InvalidAddress()');
  });

  it('reverts if set cap parameters not by manager', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });

    const [,signer] = await ethers.getSigners();

    await expect(CapoPriceFeed.connect(signer).updateSnapshot({
      snapshotRatio: 0,
      snapshotTimestamp: 0,
      maxYearlyRatioGrowthPercent: 0
    })).to.be.revertedWithCustomError(CapoPriceFeed, 'OnlyManager');
  });

  describe('latestRoundData', function() {
    for (const { priceA, priceB, decimalsA, decimalsB, result } of testCases) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      it(`priceA (${priceA}) with ${decimalsA ?? 8} decimals, priceB (${priceB}) with ${decimalsB ?? 8} decimals -> ${result}`, async () => {
        const { CapoPriceFeed } = await makeCAPOPriceFeed({ priceA, priceB, decimalsA, decimalsB });
        const latestRoundData = await CapoPriceFeed.latestRoundData();
        const price = latestRoundData[1];

        expect(price).to.eq(result);
      });
    }

    it('returns same result even if underlying and ration decimals are different', async () => {
        const [signer] = await ethers.getSigners();
        const SimplePriceFeedFactory = await ethers.getContractFactory(
            'SimplePriceFeed'
        );

        const SimpleERC4626RatePriceFeed = await ethers.getContractFactory(
            'SimpleERC4626RatePriceFeed'
        );

        const MockERC20 = await ethers.getContractFactory(
            'MockERC20'
        );

        const assetA = await MockERC20.deploy('Asset A', 'ASSET_A', 8);
        await assetA.waitForDeployment();
        const PriceFeedA = await SimplePriceFeedFactory.deploy(exp(30, 18), 18);
        const PriceFeedB = await SimpleERC4626RatePriceFeed.deploy(exp(1.115, 8), 18, await assetA.getAddress());

        await PriceFeedA.waitForDeployment();
        await PriceFeedB.waitForDeployment();

        const ERC4626CorrelatedAssetsPriceOracleFactory = await ethers.getContractFactory(
            'ERC4626CorrelatedAssetsPriceOracle'
        );

        const currentTimestamp = await ethers.provider.getBlock('latest').then(b => {
            if (!b) throw new Error('Block not found');
            return b.timestamp;
        });

        const CapoPriceFeed = await ERC4626CorrelatedAssetsPriceOracleFactory.deploy(
            signer.address,
            await PriceFeedA.getAddress(),
            await PriceFeedB.getAddress(),
            'CAPO Price Feed',
            8,
            3600,
            {
                snapshotRatio: exp(1.115, 18),
                snapshotTimestamp: currentTimestamp - 3600,
                maxYearlyRatioGrowthPercent: exp(0.01, 4)
            }
        );

        const latestRoundData = await CapoPriceFeed.latestRoundData();
        const price1 = latestRoundData[1];


        const assetA2 = await MockERC20.deploy('Asset A', 'ASSET_A', 18);
        await assetA2.waitForDeployment();
        const PriceFeedA2 = await SimplePriceFeedFactory.deploy(exp(30, 18), 18);
        const PriceFeedB2 = await SimpleERC4626RatePriceFeed.deploy(exp(1.115, 18), 18, await assetA2.getAddress());

        await PriceFeedA2.waitForDeployment();
        await PriceFeedB2.waitForDeployment();

        const currentTimestamp2 = await ethers.provider.getBlock('latest').then(b => {
            if (!b) throw new Error('Block not found');
            return b.timestamp;
        });

        const CapoPriceFeed2 = await ERC4626CorrelatedAssetsPriceOracleFactory.deploy(
            signer.address,
            await PriceFeedA2.getAddress(),
            await PriceFeedB2.getAddress(),
            'CAPO Price Feed',
            8,
            3600,
            {
                snapshotRatio: exp(1.115, 18),
                snapshotTimestamp: currentTimestamp2 - 3600,
                maxYearlyRatioGrowthPercent: exp(0.01, 4)
            }
        );

        const latestRoundData2 = await CapoPriceFeed2.latestRoundData();
        const price2 = latestRoundData2[1];

        expect(price1).to.eq(price2);
    });

    it('if current rate > last snapshot * max yearly growth rate, then price is capped and rate == max rate', async () => {
      const { CapoPriceFeed, PriceFeedB } = await makeCAPOPriceFeed({
        priceA: exp(1, 18),
        decimalsA: 18,
        priceB: exp(30_000, 18),
        decimalsB: 18
      });

      await PriceFeedB.setRoundData(
        exp(35_000, 18), // answer_
      );

      const latestRoundData = await CapoPriceFeed.latestRoundData();
      //300000342656012.176546580000000000
      const price = latestRoundData[1];

      expect(await CapoPriceFeed.isCapped()).to.be.true;
      const maxRatePerSecond = exp(30_000, 18) * exp(0.01, 4) / 31536000n / exp(1, 4);

      expect(price).to.eq((exp(30_000, 18) + maxRatePerSecond * 3602n) / exp(1, 10));
    });

    it('passes along roundId, startedAt, updatedAt and answeredInRound values from price feed A', async () => {
      const { PriceFeedA, CapoPriceFeed } = await makeCAPOPriceFeed({
        priceA: exp(1, 18),
        decimalsA: 18,
        priceB: exp(30_000, 18),
        decimalsB: 18
      });

      await PriceFeedA.setRoundData(
        exp(15, 18), // roundId_,
        1,           // answer_,
        exp(16, 8),  // startedAt_,
        exp(17, 8),  // updatedAt_,
        exp(18, 18)  // answeredInRound_
      );

      const roundData = await CapoPriceFeed.latestRoundData();

      expect(roundData[0]).to.eq(exp(15, 18));
      expect(roundData[2]).to.eq(exp(16, 8));
      expect(roundData[3]).to.eq(exp(17, 8));
      expect(roundData[4]).to.eq(exp(18, 18));
    });
  });

  it('reverts if snapshot timestamp is invalid', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });

    await expect(CapoPriceFeed.updateSnapshot({
      snapshotRatio: 1,
      snapshotTimestamp: 0,
      maxYearlyRatioGrowthPercent: 0
    })).to.be.revertedWithCustomError(CapoPriceFeed, 'InvalidRatioTimestamp').withArgs(0);
  });

  // it('reverts if snapshot is updated too soon from non-manager', async () => {
  //   const { CapoPriceFeed } = await makeCAPOPriceFeed({
  //     priceA: exp(1, 18),
  //     priceB: exp(30_000, 18)
  //   });

  //   const currentTimestamp = await ethers.provider.getBlock('latest').then(b => b.timestamp);
  //   await expect(CapoPriceFeed.updateSnapshot({
  //     snapshotRatio: 1,
  //     snapshotTimestamp: currentTimestamp,
  //     maxYearlyRatioGrowthPercent: 0
  //   })).to.be.revertedWithCustomError(CapoPriceFeed, 'InvalidRatioTimestamp').withArgs(currentTimestamp);
  // });

  it('reverts if new snapshot ratio is 0', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });

    const currentTimestamp = await ethers.provider.getBlock('latest').then(b =>{
        if (!b) throw new Error('Block not found');
        return b.timestamp
    });

    // advance time
    await ethers.provider.send('evm_increaseTime', [3600]);

    await expect(CapoPriceFeed.updateSnapshot({
      snapshotRatio: 0,
      snapshotTimestamp: currentTimestamp,
      maxYearlyRatioGrowthPercent: 0
    })).to.be.revertedWithCustomError(CapoPriceFeed, 'SnapshotRatioIsZero');
  });

  it('reverts if new snapshot ratio will overflow in 3 years', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });

    const currentTimestamp = await ethers.provider.getBlock('latest').then(b =>{
        if (!b) throw new Error('Block not found');
        return b.timestamp
    });

    // advance time
    await ethers.provider.send('evm_increaseTime', [3600]);

    await expect(CapoPriceFeed.updateSnapshot({
      snapshotRatio: exp(30_000, 35),
      snapshotTimestamp: currentTimestamp,
      maxYearlyRatioGrowthPercent: exp(10000, 2)
    })).to.be.revertedWithCustomError(CapoPriceFeed, 'SnapshotCloseToOverflow');
  });

  it('reverts if non-manager tries to set new manager', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });
    const [, newManager] = await ethers.getSigners();

    await expect(CapoPriceFeed.connect(newManager).setManager(newManager.address)).to.be.revertedWithCustomError(CapoPriceFeed, 'OnlyManager');
  });

  it('getters return correct values', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });
    const [signer] = await ethers.getSigners();

    expect(await CapoPriceFeed.description()).to.eq('CAPO Price Feed');
    expect(await CapoPriceFeed.version()).to.eq(1);
    expect(await CapoPriceFeed.decimals()).to.eq(8);
    expect(await CapoPriceFeed.manager()).to.eq(signer.address);
    expect(await CapoPriceFeed.snapshotRatio()).to.eq(exp(30_000, 18));
    expect(await CapoPriceFeed.maxYearlyRatioGrowthPercent()).to.eq(exp(0.01, 4));
    const rate = (await CapoPriceFeed.GROWTH_RATIO_SCALE());
    expect(await CapoPriceFeed.maxRatioGrowthPerSecond()).to.eq(exp(30_000, 18) * exp(0.01, 4) * rate / 31536000n / exp(1, 4));
    expect(await CapoPriceFeed.getRatio()).to.eq(exp(30_000, 18));
    expect(await CapoPriceFeed.isCapped()).to.be.false;
  });

  it('set cap parameters', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });

    const currentTimestamp = await ethers.provider.getBlock('latest').then(b =>{
        if (!b) throw new Error('Block not found');
        return b.timestamp
    });

    // advance time
    await ethers.provider.send('evm_increaseTime', [3600]);

    await CapoPriceFeed.updateSnapshot({
      snapshotRatio: exp(30_100, 18),
      snapshotTimestamp: currentTimestamp,
      maxYearlyRatioGrowthPercent: 100
    });

    expect(await CapoPriceFeed.getRatio()).to.eq(exp(30_000, 18));
    expect(await CapoPriceFeed.snapshotRatio()).to.eq(exp(30_100, 18));
    expect(await CapoPriceFeed.snapshotTimestamp()).to.eq(currentTimestamp);
    expect(await CapoPriceFeed.maxYearlyRatioGrowthPercent()).to.eq(exp(0.01, 4));
    const rate = (await CapoPriceFeed.GROWTH_RATIO_SCALE());
    expect(await CapoPriceFeed.maxRatioGrowthPerSecond()).to.eq(exp(30_100, 18) * exp(0.01, 4) * rate / 31536000n / exp(1, 4));
  });

  it('set new manager', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });
    const [signer, newManager] = await ethers.getSigners();

    await CapoPriceFeed.connect(signer).setManager(newManager.address);

    expect(await CapoPriceFeed.manager()).to.eq(newManager.address);
  });

  it('reverts if set new manager to zero address', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });
    const [signer] = await ethers.getSigners();

    await expect(CapoPriceFeed.connect(signer).setManager(AddressZero)).to.be.revertedWithCustomError(CapoPriceFeed, 'ManagerIsZeroAddress()');
  });

  it('set new snapshot delay', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });

    await CapoPriceFeed.setMinimumSnapshotDelay(7200);

    expect(await CapoPriceFeed.minimumSnapshotDelay()).to.eq(7200);
  });

  it('reverts if set new snapshot delay by non-manager', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });
    const [, newManager] = await ethers.getSigners();

    await expect(CapoPriceFeed.connect(newManager).setMinimumSnapshotDelay(7200)).to.be.revertedWithCustomError(CapoPriceFeed, 'OnlyManager');
  });

  it('reverts if set new snapshot delay by non-manager', async () => {
    const { CapoPriceFeed } = await makeCAPOPriceFeed({
      priceA: exp(1, 18),
      priceB: exp(30_000, 18)
    });
    const [, newManager] = await ethers.getSigners();

    await expect(CapoPriceFeed.connect(newManager).setMinimumSnapshotDelay(7200)).to.be.revertedWithCustomError(CapoPriceFeed, 'OnlyManager');
  });
});

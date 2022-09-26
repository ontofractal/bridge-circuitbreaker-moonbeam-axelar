import { expect } from "chai";
import { ethers } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";

import { main as startLocal } from "../scripts/local-network";
import { deployUnderlyingBridged } from "../scripts/deploy-crosschain";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const {
  getDefaultProvider,
  constants: { AddressZero },
  utils: { defaultAbiCoder },
} = require("ethers");
const { deployUpgradable } = require("@axelar-network/axelar-gmp-sdk-solidity");

const ExampleProxy = require("../artifacts/contracts/ExampleProxy.sol/ExampleProxy.json");
const ERC20CrossChain = require("../artifacts/contracts/ERC20CrossChain.sol/ERC20CrossChain.json");

const name = "BRI-FRAC-TOKEN";
const symbol = "BFT";
const decimals = 13;

import { isTestnet, wallet } from "../config/constants";
// import assert from chai
import { assert } from "chai";
import { parseEther } from "ethers/lib/utils";
import {
  extendedChainData,
  findChain,
  localChains,
  testnetChains,
} from "../utils/chains";
import { relay } from "@axelar-network/axelar-local-dev";
import { defaultTxParams } from "../utils";

// load contracts
let chains = isTestnet ? testnetChains : localChains;
let initialAmount = parseEther("1000");
console.log(chains);

describe("Wrapped crosschain token", async () => {
  let deployer: any;
  let underlyingNativeChain: extendedChainData;

  before(async () => {
    deployer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    await startLocal();
    underlyingNativeChain = findChain(chains, "Ethereum");

    for (const chain of chains) {
      const provider = getDefaultProvider(chain.rpc);
      chain.wallet = wallet.connect(provider);

      chain.underlying = await deployUnderlyingBridged(chain);
      const constructorParams = [
        chain.gateway,
        chain.gasReceiver,
        decimals,
        chain.underlying.address,
        underlyingNativeChain.name,
      ];

      chain.contract = await deployUpgradable(
        chain.constAddressDeployer,
        chain.wallet,
        ERC20CrossChain,
        ExampleProxy,
        constructorParams,
        [],
        defaultAbiCoder.encode(["string", "string"], [name, symbol]),
        "cross-chain-token",
      );

      console.log(`Deployed on ${chain.name} chain:`, chain.contract.address);
    }
  });

  it("mints from underlying", async () => {
    const source = findChain(chains, "Moonbeam");
    let totalSupply = await source.underlying.totalSupply();
    let balance = await source.underlying.balanceOf(deployer);
    console.log(balance);
    expect(totalSupply).to.equal(initialAmount);
    expect(balance).to.equal(initialAmount);

    const underlyingAmount = parseEther("1");
    await source.underlying.approve(source.contract.address, underlyingAmount);
    await source.contract.depositFor(deployer, underlyingAmount);

    balance = await source.contract.balanceOf(deployer);
    expect(balance).to.equal(underlyingAmount);
  });

  it.only("does underlying accounting", async () => {
    const moonbeam = findChain(chains, "Moonbeam");
    const avax = findChain(chains, "Avalanche");
    const eth = findChain(chains, "Ethereum");

    await moonbeam.contract.updateBridgedAssetAccounting({
      value: BigInt(Math.floor(3e5 * 100)),
    });
    await avax.contract.updateBridgedAssetAccounting({
      value: BigInt(Math.floor(3e5 * 100)),
    });
    await sleep(500);
    expect(
      await underlyingNativeChain.contract.getBridgedUnderlyingBalance(),
    ).to.equal(parseEther("1000"));

    await eth.underlying.burn(parseEther("1000"));
    await eth.contract.triggerBridgeAssetDiscrepancy(defaultTxParams);
    await sleep(1000);
    expect(await eth.contract.bridgeAssetDiscrepancy()).to.be.true;
    expect(await moonbeam.contract.bridgeAssetDiscrepancy()).to.be.true;
    expect(await avax.contract.bridgeAssetDiscrepancy()).to.be.true;
  });

  it("triggers offloading of toxic assets", async () => {
    const moon = findChain(chains, "Moonbeam");
    const avax = findChain(chains, "Avalanche");

    // moon.updateBridgedAssetAccounting

    await sleep(100);
    // assert to be equal using chai
    expect(
      (await destination.contract.balanceOf(wallet.address)).toNumber(),
    ).to.equal(500);
  });

  it("checks balances", async () => {
    const source = findChain(chains, "Moonbeam");
    const destination = findChain(chains, "Avalanche");
    await source.contract.giveMe(10000);

    await (
      await source.contract.transferRemote("Avalanche", wallet.address, 500, {
        value: BigInt(Math.floor(3e5 * 100)),
      })
    ).wait();

    await sleep(100);
    // assert to be equal using chai
    expect(
      (await destination.contract.balanceOf(wallet.address)).toNumber(),
    ).to.equal(500);
  });
});

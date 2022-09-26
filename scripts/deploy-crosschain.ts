import { ethers } from "hardhat";
const {
  getDefaultProvider,
  constants: { AddressZero },
  utils: { defaultAbiCoder },
} = require("ethers");
const { deployUpgradable } = require("@axelar-network/axelar-gmp-sdk-solidity");

import { isTestnet, wallet } from "../config/constants";
import { BigNumber, Signer, Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ERC20Bridged } from "../typechain-types";
import {
  extendedChainData,
  findChain,
  localChains,
  testnetChains,
} from "../utils/chains";
import _ from "lodash";
import { writeFileSync } from "fs";
import { defaultTxParams } from "../utils";

const ExampleProxy = require("../artifacts/contracts/ExampleProxy.sol/ExampleProxy.json");
const ERC20CrossChain = require("../artifacts/contracts/ERC20CrossChain.sol/ERC20CrossChain.json");

const name = "BRI-FRAC-TOKEN";
const symbol = "BFT";
const decimals = 13;

const {
  utils: { deployContract },
} = require("@axelar-network/axelar-local-dev");

// load contracts

let chains = isTestnet ? testnetChains : localChains;

const underlyingNativeChain = findChain(chains, "Ethereum");

const chainDataExported: any = [];

async function main() {
  await logAndSleep("Starting simulation scenario run...");
  for (const chain of chains) {
    const provider = getDefaultProvider(chain.rpc);
    chain.wallet = wallet.connect(provider);
    chain.underlying = await deployUnderlyingBridged(chain);
    chain.contract = await deployCrosschain(
      chain,
      chain.underlying,
      underlyingNativeChain,
    );
    chain.contractAddress = chain.contract.address;
    chain.underlyingAddress = chain.underlying.address;
    await logAndSleep(
      `Deployed crosschain-bridge backed asset on ${chain.name} chain:`,
      chain.contract.address,
    );
    // JSON stringify remove all functions and non-data fields
    chainDataExported.push(
      _.pick(chain, ["name", "contractAddress", "underlyingAddress", "rpc"]),
    );
    writeFileSync(
      "../bridgebreaker/priv/chain_data.json",
      JSON.stringify(chainDataExported),
      "utf8",
    );
  }

  const avax = findChain(chains, "Avalanche");
  const beam = findChain(chains, "Moonbeam");
  const polygon = findChain(chains, "Polygon");
  const fantom = findChain(chains, "Fantom");

  await logAndSleep(
    "Updatintg bridged asset accounting by sending messages from chains with bridged tokens to Ethereum..",
  );
  await beam.contract.updateBridgedAssetAccounting(defaultTxParams);
  await avax.contract.updateBridgedAssetAccounting(defaultTxParams);
  await polygon.contract.updateBridgedAssetAccounting(defaultTxParams);
  await fantom.contract.updateBridgedAssetAccounting(defaultTxParams);

  await logAndSleep("User deposits 100 USD.B on Fantom to crosschain contract");
  await depositUnderlying(fantom, parseEther("100"));
  await logAndSleep("User transfers wrapped 100 USD.B to Moonbeam via Axelar");

  await fantom.contract.transferRemote(
    "Moonbeam",
    fantom.wallet.address,
    parseEther("100"),
    defaultTxParams,
  );

  await logAndSleep(
    "User deposits 500 USD.B on Avalanche to crosschain contract",
  );
  await depositUnderlying(avax, parseEther("500"));

  await logAndSleep("User transfers wrapped 500 USD.B to Moonbeam via Axelar");

  await avax.contract.transferRemote(
    "Moonbeam",
    avax.wallet.address,
    parseEther("500"),
    defaultTxParams,
  );

  await logAndSleep(
    "User deposits 300 USD.B on Polygon to crosschain contract",
  );
  await depositUnderlying(polygon, parseEther("300"));

  await logAndSleep("User transfers wrapped 300 USD.B to Moonbeam via Axelar");

  await polygon.contract.transferRemote(
    "Moonbeam",
    polygon.wallet.address,
    parseEther("300"),
    defaultTxParams,
  );

  await logAndSleep(
    "Simulating hack of Eth bridge smart contract, 3000 USD.B exploited!",
  );
  await underlyingNativeChain.underlying.burn(parseEther("3000"));
  await logAndSleep(
    "Bridgebreaker operators triggering emergency offloading of toxic assets",
  );

  await underlyingNativeChain.contract.triggerBridgeAssetDiscrepancy(
    defaultTxParams,
  );
}

export async function deployCrosschain(
  chain: extendedChainData,
  underlying: ERC20Bridged,
  underlyingChain: extendedChainData,
) {
  const contract = await deployUpgradable(
    chain.constAddressDeployer,
    chain.wallet,
    ERC20CrossChain,
    ExampleProxy,
    [
      chain.gateway,
      chain.gasReceiver,
      decimals,
      underlying.address,
      underlyingChain.name,
    ],
    [],
    defaultAbiCoder.encode(["string", "string"], [name, symbol]),
    "cross-chain-token",
  );
  return contract;
}

async function logAndSleep(...args: any) {
  console.log(...args);
  await sleep(5000);
}
function sleep(ms: any) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // @ts-ignore
      resolve();
    }, ms);
  });
}

export async function deployUnderlyingBridged(chain: extendedChainData) {
  // console.log("Deploying contracts with the account:", deployer.address);

  // console.log("Account balance:", (await deployer.getBalance()).toString());

  const Token = await ethers.getContractFactory("ERC20Bridged", chain.wallet);
  const token = (await Token.deploy("USD.BRIDGED", "USD.B")) as ERC20Bridged;
  if (chain.name == "Ethereum") {
    await token.mint(chain.wallet.address, parseEther("3000"));
  } else if (chain.name == "Moonbeam") {
  } else {
    await token.mint(chain.wallet.address, parseEther("1000"));
  }
  return token;
}

export async function depositUnderlying(
  chain: extendedChainData,
  amount: BigNumber,
) {
  let totalSupply = await chain.underlying.totalSupply();
  let balance = await chain.underlying.balanceOf(chain.wallet.address);

  await chain.underlying.approve(chain.contract.address, amount);
  await chain.contract.depositFor(chain.wallet.address, amount);

  balance = await chain.contract.balanceOf(chain.wallet.address);
  // console.log("balance", balance.toString());
}

main();

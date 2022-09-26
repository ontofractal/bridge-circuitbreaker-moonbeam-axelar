import { Contract, ethers, getDefaultProvider, providers } from "ethers";
import {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
} from "@axelar-network/axelarjs-sdk";

import AxelarGatewayContract from "../artifacts/@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol/IAxelarGateway.json";
import IERC20 from "../artifacts/@axelar-network/axelar-cgp-solidity/contracts/interfaces/IERC20.sol/IERC20.json";
import { isTestnet, wallet } from "../config/constants";

let chains = isTestnet
  ? require("../config/testnet.json")
  : require("../config/local.json");

// const moonbeamChain = chains.find(
//   (chain: any) => chain.name === "Moonbeam",
// ) as any;
// const avalancheChain = chains.find(
//   (chain: any) => chain.name === "Avalanche",
// ) as any;

// if (!moonbeamChain || !avalancheChain) process.exit(0);

// const useMetamask = false; // typeof window === 'object';

// const moonbeamProvider = useMetamask
//   ? new providers.Web3Provider((window as any).ethereum)
//   : getDefaultProvider(moonbeamChain.rpc);
// const moonbeamConnectedWallet = useMetamask
//   ? (moonbeamProvider as providers.Web3Provider).getSigner()
//   : wallet.connect(moonbeamProvider);
// const avalancheProvider = getDefaultProvider(avalancheChain.rpc);
// const avalancheConnectedWallet = wallet.connect(avalancheProvider);

// const srcGatewayContract = new Contract(
//   avalancheChain.gateway,
//   AxelarGatewayContract.abi,
//   avalancheConnectedWallet,
// );

// const destGatewayContract = new Contract(
//   moonbeamChain.gateway,
//   AxelarGatewayContract.abi,
//   moonbeamConnectedWallet,
// );

const tokenAddress = "0xDB2b9B63D7eA518fA59DAe4CB9Ca2943a4aBB8a9";
export async function getBridgedBalances(address: string) {
  let erc20s = [];
  for (const chain of chains) {
    const provider = getDefaultProvider(chain.rpc);
    chain.wallet = wallet.connect(provider);
    const erc20 = new Contract(tokenAddress, IERC20.abi, chain.wallet);
    erc20s.push(erc20);
  }

  const balances = await Promise.all(
    erc20s.map(async (erc20) => {
      const balance = await erc20.balanceOf(address);
      return ethers.utils.formatUnits(balance, 6);
    }),
  );
  return balances;
}

export const defaultTxParams = {
  value: BigInt(Math.floor(3e5 * 100)),
};

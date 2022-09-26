import testnetChainsRaw from "../config/testnet.json";
import localChainsRaw from "../config/local.json";
import { BigNumber, Wallet } from "ethers";
import { ERC20Bridged, ERC20CrossChain } from "../typechain-types";

type jsonChainData = typeof localChainsRaw[0];

export type extendedChainData = jsonChainData & {
  wallet: Wallet;
  contract: ERC20CrossChain;
  contractAddress: string;
  underlying: ERC20Bridged;
  underlyingAddress: string;
};
export const localChains = localChainsRaw as extendedChainData[];
export const testnetChains = testnetChainsRaw as unknown as extendedChainData[];

export const findChain = (
  chains: extendedChainData[],
  name: string,
): extendedChainData => {
  const chain = chains.find((chain: any) => chain.name === name);
  if (!chain) {
    throw new Error(`Chain ${name} not found`);
  }
  return chain;
};

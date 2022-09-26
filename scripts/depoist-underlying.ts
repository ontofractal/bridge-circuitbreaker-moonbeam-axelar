import { depositUnderlying } from "./deploy-crosschain";
import {
  extendedChainData,
  findChain,
  localChains,
  testnetChains,
} from "../utils/chains";

depositUnderlying(findChain(localChains, "Avalanche"));
depositUnderlying(findChain(localChains, "Moonbeam"));

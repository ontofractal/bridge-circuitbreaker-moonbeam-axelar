import { createAndExport, relay } from "@axelar-network/axelar-local-dev";
import { Network } from "@axelar-network/axelar-local-dev/dist/Network";
import { wallet } from "../config/constants";
import _ from "lodash";

// deploy network
export const main = async () => {
  await createAndExport({
    accountsToFund: [wallet.address],
    chains: ["Moonbeam", "Avalanche", "Ethereum", "Fantom", "Polygon"],
    chainOutputPath: "config/local.json",
    relayInterval: 100,
    async callback(network: Network) {
      // await network.deployToken("USDC", "aUSDC", 6, BigInt(100_000_000e6));
      // if (network.name === "Avalanche") {
      //   await network.giveToken(wallet.address, "aUSDC", BigInt("1000000000000"));
      // }
    },
    async afterRelay(relayData) {
      // not empty
      if (!_.isEmpty(relayData.callContract)) {
        console.log("Transaction realyed by Axelar");
      }
    },
  });
};

// require("hardhat-gas-reporter");
// require("solidity-coverage");
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
import "@nomiclabs/hardhat-ethers";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      evmVersion: process.env.EVM_VERSION || "london",
      optimizer: {
        enabled: false,
        runs: 1000,
        details: {
          peephole: true,
          inliner: true,
          jumpdestRemover: true,
          orderLiterals: true,
          deduplicate: true,
          cse: true,
          constantOptimizer: true,
          yul: true,
          yulDetails: {
            stackAllocation: true,
          },
        },
      },
    },
  },
  paths: {
    sources: "./contracts",
  },
};

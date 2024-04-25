require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
// require("@openzeppelin/contracts");
require("hardhat-deploy");
require("dotenv").config();
require("./tasks");
require("hardhat-deploy-ethers")
require("fs")
// require("hardhat");
// require('@nomiclabs/hardhat-waffle');
// const PRIVATE_KEY = `${process.env.PRIVATE_KEY}`
const PRIVATE_KEY1 = process.env.PRIVATE_KEY1
const PRIVATE_KEY2 = process.env.PRIVATE_KEY2

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: 'Calibration',
  networks: {
    hardhat: {
      // accounts: []
      saveDeployments: true,
      blockGasLimit: 400000000,
    },
    Calibration: {
      chainId: 314159,
      url: "https://api.calibration.node.glif.io/rpc/v1",
      accounts: [PRIVATE_KEY1, PRIVATE_KEY2],
      allowUnlimitedContractSize: true,
      blockGasLimit: 4000000000,
      saveDeployments: true
    }
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }

  },
  namedAccounts: {
    deployer: {
      default: 0,
      314159: 1
    }
  },

  // paths: {
  //   sources: "./contracts",
  //   tests: "./test",
  //   cache: "./cache",
  //   artifacts: "./artifacts",
  // },
};

// module.exports = {
//   solidity: "0.8.17",
//   defaultNetwork: "hyperspace",
//   networks: {
//     hyperspace: {
//       chainId: 3141,
//       url: "https://api.hyperspace.node.glif.io/rpc/v1",
//       accounts: [PRIVATE_KEY1, PRIVATE_KEY2]
//     },
//   },
//   paths: {
//     sources: "./contracts",
//     tests: "./test",
//     cache: "./cache",
//     artifacts: "./artifacts",
//   },
// }
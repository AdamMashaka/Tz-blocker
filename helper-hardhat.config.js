const networkConfig = {
    31337: {
        name: "hardhat",
        minValue: 1000000,
        prizendex: 1,
        supportAmount: 10000000,
        min_delay: 1,
        voting_delay: 1,
        voting_period: 5,
        quorum_percentage: 4,
        description: "Help for earthquake"

    },
    314159: {
        name: "Calibration",
        minValue: 1000000,
        prizendex: 1,
        aidToken: "",
        supportAmount: 10000000,
        min_delay: 1,
        voting_delay: 1,
        voting_period: 5,
        quorum_percentage: 4,
        description: "Help for famine in Tz"
    }
}

const DEVELOPMENT_NETWORKS = ["hardhat", "local-host"]
const proposal_file = "proposal.json"
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000"
const address_file = "addresses.json"

module.exports = {
    networkConfig,
    DEVELOPMENT_NETWORKS,
    proposal_file,
    ADDRESS_ZERO,
    address_file
}
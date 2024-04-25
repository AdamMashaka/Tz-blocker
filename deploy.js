// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const fs = require("fs");
const { ethers, network } = require("hardhat");
const hre = require("hardhat");
// require("fs");
const { networkConfig, proposal_file, ADDRESS_ZERO, address_file } = require("../helper-hardhat.config");
const { move_blocks } = require("../utils/move_blocks");
const { existsSync } = require("node:fs");
const { move_time } = require("../utils/move_time");


const DEVELOPMENT_NETWORKS = ["hardhat", "local-host"]
const minValue = 1000000
const supportAmount = 10000
const prizeIndex = 1
const voting_delay = 1
const voting_period = 5
const description = "Help famine in Africa"
const min_delay = 1

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy, log } = deployments
  const chainId = network.config.chainId
  log("-----------------------------")
  if (DEVELOPMENT_NETWORKS.includes(network.name)) {
    args1 = ["AidFlow", "AF"]
    af_token = await deploy("GovernanceToken", { from: deployer, log: true, args: args1 })
    log("AidFlow token deployed to by", deployer)
    log("-------------------------------")

    log("Deploying timeLock")
    args2 = [networkConfig[chainId]["min_delay"], [], [], deployer]
    timelock = await deploy("TimelockContract", { from: deployer, log: true, args: args2 })
    log("Timelock deployed to by", deployer)
    log("-------------------------------")

    log("Deploying Governance contract")
    args3 = [af_token.address, timelock.address, networkConfig[chainId]["voting_delay"], networkConfig[chainId]["voting_period"]]
    governor = await deploy("AidGovernance", { from: deployer, log: true, args: args3 })
    log("Governance deployed to by", deployer)
    log("-------------------------------")

    const timelockContract = await ethers.getContractFactory("TimelockContract", deployer)
    const Timelock = timelockContract.attach(timelock.address)



    // # delegating the vote.
    log("DElegating")
    const afContract = await ethers.getContractFactory("GovernanceToken", deployer)
    const af = afContract.attach(af_token.address)
    await af.delegate(deployer)
    log("-------------------------------")

    // deploying Aidflow
    log("Deploying aidflow contract")
    args4 = [minValue, prizeIndex, af_token.address, supportAmount]
    aidF = await deploy("AidFlow", { from: deployer, log: true, args: args4 })
    log("aidFlow contract deployed to by", deployer)
    log("-------------------------------")

    // Transfering ownership of AidFlow to timelock
    log("Transfering ownership of AidFlow to timelock")
    const AidF = await ethers.getContractFactory("AidFlow", deployer)
    const Aid = AidF.attach(aidF.address)
    await Aid.transferOwnership(Timelock.address)
    log("transfered...")
    log("-------------------------------")

    // # assigning roles, by default the timelock admin is the contracts deployer
    log("Assigning executor and proposer roles")
    const proposers = Timelock.PROPOSER_ROLE()
    const executors = Timelock.EXECUTOR_ROLE()
    const admin = Timelock.TIMELOCK_ADMIN_ROLE()
    log("Roles assigned")
    log("-------------------------------")

    // # granting proposers role to the governor contract
    log("granting proposer role")
    await Timelock.grantRole(proposers, governor.address)
    log("Role granted")
    log("-------------------------------")

    // # granting excecutors role to every addresss
    log("granting executor role")
    await Timelock.grantRole(executors, ADDRESS_ZERO)
    log("Role granted")
    log("-------------------------------")

    // Revoking admin access
    log("Revoking timelock access so that anything the timelock wants to do has to go through governance process")
    await Timelock.revokeRole(admin, deployer)
    log("Role revoked")
    log("-------------------------------")

    // donating to aidflow
    log("Donating...")
    await Aid.donate({ "value": 900000 })
    log("Donated")
    log("-------------------------------")

    // withdrawing
    // log("withdrawing...")
    // await Aid.withdraw_stake(deployer)
    // log("Withdrawn")
    // log("-------------------------------")
    // // transfering ownership to timelock
    // log("transfering ownership to timelock")
    // await Aid.transferOwnership(timelock.address)


    // proposing
    log("proposing...")
    const afG = await ethers.getContractFactory("AidGovernance", deployer)
    const aidG = afG.attach(governor.address)
    // const withdraw_address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    args = [deployer]
    calldata = await Aid.interface.encodeFunctionData("withdraw_stake", args)
    propose_tx = await aidG.propose([aidF.address], [0], [calldata], description)
    await move_blocks(voting_delay + 1)
    const receipt = await propose_tx.wait(1)
    const proposal_id = await receipt.events[0].args.proposalId
    log("Proposed, and the proposal Id is ", BigInt(proposal_id))
    log("-------------------------------")

    log("storing proposals")
    if (fs.existsSync(proposal_file)) {
      proposals = JSON.parse(fs.readFileSync(proposal_file, "utf8"))
    }
    else {
      proposals = {}
      proposals[chainId]["ProposalId"] = []
      proposals[chainId]["Description"] = [description]
    }
    proposals[chainId]["ProposalId"].push(proposal_id.toString())
    proposals[chainId]["Description"].push(description.toString())
    fs.writeFileSync(proposal_file, JSON.stringify(proposals), "utf8")
    log("proposal stored")

    // 0-against, 1-for, 2- abstain
    log("Voting.....")
    const reason = "lets save Africa"
    const vote = 1
    const vote_tx = await aidG.castVoteWithReason(proposal_id, vote, reason)
    const vote_receipt = await vote_tx.wait(1)
    log("Yeay voted and the reason is ", vote_receipt.events[0].args.reason)
    const proposal_state = await aidG.state(proposal_id)
    // # states{pending, active, cancelled, defeated, succeeded, queued, expired, executed}
    log("the proposal state for", BigInt(proposal_id), "is ", proposal_state)
    await move_blocks(voting_period + 1)
    log("-------------------------------")

    log("qeueing the passed proposal")
    const description_hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(description))
    const queu_tx = await aidG.queue([Aid.address], [0], [calldata], description_hash)
    await queu_tx.wait(1)
    await move_time(min_delay + 1)
    await move_blocks(1)
    const init_balance = await Aid.getBalance()
    log("queued and the init balance is", BigInt(init_balance))
    log("The state of the proposal is ", await aidG.state(proposal_id))

    log("executing...")
    const execute_tx = await aidG.execute([Aid.address], [0], [calldata], description_hash)
    await execute_tx.wait(1)
    const final_balance = await Aid.getBalance()
    log("executed and the final balance of the contract is ", BigInt(final_balance))
  }
  else {
    log("Deploying Governance token on Calibration network...")
    const private_key = network.config.accounts[0]
    const WALLET = new ethers.Wallet(private_key, ethers.provider)
    const af_ = await ethers.getContractFactory("GovernanceToken", WALLET)
    log("Wallet Ethereum Address:", WALLET.address)
    const af_token = await af_.deploy("AidFlow", "AF")
    await af_token.deployed()
    log("AidFlow token Contract deployed... to", af_token.address)
    const af_address = await af_token.address
    if (fs.existsSync(address_file)) {
      addresses = JSON.parse(fs.readFileSync(address_file, "utf8"))
    }
    else {
      addresses = {}
      addresses["AidToken"] = []
    }
    addresses["AidToken"].push(af_address.toString())
    fs.writeFileSync(address_file, JSON.stringify(addresses), "utf8")
    log("aid token address stored")
    log("-------------------------------")

    log("Deploying timeLock")
    const timelock_ = await ethers.getContractFactory("TimelockContract", WALLET)
    log("Wallet Ethereum Address:", WALLET.address)
    const timelock = await timelock_.deploy(minValue, [], [], WALLET.address)
    await timelock.deployed()
    log("Timelock Contract deployed... to", timelock.address)
    const timelock_address = await timelock.address
    if (fs.existsSync(address_file)) {
      addresses = JSON.parse(fs.readFileSync(address_file, "utf8"))
    }
    else {
      addresses = {}
      addresses["TimelockContract"] = []
    }
    addresses["TimelockContract"].push(timelock_address.toString())
    fs.writeFileSync(address_file, JSON.stringify(addresses), "utf8")
    log("timelock address stored")
    log("-------------------------------")

    log("Deploying Governance contract")
    const aidG_ = await ethers.getContractFactory("AidGovernance", WALLET)
    log("Wallet Ethereum Address:", WALLET.address)
    const aidG = await aidG_.deploy(af_token.address, timelock.address, voting_delay, voting_period)
    await aidG.deployed()
    log("Governance Contract deployed... to", aidG.address)
    const aidG_address = await aidG.address
    if (fs.existsSync(address_file)) {
      addresses = JSON.parse(fs.readFileSync(address_file, "utf8"))
    }
    else {
      addresses = {}
      addresses["AidGovernance"] = []
    }
    addresses["AidGovernance"].push(aidG_address.toString())
    fs.writeFileSync(address_file, JSON.stringify(addresses), "utf8")
    log("AidGovernance address stored")
    log("-------------------------------")

    log("Deploying AidFlow")
    const aidf = await ethers.getContractFactory("AidFlow", WALLET)
    log("Wallet Ethereum Address:", WALLET.address)
    const aidF = await aidf.deploy(minValue, prizeIndex, af_token.address, supportAmount)
    await aidF.deployed()
    log("AidFLOW Contract deployed... to", aidF.address)
    const aidF_address = await aidF.address
    if (fs.existsSync(address_file)) {
      addresses = JSON.parse(fs.readFileSync(address_file, "utf8"))
    }
    else {
      addresses = {}
      addresses["AidFlow"] = []
    }
    addresses["AidFlow"].push(aidF_address.toString())
    fs.writeFileSync(address_file, JSON.stringify(addresses), "utf8")
    log("Aidflow address stored")
    log("-------------------------------")

    const timelockContract = await ethers.getContractFactory("TimelockContract", WALLET)
    const Timelock = timelockContract.attach(timelock.address)
    const AidG = aidG_.attach(aidG.address)
    const AidF = aidf.attach(aidF.address)

    // # assigning roles, by default the timelock admin is the contracts deployer
    log("Assigning executor and proposer roles")
    const proposers = await Timelock.PROPOSER_ROLE()
    const executors = await Timelock.EXECUTOR_ROLE()
    const admin = await Timelock.TIMELOCK_ADMIN_ROLE()
    log("Roles assigned")
    log("-------------------------------")

    // # granting proposers role to the governor contract
    log("granting proposer role")
    const proposR_tx = await Timelock.grantRole(proposers, AidG.address)
    await proposR_tx.wait(1)
    log("Role granted")
    log("-------------------------------")

    // # granting excecutors role to every addresss
    log("granting executor role")
    const executR_tx = await Timelock.grantRole(executors, ADDRESS_ZERO)
    await executR_tx.wait(1)
    log("Role granted")
    log("-------------------------------")

    // # delegating the vote.
    log("DElegating")
    const afContract = await ethers.getContractFactory("GovernanceToken", deployer)
    const af = afContract.attach(af_token.address)
    const delegate_tx = await af.delegate(WALLET.address)
    await delegate_tx.wait(1)
    log("-------------------------------")

    // Revoking admin access
    log("Revoking timelock access so that anything the timelock wants to do has to go through governance process")
    const revoke_tx = await Timelock.revokeRole(admin, WALLET.address)
    await revoke_tx.wait(1)
    log("Role revoked")
    log("-------------------------------")

    // donating to aidflow
    log("Donating...")
    const donate_tx = await AidF.donate({ "value": 900000 })
    await donate_tx.wait(1)
    log("Donated")
    log("The balance of the contract is ", BigInt(await AidF.getBalance()))
    log("-------------------------------")

    // proposing
    log("proposing...")
    args = [WALLET.address]
    calldata = await AidF.interface.encodeFunctionData("withdraw_stake", args)
    propose_tx = await AidG.propose([AidF.address], [0], [calldata], description)
    const receipt = await propose_tx.wait(1)
    const proposal_id = await receipt.events[0].args.proposalId
    const chainId = network.config.chainId.toString()
    log("Proposed, and the proposal Id is ", BigInt(proposal_id))
    log("-------------------------------")

    log("storing proposals")
    if (fs.existsSync(proposal_file)) {
      proposals = JSON.parse(fs.readFileSync(proposal_file, "utf8"))
    }
    else {
      proposals = {}
      proposals[chainId]["ProposalId"] = []
      proposals[chainId]["Description"] = [description]
    }
    proposals[chainId]["ProposalId"].push(proposal_id.toString())
    proposals[chainId]["Description"].push(description.toString())
    fs.writeFileSync(proposal_file, JSON.stringify(proposals), "utf8")
    log("proposal stored")

    // 0-against, 1-for, 2- abstain
    log("Voting.....")
    const reason = "lets save Africa"
    const vote = 1
    const vote_tx = await AidG.castVoteWithReason(proposal_id, vote, reason)
    const vote_receipt = await vote_tx.wait(1)
    log("Yeay voted and the reason is ", vote_receipt.events[0].args.reason)
    const proposal_state = await AidG.state(proposal_id)
    // # states{pending, active, cancelled, defeated, succeeded, queued, expired, executed}
    log("the proposal state for", BigInt(proposal_id), "is ", proposal_state)
    log("-------------------------------")

    log("qeueing the passed proposal")
    const description_hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(description))
    const queu_tx = await AidG.queue([Aid.address], [0], [calldata], description_hash)
    await queu_tx.wait(1)
    const init_balance = await AidF.getBalance()
    log("queued and the init balance is", BigInt(init_balance))
    log("The state of the proposal is ", await AidG.state(proposal_id))

    log("executing...")
    const execute_tx = await AidG.execute([Aid.address], [0], [calldata], description_hash)
    await execute_tx.wait(1)
    const final_balance = await AidF.getBalance()
    log("executed and the final balance of the contract is ", BigInt(final_balance))


  }

}

module.exports.tags = ["all", "aid"]



// def propose(box, store_value, governor, account):
//     args = (store_value,)
//     calldata = box.setNumber.encode_input(*args)
//     propose_tx = governor.propose(
//         [box.address], [0], [calldata], description, {"from": account}
//     )
//     propose_tx.wait(3)  # to allow for voting delay period to pass
//     proposalId = propose_tx.events["ProposalCreated"]["proposalId"]
//     print(f"Proposal proposed, the state is {governor.state(proposalId)}")
//     # moving voting_delay blocks to voting
//     if network.show_active() in LOCAL_DEVELOPMENT_NETWORKS:
//         move_blocks(voting_delay)
//     print(proposalId)
//     return propose_tx, proposalId, calldata
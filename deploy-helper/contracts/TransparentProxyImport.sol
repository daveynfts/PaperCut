// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Expose the OpenZeppelin proxy artifact to the deployment script without the
// legacy Hardhat upgrades plugin and its vulnerable transitive dependencies.
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

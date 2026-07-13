// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is Ownable {
    IERC20 public stakingToken;
    
    // 5% APY
    uint256 public constant APY = 5; 
    uint256 public constant SECONDS_IN_YEAR = 31536000;
    
    struct Staker {
        uint256 stakedAmount;
        uint256 lastStakeTime;
        uint256 pendingRewards;
    }
    
    mapping(address => Staker) public stakers;
    
    uint256 public totalStaked;
    
    constructor(address _stakingToken) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
    }
    
    function calculateReward(address _user) public view returns (uint256) {
        Staker memory staker = stakers[_user];
        if (staker.stakedAmount == 0) {
            return staker.pendingRewards;
        }
        
        uint256 timeElapsed = block.timestamp - staker.lastStakeTime;
        
        uint256 newReward = (staker.stakedAmount * APY * timeElapsed) / (100 * SECONDS_IN_YEAR);
        
        return staker.pendingRewards + newReward;
    }
    
    function stake(uint256 _amount) external {
        require(_amount > 0, "Cannot stake 0");
        
        uint256 reward = calculateReward(msg.sender);
        
        stakers[msg.sender].pendingRewards = reward;
        stakers[msg.sender].stakedAmount += _amount;
        stakers[msg.sender].lastStakeTime = block.timestamp;
        
        totalStaked += _amount;
        
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
    }
    
    function unstake(uint256 _amount) external {
        require(_amount > 0, "Cannot unstake 0");
        require(stakers[msg.sender].stakedAmount >= _amount, "Insufficient staked amount");
        
        uint256 reward = calculateReward(msg.sender);
        
        stakers[msg.sender].pendingRewards = reward;
        stakers[msg.sender].stakedAmount -= _amount;
        stakers[msg.sender].lastStakeTime = block.timestamp;
        
        totalStaked -= _amount;
        
        require(stakingToken.transfer(msg.sender, _amount), "Transfer failed");
    }
    
    function claimReward() external {
        uint256 reward = calculateReward(msg.sender);
        require(reward > 0, "No rewards to claim");
        
        stakers[msg.sender].pendingRewards = 0;
        stakers[msg.sender].lastStakeTime = block.timestamp;
        
        require(stakingToken.transfer(msg.sender, reward), "Reward transfer failed");
    }
}

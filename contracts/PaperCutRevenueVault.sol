// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev ERC20 Token Standard Interface
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PaperCutRevenueVault
 * @notice Smart contract managing and distributing publisher revenue on PaperCut.
 * Supports off-chain tracking with secure on-chain sync and reentrancy-safe claims.
 */
contract PaperCutRevenueVault {
    
    // USDC Token Address used for nanoshare coinage
    IERC20 public immutable usdcToken;
    
    // Admin / Owner of the contract
    address public owner;
    
    // Relayer/Oracle authorized to update publisher balances
    address public oracle;

    // Mapping: Publisher Address => Total accumulated earned revenue (historical total)
    mapping(address => uint256) public totalEarned;
    
    // Mapping: Publisher Address => Total claimed revenue
    mapping(address => uint256) public totalClaimed;

    // Events
    event RevenueUpdated(address indexed publisher, uint256 totalEarnedAmount);
    event RevenueClaimed(address indexed publisher, address indexed receiver, uint256 amount);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner permitted");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == oracle, "Not authorized");
        _;
    }

    constructor(address _usdcToken, address _oracle) {
        require(_usdcToken != address(0), "Invalid token address");
        require(_oracle != address(0), "Invalid oracle address");
        usdcToken = IERC20(_usdcToken);
        owner = msg.sender;
        oracle = _oracle;
    }

    /**
     * @notice Updates the authorized oracle address.
     */
    function setOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        emit OracleUpdated(oracle, _newOracle);
        oracle = _newOracle;
    }

    /**
     * @notice Transfers ownership of the contract.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        emit OwnerUpdated(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @notice Updates the total earned historical revenue of multiple publishers.
     * @dev Must be called by the owner or authorized oracle.
     * @param publishers Array of publisher addresses.
     * @param totalEarnedAmounts Array of accumulated revenue amounts (in USDC decimals).
     */
    function updateBalances(
        address[] calldata publishers, 
        uint256[] calldata totalEarnedAmounts
    ) external onlyAuthorized {
        require(publishers.length == totalEarnedAmounts.length, "Array lengths mismatch");

        for (uint256 i = 0; i < publishers.length; i++) {
            address pub = publishers[i];
            uint256 newEarned = totalEarnedAmounts[i];
            
            // Safety check: Total earned must be monotonically increasing.
            require(newEarned >= totalEarned[pub], "New revenue cannot be lower than existing");
            
            totalEarned[pub] = newEarned;
            emit RevenueUpdated(pub, newEarned);
        }
    }

    /**
     * @notice Computes current claimable/withdrawable balance for a publisher.
     */
    function getWithdrawableBalance(address publisher) public view returns (uint256) {
        uint256 earned = totalEarned[publisher];
        uint256 claimed = totalClaimed[publisher];
        if (earned <= claimed) return 0;
        return earned - claimed;
    }

    /**
     * @notice Publisher claims all available revenue.
     */
    function claim() external {
        uint256 claimable = getWithdrawableBalance(msg.sender);
        require(claimable > 0, "No claimable revenue available");

        // Verify contract has enough reserve
        uint256 contractUsdcBalance = usdcToken.balanceOf(address(this));
        require(contractUsdcBalance >= claimable, "Contract balance insufficient, contact admin");

        // Checks-Effects-Interactions pattern to prevent reentrancy
        totalClaimed[msg.sender] += claimable;

        require(usdcToken.transfer(msg.sender, claimable), "USDC transfer failed");

        emit RevenueClaimed(msg.sender, msg.sender, claimable);
    }
    
    /**
     * @notice Admin deposit reserve function.
     */
    function depositFunds(uint256 amount) external {
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Deposit failed");
    }

    /**
     * @notice Recover non-USDC ERC20 tokens sent to the contract by mistake.
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(usdcToken), "Cannot recover USDC");
        require(IERC20(tokenAddress).transfer(owner, tokenAmount), "Recovery transfer failed");
    }
}

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
 * @notice Smart contract for direct on-chain article purchases and publisher revenue distribution.
 * Readers pay USDC directly to this contract when buying an article. The contract allocates the funds,
 * handles platform fee splits, and lets publishers claim their earnings securely.
 */
contract PaperCutRevenueVault {
    
    // USDC Token Address used for coinage
    IERC20 public immutable usdcToken;
    
    // Contract owner (admin/platform registry)
    address public owner;
    
    // Platform fee basis points (e.g., 500 = 5% fee)
    uint256 public platformFeeBps;
    
    // Accumulated fee revenue for the platform
    uint256 public accumulatedPlatformFees;

    // Mapping: Publisher Address => Total historical revenue earned (after fees)
    mapping(address => uint256) public totalEarned;
    
    // Mapping: Publisher Address => Total claimed revenue
    mapping(address => uint256) public totalClaimed;

    // Events
    event ArticlePurchased(
        address indexed reader, 
        string articleId, 
        address indexed publisher, 
        uint256 amount,
        uint256 publisherShare,
        uint256 platformFee
    );
    event RevenueClaimed(address indexed publisher, address indexed receiver, uint256 amount);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amount);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner permitted");
        _;
    }

    constructor(address _usdcToken, uint256 _platformFeeBps) {
        require(_usdcToken != address(0), "Invalid token address");
        require(_platformFeeBps <= 3000, "Fee cannot exceed 30%"); // Max fee capped at 30%
        usdcToken = IERC20(_usdcToken);
        owner = msg.sender;
        platformFeeBps = _platformFeeBps;
    }

    /**
     * @notice Set platform fee in basis points (1 bps = 0.01%, 10000 bps = 100%)
     */
    function setPlatformFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 3000, "Fee cannot exceed 30%");
        emit PlatformFeeUpdated(platformFeeBps, _newFeeBps);
        platformFeeBps = _newFeeBps;
    }

    /**
     * @notice Transfer contract ownership
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        emit OwnerUpdated(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @notice Purchases an article by transferring USDC from the reader's wallet,
     * deducting the platform fee, and allocating the remainder to the publisher.
     * @param articleId The identifier of the article.
     * @param publisher The target publisher address who wrote the article.
     * @param amount The purchase price in USDC (decimals included).
     */
    function purchaseArticle(
        string calldata articleId,
        address publisher,
        uint256 amount
    ) external {
        require(publisher != address(0), "Invalid publisher address");
        require(amount > 0, "Amount must be greater than zero");

        // Transfer USDC from reader to this contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), amount), 
            "USDC transfer failed"
        );

        // Calculate platform fee and publisher share
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 pubShare = amount - fee;

        // Allocate balances
        accumulatedPlatformFees += fee;
        totalEarned[publisher] += pubShare;

        emit ArticlePurchased(msg.sender, articleId, publisher, amount, pubShare, fee);
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
        require(contractUsdcBalance >= claimable, "Contract balance insufficient");

        // Checks-Effects-Interactions pattern to prevent reentrancy
        totalClaimed[msg.sender] += claimable;

        require(usdcToken.transfer(msg.sender, claimable), "USDC claim transfer failed");

        emit RevenueClaimed(msg.sender, msg.sender, claimable);
    }

    /**
     * @notice Owner withdraws accumulated platform fees.
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = accumulatedPlatformFees;
        require(amount > 0, "No platform fees to withdraw");

        accumulatedPlatformFees = 0;
        require(usdcToken.transfer(owner, amount), "USDC fee withdrawal failed");

        emit PlatformFeesWithdrawn(owner, amount);
    }

    /**
     * @notice Recover non-USDC ERC20 tokens sent to the contract by mistake.
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(usdcToken), "Cannot recover USDC");
        require(IERC20(tokenAddress).transfer(owner, tokenAmount), "Recovery transfer failed");
    }
}

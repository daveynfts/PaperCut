// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20
 * @dev Complete ERC20 Token Standard Interface (M-1)
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function totalSupply() external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title PaperCutRevenueVault
 * @notice Smart contract for direct on-chain article purchases and publisher revenue distribution.
 * Readers pay USDC directly to this contract when buying an article. The contract allocates the funds,
 * handles platform fee splits, and lets publishers claim their earnings securely.
 */
contract PaperCutRevenueVault {

    // --- Custom Errors (I-3) ---
    error OnlyOwnerPermitted();
    error OnlyPendingOwnerPermitted();
    error ReentrantCall();
    error ContractIsPaused();
    error InvalidTokenAddress();
    error FeeTooHigh();
    error InvalidOwnerAddress();
    error InvalidPublisherAddress();
    error AmountMustBePositive();
    error USDCTransferFailed();
    error AlreadyPurchased();
    error NoClaimableRevenue();
    error InsufficientContractBalance();
    error USDCClaimTransferFailed();
    error NoPlatformFeesToWithdraw();
    error USDCFeeWithdrawalFailed();
    error CannotRecoverUSDC();
    error RecoveryTransferFailed();

    // --- Reentrancy Guard (H-2) ---
    bool private _locked;
    modifier nonReentrant() {
        if (_locked) revert ReentrantCall();
        _locked = true;
        _;
        _locked = false;
    }

    // --- Pausable (L-6) ---
    bool public paused;

    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    // USDC Token Address used for coinage
    IERC20 public immutable usdcToken;
    
    // Contract owner (admin/platform registry)
    address public owner;

    // Two-step ownership transfer (M-2)
    address public pendingOwner;
    
    // Platform fee basis points (e.g., 500 = 5% fee)
    // L-5: A value of 0 is intentionally allowed, meaning no platform fee is charged.
    uint256 public platformFeeBps;
    
    // Accumulated fee revenue for the platform
    uint256 public accumulatedPlatformFees;

    // Mapping: Publisher Address => Total historical revenue earned (after fees)
    mapping(address => uint256) public totalEarned;
    
    // Mapping: Publisher Address => Total claimed revenue
    mapping(address => uint256) public totalClaimed;

    // Purchase tracking to prevent duplicate charges (H-4)
    mapping(address => mapping(string => bool)) public hasPurchased;

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
    event OwnershipTransferProposed(address indexed currentOwner, address indexed pendingOwner);
    event ERC20Recovered(address indexed token, uint256 amount); // L-1
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerPermitted();
        _;
    }

    constructor(address _usdcToken, uint256 _platformFeeBps) {
        if (_usdcToken == address(0)) revert InvalidTokenAddress();
        if (_platformFeeBps > 3000) revert FeeTooHigh(); // Max fee capped at 30%
        usdcToken = IERC20(_usdcToken);
        owner = msg.sender;
        platformFeeBps = _platformFeeBps;
    }

    // --- Pausable functions (L-6) ---

    /**
     * @notice Pause the contract, disabling purchases and claims.
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause the contract, re-enabling purchases and claims.
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Set platform fee in basis points (1 bps = 0.01%, 10000 bps = 100%)
     */
    function setPlatformFeeBps(uint256 _newFeeBps) external onlyOwner {
        if (_newFeeBps > 3000) revert FeeTooHigh();
        emit PlatformFeeUpdated(platformFeeBps, _newFeeBps);
        platformFeeBps = _newFeeBps;
    }

    /**
     * @notice Propose a new owner (two-step transfer) (M-2)
     * @param _newOwner Address of the proposed new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidOwnerAddress();
        pendingOwner = _newOwner;
        emit OwnershipTransferProposed(owner, _newOwner);
    }

    /**
     * @notice Accept ownership (must be called by the pending owner) (M-2)
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert OnlyPendingOwnerPermitted();
        emit OwnerUpdated(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
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
    ) external whenNotPaused nonReentrant {
        if (publisher == address(0)) revert InvalidPublisherAddress();
        if (amount == 0) revert AmountMustBePositive();

        // Prevent duplicate purchases (H-4)
        if (hasPurchased[msg.sender][articleId]) revert AlreadyPurchased();
        hasPurchased[msg.sender][articleId] = true;

        // Transfer USDC from reader to this contract
        if (!usdcToken.transferFrom(msg.sender, address(this), amount)) revert USDCTransferFailed();

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
        // I-1: Safe to use unchecked since we verified earned > claimed above
        unchecked {
            return earned - claimed;
        }
    }

    /**
     * @notice Publisher claims all available revenue.
     */
    function claim() external whenNotPaused nonReentrant {
        uint256 claimable = getWithdrawableBalance(msg.sender);
        if (claimable == 0) revert NoClaimableRevenue();

        // Verify contract has enough reserve
        uint256 contractUsdcBalance = usdcToken.balanceOf(address(this));
        if (contractUsdcBalance < claimable) revert InsufficientContractBalance();

        // Checks-Effects-Interactions pattern
        totalClaimed[msg.sender] += claimable;

        // H-1: Emit event BEFORE external call
        emit RevenueClaimed(msg.sender, msg.sender, claimable);

        if (!usdcToken.transfer(msg.sender, claimable)) revert USDCClaimTransferFailed();
    }

    /**
     * @notice Owner withdraws accumulated platform fees.
     */
    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedPlatformFees;
        if (amount == 0) revert NoPlatformFeesToWithdraw();

        // L-4: Verify contract actually holds enough USDC
        if (usdcToken.balanceOf(address(this)) < amount) revert InsufficientContractBalance();

        accumulatedPlatformFees = 0;
        if (!usdcToken.transfer(owner, amount)) revert USDCFeeWithdrawalFailed();

        emit PlatformFeesWithdrawn(owner, amount);
    }

    /**
     * @notice Recover non-USDC ERC20 tokens sent to the contract by mistake.
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        if (tokenAddress == address(usdcToken)) revert CannotRecoverUSDC();
        if (!IERC20(tokenAddress).transfer(owner, tokenAmount)) revert RecoveryTransferFailed();
        emit ERC20Recovered(tokenAddress, tokenAmount); // L-1
    }
}

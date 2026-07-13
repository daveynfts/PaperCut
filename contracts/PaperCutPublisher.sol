// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PaperCutPublisher
 * @notice Manages on-chain article unlocking with direct publisher payouts, authorization, and emergency controls.
 * @dev Integrates with ERC20 USDC for micropayments, with pause mechanisms and access controls.
 */
contract PaperCutPublisher {
    
    // --- Custom Errors ---
    error OnlyOwnerPermitted();
    error InvalidTokenAddress();
    error InvalidAuthorAddress();
    error AmountMustBePositive();
    error USDCTransferFailed();
    error ContractIsPaused();
    error PublisherNotAuthorized();

    // --- State Variables ---
    
    // Contract owner
    address public owner;
    
    // USDC Token Address used for micropayments
    IERC20 public immutable usdcToken;

    // Pausable state
    bool public paused;

    // Registry of authorized publishers
    mapping(address => bool) public authorizedPublishers;

    // --- Events ---
    event ArticleUnlocked(
        address indexed reader,
        string articleId,
        address indexed author,
        uint256 amount
    );
    event PublisherAuthorized(address indexed publisher);
    event PublisherDeauthorized(address indexed publisher);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerPermitted();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    constructor(address _usdcToken) {
        if (_usdcToken == address(0)) revert InvalidTokenAddress();
        owner = msg.sender;
        usdcToken = IERC20(_usdcToken);
    }

    // --- Admin / Owner Functions ---

    /**
     * @notice Pause the contract, disabling article unlocks.
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause the contract, re-enabling article unlocks.
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Authorize a publisher to receive micropayments.
     */
    function authorizePublisher(address publisher) external onlyOwner {
        if (publisher == address(0)) revert InvalidAuthorAddress();
        authorizedPublishers[publisher] = true;
        emit PublisherAuthorized(publisher);
    }

    /**
     * @notice Deauthorize a publisher.
     */
    function deauthorizePublisher(address publisher) external onlyOwner {
        authorizedPublishers[publisher] = false;
        emit PublisherDeauthorized(publisher);
    }

    /**
     * @notice Transfer ownership of the contract.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert OnlyOwnerPermitted();
        emit OwnerUpdated(owner, _newOwner);
        owner = _newOwner;
    }

    // --- Core Functions ---

    /**
     * @notice Direct micropayment for unlocking articles on-chain.
     * @param articleId The unique identifier of the article.
     * @param author The publisher receiving the USDC.
     * @param amount The USDC amount in microunits (6 decimals).
     */
    function unlockArticle(string calldata articleId, address author, uint256 amount) external whenNotPaused {
        if (author == address(0)) revert InvalidAuthorAddress();
        if (amount == 0) revert AmountMustBePositive();
        if (!authorizedPublishers[author]) revert PublisherNotAuthorized();
        
        // Transfer USDC from reader (msg.sender) to author
        if (!usdcToken.transferFrom(msg.sender, author, amount)) {
            revert USDCTransferFailed();
        }

        emit ArticleUnlocked(msg.sender, articleId, author, amount);
    }
}

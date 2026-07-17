// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Custodial article revenue vault with owner-controlled prices and recipients.
contract PaperCutRevenueVault {
    using SafeERC20 for IERC20;

    error OnlyOwnerPermitted();
    error OnlyPendingOwnerPermitted();
    error ReentrantCall();
    error ContractIsPaused();
    error InvalidTokenAddress();
    error FeeTooHigh();
    error InvalidOwnerAddress();
    error InvalidPublisherAddress();
    error InvalidArticleId();
    error InvalidPrice();
    error ArticleUnavailable();
    error AlreadyPurchased();
    error NoClaimableRevenue();
    error InsufficientContractBalance();
    error NoPlatformFeesToWithdraw();
    error CannotRecoverUSDC();

    struct Article {
        address publisher;
        uint256 price;
        bool active;
    }

    bool private _locked;
    bool public paused;
    IERC20 public immutable usdcToken;
    address public owner;
    address public pendingOwner;
    uint256 public platformFeeBps;
    uint256 public accumulatedPlatformFees;
    mapping(bytes32 => Article) public articles;
    mapping(address => uint256) public totalEarned;
    mapping(address => uint256) public totalClaimed;
    mapping(address => mapping(bytes32 => bool)) public hasPurchased;

    event ArticleRegistered(bytes32 indexed articleKey, string articleId, address indexed publisher, uint256 price, bool active);
    event ArticlePurchased(address indexed reader, bytes32 indexed articleKey, string articleId, address indexed publisher, uint256 amount, uint256 publisherShare, uint256 platformFee);
    event RevenueClaimed(address indexed publisher, uint256 amount);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amount);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event OwnershipTransferProposed(address indexed currentOwner, address indexed pendingOwner);
    event ERC20Recovered(address indexed token, uint256 amount);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier nonReentrant() {
        if (_locked) revert ReentrantCall();
        _locked = true;
        _;
        _locked = false;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerPermitted();
        _;
    }

    constructor(address token, uint256 feeBps) {
        if (token == address(0)) revert InvalidTokenAddress();
        if (feeBps > 3000) revert FeeTooHigh();
        usdcToken = IERC20(token);
        owner = msg.sender;
        platformFeeBps = feeBps;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function registerArticle(string calldata articleId, address publisher, uint256 price, bool active) external onlyOwner {
        bytes32 key = _articleKey(articleId);
        if (publisher == address(0)) revert InvalidPublisherAddress();
        if (price == 0) revert InvalidPrice();
        articles[key] = Article({publisher: publisher, price: price, active: active});
        emit ArticleRegistered(key, articleId, publisher, price, active);
    }

    function purchaseArticle(string calldata articleId) external whenNotPaused nonReentrant {
        bytes32 key = _articleKey(articleId);
        Article memory article = articles[key];
        if (!article.active || article.publisher == address(0) || article.price == 0) revert ArticleUnavailable();
        if (hasPurchased[msg.sender][key]) revert AlreadyPurchased();
        hasPurchased[msg.sender][key] = true;

        usdcToken.safeTransferFrom(msg.sender, address(this), article.price);
        uint256 fee = (article.price * platformFeeBps) / 10000;
        uint256 publisherShare = article.price - fee;
        accumulatedPlatformFees += fee;
        totalEarned[article.publisher] += publisherShare;
        emit ArticlePurchased(msg.sender, key, articleId, article.publisher, article.price, publisherShare, fee);
    }

    function getWithdrawableBalance(address publisher) public view returns (uint256) {
        uint256 earned = totalEarned[publisher];
        uint256 claimed = totalClaimed[publisher];
        return earned > claimed ? earned - claimed : 0;
    }

    function claim() external whenNotPaused nonReentrant {
        uint256 amount = getWithdrawableBalance(msg.sender);
        if (amount == 0) revert NoClaimableRevenue();
        if (usdcToken.balanceOf(address(this)) < amount) revert InsufficientContractBalance();
        totalClaimed[msg.sender] += amount;
        usdcToken.safeTransfer(msg.sender, amount);
        emit RevenueClaimed(msg.sender, amount);
    }

    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 3000) revert FeeTooHigh();
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedPlatformFees;
        if (amount == 0) revert NoPlatformFeesToWithdraw();
        if (usdcToken.balanceOf(address(this)) < amount) revert InsufficientContractBalance();
        accumulatedPlatformFees = 0;
        usdcToken.safeTransfer(owner, amount);
        emit PlatformFeesWithdrawn(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwnerAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert OnlyPendingOwnerPermitted();
        emit OwnerUpdated(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function recoverERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(usdcToken)) revert CannotRecoverUSDC();
        IERC20(token).safeTransfer(owner, amount);
        emit ERC20Recovered(token, amount);
    }

    function articleKey(string calldata articleId) external pure returns (bytes32) {
        return _articleKey(articleId);
    }

    function _articleKey(string calldata articleId) private pure returns (bytes32) {
        bytes memory value = bytes(articleId);
        if (value.length == 0 || value.length > 128) revert InvalidArticleId();
        return keccak256(value);
    }
}

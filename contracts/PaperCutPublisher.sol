// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Direct USDC article payments with owner-controlled prices and recipients.
contract PaperCutPublisher {
    using SafeERC20 for IERC20;

    error OnlyOwnerPermitted();
    error OnlyPendingOwnerPermitted();
    error InvalidTokenAddress();
    error InvalidPublisherAddress();
    error InvalidArticleId();
    error InvalidPrice();
    error ContractIsPaused();
    error PublisherNotAuthorized();
    error ArticleUnavailable();
    error AlreadyUnlocked();

    struct Article {
        address publisher;
        uint256 price;
        bool active;
    }

    address public owner;
    address public pendingOwner;
    IERC20 public immutable usdcToken;
    bool public paused;
    mapping(address => bool) public authorizedPublishers;
    mapping(bytes32 => Article) public articles;
    mapping(address => mapping(bytes32 => bool)) public hasUnlocked;

    event ArticleRegistered(bytes32 indexed articleKey, string articleId, address indexed publisher, uint256 price, bool active);
    event ArticleUnlocked(address indexed reader, bytes32 indexed articleKey, string articleId, address indexed publisher, uint256 amount);
    event PublisherAuthorized(address indexed publisher, bool authorized);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event OwnershipTransferProposed(address indexed currentOwner, address indexed pendingOwner);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerPermitted();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    constructor(address token) {
        if (token == address(0)) revert InvalidTokenAddress();
        owner = msg.sender;
        usdcToken = IERC20(token);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setPublisherAuthorization(address publisher, bool authorized) external onlyOwner {
        if (publisher == address(0)) revert InvalidPublisherAddress();
        authorizedPublishers[publisher] = authorized;
        emit PublisherAuthorized(publisher, authorized);
    }

    function registerArticle(string calldata articleId, address publisher, uint256 price, bool active) external onlyOwner {
        bytes32 key = _articleKey(articleId);
        if (publisher == address(0)) revert InvalidPublisherAddress();
        if (!authorizedPublishers[publisher]) revert PublisherNotAuthorized();
        if (price == 0) revert InvalidPrice();
        articles[key] = Article({publisher: publisher, price: price, active: active});
        emit ArticleRegistered(key, articleId, publisher, price, active);
    }

    function unlockArticle(string calldata articleId) external whenNotPaused {
        bytes32 key = _articleKey(articleId);
        Article memory article = articles[key];
        if (!article.active || !authorizedPublishers[article.publisher]) revert ArticleUnavailable();
        if (hasUnlocked[msg.sender][key]) revert AlreadyUnlocked();

        hasUnlocked[msg.sender][key] = true;
        usdcToken.safeTransferFrom(msg.sender, article.publisher, article.price);
        emit ArticleUnlocked(msg.sender, key, articleId, article.publisher, article.price);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert OnlyOwnerPermitted();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert OnlyPendingOwnerPermitted();
        emit OwnerUpdated(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
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

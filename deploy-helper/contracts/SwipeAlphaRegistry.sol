// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract SwipeAlphaRegistry is Initializable, OwnableUpgradeable {
    // State Variables
    struct Agent {
        string name;
        string metadataURI;
        uint256 totalRating;
        uint32 ratingCount;
        bool active;
    }

    struct Signal {
        uint256 agentId;
        string tokenSymbol;
        string signalType; // "BUY", "SELL", "HOLD"
        uint256 targetPrice; // scaled by 1e18 or 1e8
        string reasoning;
        uint256 timestamp;
    }

    struct Rating {
        address user;
        uint8 score; // 1 to 5
        string comment;
        uint256 timestamp;
    }

    uint256 public nextAgentId;
    
    // Mappings
    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Rating[]) public agentRatings;
    mapping(uint256 => Signal[]) public agentSignals;
    
    // Events
    event AgentRegistered(uint256 indexed agentId, string name, string metadataURI);
    event RatingSubmitted(uint256 indexed agentId, address indexed user, uint8 score, string comment);
    event SignalPublished(uint256 indexed agentId, string tokenSymbol, string signalType, uint256 targetPrice, string reasoning);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        nextAgentId = 1;
    }

    function registerAgent(string memory _name, string memory _metadataURI) public onlyOwner returns (uint256) {
        uint256 agentId = nextAgentId++;
        agents[agentId] = Agent({
            name: _name,
            metadataURI: _metadataURI,
            totalRating: 0,
            ratingCount: 0,
            active: true
        });

        emit AgentRegistered(agentId, _name, _metadataURI);
        return agentId;
    }

    function submitReputation(uint256 _agentId, uint8 _score, string memory _comment) public {
        require(agents[_agentId].active, "Agent is not active");
        require(_score >= 1 && _score <= 5, "Rating must be between 1 and 5");

        agentRatings[_agentId].push(Rating({
            user: msg.sender,
            score: _score,
            comment: _comment,
            timestamp: block.timestamp
        }));

        agents[_agentId].totalRating += _score;
        agents[_agentId].ratingCount += 1;

        emit RatingSubmitted(_agentId, msg.sender, _score, _comment);
    }

    function publishSignal(
        uint256 _agentId,
        string memory _tokenSymbol,
        string memory _signalType,
        uint256 _targetPrice,
        string memory _reasoning
    ) public {
        require(agents[_agentId].active, "Agent is not active");

        agentSignals[_agentId].push(Signal({
            agentId: _agentId,
            tokenSymbol: _tokenSymbol,
            signalType: _signalType,
            targetPrice: _targetPrice,
            reasoning: _reasoning,
            timestamp: block.timestamp
        }));

        emit SignalPublished(_agentId, _tokenSymbol, _signalType, _targetPrice, _reasoning);
    }

    // Helper views
    function getAverageRating(uint256 _agentId) public view returns (uint256) {
        Agent memory agent = agents[_agentId];
        if (agent.ratingCount == 0) return 0;
        return (agent.totalRating * 10) / agent.ratingCount; // e.g. 4.5 is returned as 45
    }

    function getAgent(uint256 _agentId) public view returns (
        string memory name,
        string memory metadataURI,
        uint256 avgRating,
        uint32 ratingCount,
        bool active
    ) {
        Agent memory agent = agents[_agentId];
        uint256 avg = getAverageRating(_agentId);
        return (agent.name, agent.metadataURI, avg, agent.ratingCount, agent.active);
    }

    function getRatings(uint256 _agentId) public view returns (Rating[] memory) {
        return agentRatings[_agentId];
    }

    function getSignals(uint256 _agentId) public view returns (Signal[] memory) {
        return agentSignals[_agentId];
    }
}

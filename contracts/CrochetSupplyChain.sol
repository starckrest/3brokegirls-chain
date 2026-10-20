// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title 3brokegirls crochet supply chain tracker
/// @notice Every handoff of a handmade crochet piece is stored as a
///         transaction: Maker -> Distributor -> Retailer -> Customer.
///         Anyone can read the history; only the right role can add a step,
///         and steps must happen in order.
contract CrochetSupplyChain {
    // ---------------------------------------------------------------- types

    enum Role {
        None,
        Maker,
        Distributor,
        Retailer
    }

    enum Stage {
        Crafted, // 0  Maker        - crocheted at the studio
        Packed, //  1  Maker        - tagged and packed
        Shipped, // 2  Distributor  - picked up and on the move
        AtHub, //    3  Distributor  - sitting in the warehouse / sorting hub
        OnShelf, //  4  Retailer     - received by the shop / market stall
        Sold //      5  Retailer     - handed to the customer
    }

    struct Product {
        uint256 id;
        string name;
        string category;
        string batchCode;
        string materials;
        address maker;
        Stage stage;
        uint64 createdAt;
    }

    struct Checkpoint {
        Stage stage;
        address actor;
        Role actorRole;
        string location;
        string note;
        uint64 timestamp;
    }

    // ---------------------------------------------------------------- state

    address public immutable owner;
    uint256 public productCount;

    mapping(address => Role) public roles;
    mapping(uint256 => Product) private products;
    mapping(uint256 => Checkpoint[]) private history;

    // --------------------------------------------------------------- events

    event RoleSet(address indexed account, Role role);
    event ProductCreated(uint256 indexed productId, string name, address indexed maker);
    event CheckpointAdded(uint256 indexed productId, Stage stage, address indexed actor, string location);

    // ------------------------------------------------------------ modifiers

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can do this");
        _;
    }

    modifier productExists(uint256 productId) {
        require(productId >= 1 && productId <= productCount, "Unknown product ID");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ----------------------------------------------------------- admin side

    /// @notice Give a wallet a role (or remove it by passing Role.None).
    function setRole(address account, Role role) external onlyOwner {
        roles[account] = role;
        emit RoleSet(account, role);
    }

    // ---------------------------------------------------------- maker side

    /// @notice Register a new handmade piece. Records the first step (Crafted).
    function createProduct(
        string memory name,
        string memory category,
        string memory batchCode,
        string memory materials,
        string memory location
    ) external returns (uint256 id) {
        require(roles[msg.sender] == Role.Maker, "Only a registered Maker can create products");
        require(bytes(name).length > 0, "Product needs a name");

        productCount += 1;
        id = productCount;

        Product storage p = products[id];
        p.id = id;
        p.name = name;
        p.category = category;
        p.batchCode = batchCode;
        p.materials = materials;
        p.maker = msg.sender;
        p.stage = Stage.Crafted;
        p.createdAt = uint64(block.timestamp);

        _record(id, Stage.Crafted, Role.Maker, location, "Handmade, stitch by stitch");
        emit ProductCreated(id, name, msg.sender);
    }

    // -------------------------------------------------- every role: advance

    /// @notice Record the next step for a product. Steps must be in order and
    ///         done by the role that owns that step.
    function advance(
        uint256 productId,
        Stage next,
        string memory location,
        string memory note
    ) external productExists(productId) {
        Product storage p = products[productId];

        require(p.stage != Stage.Sold, "Already sold to a customer");
        require(uint8(next) == uint8(p.stage) + 1, "Steps must happen in order");

        Role needed = _roleFor(next);
        require(roles[msg.sender] == needed, "Your role cannot record this step");
        if (needed == Role.Maker) {
            require(msg.sender == p.maker, "Only this piece's maker can record this step");
        }

        p.stage = next;
        _record(productId, next, needed, location, note);
    }

    // ----------------------------------------------------------- read side

    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (Product memory)
    {
        return products[productId];
    }

    function getHistory(uint256 productId)
        external
        view
        productExists(productId)
        returns (Checkpoint[] memory)
    {
        return history[productId];
    }

    // ------------------------------------------------------------ internals

    function _roleFor(Stage s) internal pure returns (Role) {
        if (s == Stage.Crafted || s == Stage.Packed) return Role.Maker;
        if (s == Stage.Shipped || s == Stage.AtHub) return Role.Distributor;
        return Role.Retailer;
    }

    function _record(
        uint256 productId,
        Stage stage,
        Role actorRole,
        string memory location,
        string memory note
    ) internal {
        Checkpoint storage c = history[productId].push();
        c.stage = stage;
        c.actor = msg.sender;
        c.actorRole = actorRole;
        c.location = location;
        c.note = note;
        c.timestamp = uint64(block.timestamp);
        emit CheckpointAdded(productId, stage, msg.sender, location);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title CrowdfundingDemo
 * @notice Minimal donation-tracking contract for the FundChain Sepolia
 *         testnet demo.
 *
 *         This is NOT audited production financial software. It implements
 *         no campaign deadlines, refunds, or escrow: it simply records
 *         per-campaign donations and lets the owner withdraw the held funds.
 *         Never deploy to mainnet.
 */
contract CrowdfundingDemo {
    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error ZeroValueDonation();
    error NotOwner();
    error ZeroValueWithdrawal();
    error InsufficientContractBalance();
    error TransferFailed();
    error CallToContract();
    error EmptyRecipient();

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event DonationReceived(
        bytes32 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    event Withdrawn(address indexed to, uint256 amount);

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    address public immutable owner;

    /// @notice Total wei donated per campaign id.
    mapping(bytes32 => uint256) public totalRaised;

    /// @notice Wei donated by each address per campaign id.
    mapping(bytes32 => mapping(address => uint256)) public contributions;

    /// @dev Simple reentrancy flag: set true during state-touching calls.
    bool private _reentrancyLocked;

    modifier nonReentrant() {
        if (_reentrancyLocked) {
            // Reuse a guard error; a dedicated error keeps the surface small.
            revert TransferFailed();
        }
        _reentrancyLocked = true;
        _;
        _reentrancyLocked = false;
    }

    constructor() {
        owner = msg.sender;
    }

    // ------------------------------------------------------------------
    // Donations
    // ------------------------------------------------------------------

    /**
     * @notice Donate ETH to a campaign identified on-chain by a bytes32 id.
     * @dev The app derives the id deterministically from the campaign slug,
     *      implying keccak256(abi.encodePacked(slug)) — see the frontend,
     *      which uses ethers.id(slug).
     */
    function donate(bytes32 campaignId) external payable nonReentrant {
        if (msg.value == 0) {
            revert ZeroValueDonation();
        }

        // Checks are done above; effects precede any interaction (there are
        // no external calls here at all, only event emission).
        totalRaised[campaignId] += msg.value;
        contributions[campaignId][msg.sender] += msg.value;

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    /// @dev Reject plain transfers that did not specify a campaign.
    receive() external payable {
        revert CallToContract();
    }

    fallback() external payable {
        revert CallToContract();
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    function totalRaisedFor(bytes32 campaignId)
        external
        view
        returns (uint256)
    {
        return totalRaised[campaignId];
    }

    function contributionFor(bytes32 campaignId, address donor)
        external
        view
        returns (uint256)
    {
        return contributions[campaignId][donor];
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ------------------------------------------------------------------
    // Owner withdrawal (demo only)
    // ------------------------------------------------------------------

    /**
     * @notice Withdraw `amount` wei to `to`. Only the owner may call this.
     * @dev Follows checks-effects-interactions and is nonReentrant.
     */
    function withdraw(address payable to, uint256 amount)
        public
        nonReentrant
    {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        if (to == address(0)) {
            revert EmptyRecipient();
        }
        if (amount == 0) {
            revert ZeroValueWithdrawal();
        }
        uint256 balance = address(this).balance;
        if (amount > balance) {
            revert InsufficientContractBalance();
        }

        // Effects before interaction.
        // (Per-campaign totals are deliberately not decremented: donations
        // remain attributed to their campaigns for the demo's transparency.)

        // Interaction last; the reentrancy lock plus the checks above keep
        // this call safe for plain recipient contracts.
        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit Withdrawn(to, amount);
    }

    /// @notice Withdraw the full contract balance to `to`. Owner only.
    function withdrawAll(address payable to) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        withdraw(to, address(this).balance);
    }
}
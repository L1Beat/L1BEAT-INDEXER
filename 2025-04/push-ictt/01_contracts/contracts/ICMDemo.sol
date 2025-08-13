// Original sources:
// https://github.com/ava-labs/avalanche-starter-kit/blob/21e0481966167736d616397ff09b52b0b2cc2398/contracts/interchain-messaging/send-receive/senderOnCChain.sol
// https://github.com/ava-labs/avalanche-starter-kit/blob/21e0481966167736d616397ff09b52b0b2cc2398/contracts/interchain-messaging/send-receive/receiverOnSubnet.sol

// (c) 2023, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem

pragma solidity ^0.8.28;

import "./ITeleporterMessenger.sol";
import "./ITeleporterReceiver.sol";

contract ICMSender {
    ITeleporterMessenger private immutable messenger =
        ITeleporterMessenger(0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf);

    uint32 private nextMessageId = 1;

    /**
     * @dev Sends a message to another chain with a sequential uint32 as message.
     */
    function sendMessage(
        address destinationAddress,
        bytes32 destinationBlockchainID
    ) external {
        uint32 messageId = nextMessageId++;

        messenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: destinationAddress,
                feeInfo: TeleporterFeeInfo({
                    feeTokenAddress: address(0),
                    amount: 0
                }),
                requiredGasLimit: 100000,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(messageId)
            })
        );
    }
}

contract ICMReceiver is ITeleporterReceiver {
    ITeleporterMessenger public immutable messenger =
        ITeleporterMessenger(0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf);

    uint256 public receivedMessageCount;

    // Track processed messages to prevent duplicates
    mapping(uint32 => bool) private processedMessages;

    function receiveTeleporterMessage(
        bytes32,
        address,
        bytes calldata message
    ) external override {
        // Only the Teleporter receiver can deliver a message
        require(
            msg.sender == address(messenger),
            "ICMReceiver: unauthorized TeleporterMessenger"
        );

        // Decode the message into a uint32
        uint32 messageId = abi.decode(message, (uint32));

        // Check if we've already processed this message
        if (!processedMessages[messageId]) {
            // Mark as processed
            processedMessages[messageId] = true;

            // Increment count only for new messages
            receivedMessageCount++;
        }
    }
}

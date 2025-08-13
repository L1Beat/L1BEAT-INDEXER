package main

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ava-labs/avalanchego/ids"
	avalancheWarp "github.com/ava-labs/avalanchego/vms/platformvm/warp"
	"github.com/ava-labs/avalanchego/vms/platformvm/warp/payload"
	"github.com/ava-labs/coreth/precompile/contracts/warp"
	teleportermessenger "github.com/ava-labs/icm-contracts/abi-bindings/go/teleporter/TeleporterMessenger"
	teleporterUtils "github.com/ava-labs/icm-contracts/utils/teleporter-utils"
	"github.com/ava-labs/subnet-evm/accounts/abi/bind"
	"github.com/ava-labs/subnet-evm/core/types"
	predicateutils "github.com/ava-labs/subnet-evm/predicate"
	"github.com/ethereum/go-ethereum/common"
)

const (
	BaseFeeFactor        = 2
	MaxPriorityFeePerGas = 2500000000 // 2.5 gwei
)

func (t *TurboRelayerMVP) deliverMessage(unsignedMsg *avalancheWarp.UnsignedMessage) error {
	//check chain id
	addressedPayload, err := payload.ParseAddressedCall(unsignedMsg.Payload)
	if err != nil {
		return fmt.Errorf("failed to parse payload: %w", err)
	}

	var teleporterMessage teleportermessenger.TeleporterMessage
	err = teleporterMessage.Unpack(addressedPayload.Payload)
	if err != nil {
		return fmt.Errorf("failed to unpack teleporter message: %w", err)
	}

	// Successfully parsed Teleporter message, check destination chain
	chainID, err := ids.ToID(teleporterMessage.DestinationBlockchainID[:])
	if err != nil {
		return fmt.Errorf("failed to convert chain ID: %w", err)
	}

	if chainID.String() != t.destChainIDStr {
		return fmt.Errorf("destination chain ID does not match: %s", chainID.String())
	}

	//check for duplicates
	teleporterMessageID, err := teleporterUtils.CalculateMessageID(
		common.HexToAddress(TELEPORTER_MESSENGER_ADDRESS),
		unsignedMsg.SourceChainID,
		teleporterMessage.DestinationBlockchainID,
		teleporterMessage.MessageNonce,
	)
	if err != nil {
		return fmt.Errorf("failed to calculate message ID: %w", err)
	}

	delivered, err := t.destTeleporterMessenger.MessageReceived(&bind.CallOpts{}, teleporterMessageID)
	if err != nil {
		// Handle error
		return err
	}

	if delivered {
		fmt.Printf("Message already delivered: %s\n", teleporterMessageID.String())
		return nil //already delivered
	}

	//deliver message
	signed, err := t.aggWrapper.Sign(context.TODO(), unsignedMsg)
	if err != nil {
		return fmt.Errorf("failed to sign message: %w", err)
	}

	callData, err := teleportermessenger.PackReceiveCrossChainMessage(
		0,
		common.Address{},
	)
	if err != nil {
		return fmt.Errorf("failed to pack receive cross chain message: %w", err)
	}

	// Get the current base fee estimation, which is based on the previous blocks gas usage.
	baseFee, err := t.destEthClient.EstimateBaseFee(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get base fee: %w", err)
	}

	// Get the suggested gas tip cap of the network
	// TODO: Add a configurable ceiling to this value
	gasTipCap, err := t.destEthClient.SuggestGasTipCap(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get gas tip cap: %w", err)
	}

	to := common.HexToAddress(TELEPORTER_MESSENGER_ADDRESS)
	gasFeeCap := baseFee.Mul(baseFee, big.NewInt(BaseFeeFactor))
	gasFeeCap.Add(gasFeeCap, big.NewInt(MaxPriorityFeePerGas))

	gasLimit := uint64(1000000)

	signer, nonce, releaseFunc, err := t.signerCattle.GetNextSigner()
	defer releaseFunc()
	if err != nil {
		return fmt.Errorf("failed to get signer: %w", err)
	}

	// Construct the actual transaction to broadcast on the destination chain
	tx := predicateutils.NewPredicateTx(
		t.destEvmChainID,
		nonce,
		&to,
		gasLimit,
		gasFeeCap,
		gasTipCap,
		big.NewInt(0),
		callData,
		types.AccessList{},
		warp.ContractAddress,
		signed.Bytes(),
	)

	// Sign and send the transaction on the destination chain
	signedTx, err := signer.SignTx(tx, t.destEvmChainID)
	if err != nil {
		return fmt.Errorf("failed to sign transaction: %w", err)
	}

	if err := t.destEthClient.SendTransaction(context.Background(), signedTx); err != nil {
		return fmt.Errorf("failed to send transaction: %w", err)
	}

	// Wait for the transaction to be mined
	fmt.Printf("Waiting for transaction %s to be mined...\n", signedTx.Hash().Hex())
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	receipt, err := t.destEthClient.TransactionReceipt(ctx, signedTx.Hash())
	if err != nil {
		return fmt.Errorf("failed while waiting for transaction: %w", err)
	}

	if receipt.Status == types.ReceiptStatusFailed {
		return fmt.Errorf("transaction failed: %s", signedTx.Hash().Hex())
	}

	fmt.Printf("Transaction mined successfully in block %d\n", receipt.BlockNumber.Uint64())
	return nil
}

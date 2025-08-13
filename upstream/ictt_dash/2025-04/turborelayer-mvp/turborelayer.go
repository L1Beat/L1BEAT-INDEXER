package main

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ava-labs/avalanchego/ids"
	avalancheWarp "github.com/ava-labs/avalanchego/vms/platformvm/warp"
	teleportermessenger "github.com/ava-labs/icm-contracts/abi-bindings/go/teleporter/TeleporterMessenger"
	"github.com/ava-labs/subnet-evm/ethclient"
	"github.com/containerman17/experiments/2025-04/turborelayer-mvp/aggregator"
	"github.com/ethereum/go-ethereum/common"
)

type TurboRelayerMVP struct {
	aggWrapper              *aggregator.AggregatorWrapper
	sourceEthClient         ethclient.Client
	destEthClient           ethclient.Client
	destTeleporterMessenger *teleportermessenger.TeleporterMessenger
	destChainIDStr          string
	destEvmChainID          *big.Int
	signerCattle            *SignerCattle
	txTimeout               time.Duration
}

func CreateTurboRelayerMVP(sourceSubnetID ids.ID, sourceRPCURL string, destChainID string, destRPCURL string, rootPrivateKey string) (*TurboRelayerMVP, error) {
	// Initialize Aggregator Wrapper
	aggWrapper, err := aggregator.NewAggregatorWrapper(sourceSubnetID)
	if err != nil {
		return nil, fmt.Errorf("Error creating aggregator wrapper: %v\n", err)
	}

	sourceEthClient, err := ethclient.DialContext(context.TODO(), sourceRPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC endpoint: %v\n", err)
	}

	destEthClient, err := ethclient.DialContext(context.TODO(), destRPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC endpoint: %v\n", err)
	}

	destTeleporterMessenger, err := teleportermessenger.NewTeleporterMessenger(common.HexToAddress(TELEPORTER_MESSENGER_ADDRESS), destEthClient)
	if err != nil {
		return nil, fmt.Errorf("failed to create teleporter messenger: %v\n", err)
	}

	destEvmChainID, err := destEthClient.ChainID(context.TODO())
	if err != nil {
		return nil, fmt.Errorf("failed to get chain ID: %v\n", err)
	}

	signerCattle, err := NewSignerCattle(rootPrivateKey, destEthClient)
	if err != nil {
		return nil, fmt.Errorf("failed to create signer cattle: %v\n", err)
	}

	return &TurboRelayerMVP{
		aggWrapper:              aggWrapper,
		sourceEthClient:         sourceEthClient,
		destEthClient:           destEthClient,
		destTeleporterMessenger: destTeleporterMessenger,
		destChainIDStr:          destChainID,
		destEvmChainID:          destEvmChainID,
		signerCattle:            signerCattle,
		txTimeout:               5 * time.Minute, // Default timeout for transaction confirmation
	}, nil
}

func (t *TurboRelayerMVP) handleBlock(blockNumber *big.Int) (int, int) {
	successCount := 0
	failureCount := 0

	messages, err := retry(func() ([]*avalancheWarp.UnsignedMessage, error) {
		return parseBlockWarps(context.TODO(), blockNumber, t.sourceEthClient)
	}, 3)
	if err != nil {
		fmt.Printf("Error parsing block %s: %v\n", blockNumber.String(), err)
		return 0, 0
	}

	if len(messages) == 0 {
		return 0, 0
	}

	for _, msg := range messages {
		err := t.deliverMessage(msg)
		if err != nil {
			failureCount++
			fmt.Printf("Error delivering message: %v\n", err)
		} else {
			successCount++
		}
	}

	return successCount, failureCount
}

func retry[T any](fn func() (T, error), attempts int) (T, error) {
	var result T
	var err error
	for i := 0; i < attempts; i++ {
		result, err = fn()
		if err == nil {
			return result, nil
		}
		if i < attempts-1 {
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}
	return result, fmt.Errorf("failed to execute function after %d attempts", attempts)
}

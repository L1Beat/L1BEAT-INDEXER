package main

import (
	"context"
	"fmt"
	"math/big"

	avalancheWarp "github.com/ava-labs/avalanchego/vms/platformvm/warp"
	"github.com/ava-labs/icm-services/types"
	"github.com/ava-labs/subnet-evm/ethclient"
	"github.com/ava-labs/subnet-evm/interfaces"
	subnetWarp "github.com/ava-labs/subnet-evm/precompile/contracts/warp"
	"github.com/ethereum/go-ethereum/common"
)

var WarpPrecompileLogFilter = subnetWarp.WarpABI.Events["SendWarpMessage"].ID

func parseBlockWarps(ctx context.Context, blockNumber *big.Int, client ethclient.Client) ([]*avalancheWarp.UnsignedMessage, error) {
	query := interfaces.FilterQuery{
		FromBlock: blockNumber,
		ToBlock:   blockNumber,
		Addresses: []common.Address{subnetWarp.ContractAddress},
		Topics:    [][]common.Hash{{WarpPrecompileLogFilter}},
	}

	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to filter logs for block %d: %w", blockNumber, err)
	}

	var unsignedMessages []*avalancheWarp.UnsignedMessage
	for _, l := range logs {
		if len(l.Topics) == 0 || l.Topics[0] != WarpPrecompileLogFilter || l.Address != subnetWarp.ContractAddress {
			continue
		}

		unsignedMsg, err := types.UnpackWarpMessage(l.Data)
		if err != nil {
			continue // Skip if basic warp message parsing fails
		}

		unsignedMessages = append(unsignedMessages, unsignedMsg)
	}

	return unsignedMessages, nil
}

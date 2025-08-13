package main

import (
	"context"
	"fmt"
	"math/big"
	"os"

	"github.com/ava-labs/avalanchego/ids"
	"github.com/ava-labs/subnet-evm/ethclient"
)

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func main() {
	sourceSubnetID, err := ids.FromString(SOURCE_SUBNET)
	if err != nil {
		fmt.Printf("Error converting source subnet ID: %v\n", err)
		os.Exit(1)
	}

	relayer, err := CreateTurboRelayerMVP(sourceSubnetID, SOURCE_RPC_URL, DEST_CHAIN, DEST_RPC_URL, ROOT_PRIVATE_KEY)
	if err != nil {
		fmt.Printf("Error creating turbo relayer: %v\n", err)
		os.Exit(1)
	}

	client := must(ethclient.DialContext(context.TODO(), SOURCE_RPC_URL))
	defer client.Close()
	endBlock := must(client.BlockNumber(context.TODO()))

	successCount := 0
	failureCount := 0
	for blockNum := 5279; blockNum <= int(endBlock); blockNum++ {
		success, failure := relayer.handleBlock(big.NewInt(int64(blockNum)))
		successCount += success
		failureCount += failure

		if success+failure > 0 {
			fmt.Printf("Processed block %d with %d successes and %d failures\n", blockNum, success, failure)
		}

		// if successCount+failureCount > 5 {
		// 	log.Fatalf("DEVUG TODO: Done for now. Processed %d blocks with %d successes and %d failures", successCount+failureCount, successCount, failureCount)
		// }
	}

	fmt.Printf("Finished processing all blocks: %d succeeded, %d failed\n", successCount, failureCount)
}

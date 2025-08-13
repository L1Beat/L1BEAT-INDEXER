package main

import (
	"context"
	"crypto/ecdsa"
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

var batchSize int
var keyCount int
var toAddressHex string
var dataHex string

const timeoutSeconds = 10

func main() {
	// Parse command line arguments
	flag.IntVar(&batchSize, "batch", 15, "Size of transaction batches")
	flag.IntVar(&keyCount, "keys", 600, "Number of private keys to generate")
	flag.StringVar(&toAddressHex, "to", "", "Destination address in hex (0x prefix optional)")
	flag.StringVar(&dataHex, "data", "", "Transaction data in hex (0x prefix optional)")

	var rpcUrlsArg string
	flag.StringVar(&rpcUrlsArg, "rpc", "", "Comma-separated list of RPC URLs")

	flag.Parse()

	fmt.Printf("Starting with batch size: %d, key count: %d\n", batchSize, keyCount)

	// Parse RPC URLs from command line
	var rpcUrls []string
	if rpcUrlsArg != "" {
		rpcUrls = strings.Split(rpcUrlsArg, ",")
	} else {
		// No default URLs - require user to provide them
		log.Fatal("No RPC URLs provided. Use -rpc flag to provide at least one URL.\n" +
			"Example: -rpc \"http://127.0.0.1:9650/ext/bc/chainID/rpc\"\n" +
			"Note: WebSocket endpoints (ws:// or wss://) are preferred for better performance.\n" +
			"HTTP endpoints will be automatically converted to WebSocket endpoints.")
	}

	// Filter out empty RPC URLs
	filteredUrls := make([]string, 0)
	for _, url := range rpcUrls {
		if url != "" {
			filteredUrls = append(filteredUrls, url)
		}
	}
	rpcUrls = filteredUrls

	// Check if there's at least one RPC URL
	if len(rpcUrls) == 0 {
		log.Fatal("No valid RPC URLs provided. Use -rpc flag to provide at least one URL.")
	}

	fmt.Printf("Using %d RPC URLs\n", len(rpcUrls))

	// Convert HTTP URLs to WebSocket URLs
	for i, rpcUrl := range rpcUrls {
		if strings.HasPrefix(rpcUrl, "http") {
			rpcUrl = strings.Replace(rpcUrl, "http", "ws", 1)
		}
		if strings.HasSuffix(rpcUrl, "/rpc") {
			rpcUrl = strings.Replace(rpcUrl, "/rpc", "/ws", 1)
		}
		rpcUrls[i] = rpcUrl
	}

	// Initialize clients
	clients := make([]*ethclient.Client, len(rpcUrls))
	for i, rpcUrl := range rpcUrls {
		client, err := ethclient.Dial(rpcUrl)
		if err != nil {
			log.Fatal("failed to create tx listener", "err", err, "rpcUrl: ", rpcUrl)
		}
		clients[i] = client
	}

	txListener := NewTxListener(clients)

	go txListener.Start(context.Background())

	keys := mustGenPrivateKeys(keyCount)

	err := fund(clients[0], keys, txListener, 50)
	if err != nil {
		log.Fatalf("failed to fund: %v", err)
	}

	var data []byte
	if dataHex != "" {
		data = common.FromHex(strings.TrimPrefix(dataHex, "0x"))
		fmt.Printf("Using transaction data: %x\n", data)
	}

	// Parse destination address
	var to common.Address = common.Address{}
	if toAddressHex != "" {
		// Ensure 0x prefix
		if !strings.HasPrefix(toAddressHex, "0x") {
			toAddressHex = "0x" + toAddressHex
		}
		to = common.HexToAddress(toAddressHex)
		fmt.Printf("Using destination address: %s\n", to.Hex())
	}

	clientNumber := 0
	for _, key := range keys {
		go func(key *ecdsa.PrivateKey, to common.Address) {
			clientNumber++
			bombardWithTransactions(clients[clientNumber%len(clients)], key, txListener, data, to)
		}(key, to)
		pause := 20000 / keyCount
		time.Sleep(time.Duration(pause) * time.Millisecond)
	}

	// Wait indefinitely
	select {}
}

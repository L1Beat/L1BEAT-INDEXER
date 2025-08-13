package main

import (
	"crypto/ecdsa"
	"fmt"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/tyler-smith/go-bip32"
)

func main() {
	mnemonic := strings.Repeat("apple ", 24)

	masterPrivateKey, err := bip32.NewMasterKey([]byte(mnemonic))
	if err != nil {
		fmt.Println("Error generating master private key:", err)
		return
	}

	timeStart := time.Now()
	for i := 0; i < 100; i++ {
		privateKey, address := deriveKey(masterPrivateKey, i)
		fmt.Printf("Private key: %s, Address: %s\n", privateKey, address)
	}
	timeEnd := time.Now()
	fmt.Printf("Time taken: %s\n", timeEnd.Sub(timeStart))
}

func deriveKey(masterKey *bip32.Key, index int) (*ecdsa.PrivateKey, common.Address) {
	childPrivateKey, err := masterKey.NewChildKey(uint32(index))
	if err != nil {
		fmt.Println("Error generating child private key:", err)
		return nil, common.Address{}
	}

	// Convert to ECDSA private key
	ecdaPrivateKey := crypto.ToECDSAUnsafe(childPrivateKey.Key)
	ecdaPublicKey := ecdaPrivateKey.Public().(*ecdsa.PublicKey)

	return ecdaPrivateKey, crypto.PubkeyToAddress(*ecdaPublicKey)
}

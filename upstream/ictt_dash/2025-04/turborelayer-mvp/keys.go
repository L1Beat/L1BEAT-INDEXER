package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ava-labs/icm-services/vms/evm/signer"
	"github.com/ava-labs/subnet-evm/core/types"
	"github.com/ava-labs/subnet-evm/ethclient"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/tyler-smith/go-bip32"
)

// 1 AVAX in wei
var MinBalance = new(big.Int).Mul(big.NewInt(1), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil))

type SignerCattle struct {
	masterKey *bip32.Key
	seedKey   *ecdsa.PrivateKey
	signers   []*signer.TxSigner
	mutex     sync.Mutex
	inUse     map[int]bool
	nonces    map[int]int64
	client    ethclient.Client
}

func NewSignerCattle(rootKeyHex string, client ethclient.Client) (*SignerCattle, error) {
	seedKey, err := crypto.HexToECDSA(strings.TrimPrefix(rootKeyHex, "0x"))
	if err != nil {
		return nil, err
	}

	//WARNING: Do not use this in production, bip32 was not intended to be used this way
	masterKey, err := bip32.NewMasterKey(crypto.FromECDSA(seedKey))
	if err != nil {
		return nil, err
	}

	return &SignerCattle{
		masterKey: masterKey,
		seedKey:   seedKey,
		signers:   make([]*signer.TxSigner, 0),
		inUse:     make(map[int]bool),
		nonces:    make(map[int]int64),
		client:    client,
	}, nil
}

func (s *SignerCattle) getSignerByIndex(index int) (*signer.TxSigner, error) {
	if len(s.signers) <= index {
		privateKey, _ := deriveKey(s.masterKey, index)
		if privateKey == nil {
			return nil, fmt.Errorf("failed to derive key")
		}
		signer, err := signer.NewTxSigner(hex.EncodeToString(crypto.FromECDSA(privateKey)))
		if err != nil {
			return nil, err
		}
		s.signers = append(s.signers, signer)

		// Initialize nonce to -1 to indicate it needs to be fetched
		s.nonces[index] = -1
	}

	return s.signers[index], nil
}

func (s *SignerCattle) GetNextSigner() (*signer.TxSigner, uint64, func(), error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Look for an available signer
	for i := 0; i < len(s.signers); i++ {
		if !s.inUse[i] {
			s.inUse[i] = true

			// Check if we need to fetch nonce
			if s.nonces[i] == -1 {
				if err := s.fetchNonce(i); err != nil {
					s.inUse[i] = false
					return nil, 0, nil, err
				}
			}

			nonce := uint64(s.nonces[i])
			releaseFunc := func() {
				s.ReleaseSigner(i)
			}

			return s.signers[i], nonce, releaseFunc, nil
		}
	}

	// No available signer, create a new one
	index := len(s.signers)
	fmt.Println("Creating new signer", index)
	signer, err := s.getSignerByIndex(index)
	if err != nil {
		return nil, 0, nil, err
	}

	// Fetch nonce for the new signer
	if err := s.fetchNonce(index); err != nil {
		return nil, 0, nil, err
	}

	// Check the balance of the new signer and fund it if necessary
	signerAddr := signer.Address()
	balance, err := s.client.BalanceAt(context.Background(), signerAddr, nil)
	if err != nil {
		return nil, 0, nil, fmt.Errorf("failed to get balance: %w", err)
	}

	// If balance is below minimum, transfer funds from seedKey
	if balance.Cmp(MinBalance) < 0 {
		// Transfer minBalance*2
		transferAmount := new(big.Int).Mul(MinBalance, big.NewInt(2))
		if err := s.transferFunds(signerAddr, transferAmount); err != nil {
			return nil, 0, nil, fmt.Errorf("failed to fund new signer: %w", err)
		}
	}

	s.inUse[index] = true
	nonce := uint64(s.nonces[index])
	releaseFunc := func() {
		s.ReleaseSigner(index)
	}

	return signer, nonce, releaseFunc, nil
}

func (s *SignerCattle) fetchNonce(index int) error {
	addr := s.signers[index].Address()
	nonce, err := s.client.NonceAt(context.Background(), addr, nil)
	if err != nil {
		return err
	}

	s.nonces[index] = int64(nonce)
	return nil
}

func (s *SignerCattle) ReleaseSigner(index int) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if index >= 0 && index < len(s.signers) {
		s.inUse[index] = false
		// Increment nonce after use
		if s.nonces[index] != -1 {
			s.nonces[index]++
		}
	}
}

func (s *SignerCattle) ResetNonce(index int) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if index >= 0 && index < len(s.signers) {
		s.nonces[index] = -1
	}
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

// transferFunds sends the specified amount from seedKey to the target address
func (s *SignerCattle) transferFunds(to common.Address, amount *big.Int) error {
	ctx := context.Background()

	// Get nonce for seed key
	seedAddr := crypto.PubkeyToAddress(s.seedKey.PublicKey)
	nonce, err := s.client.NonceAt(ctx, seedAddr, nil)
	if err != nil {
		return err
	}

	// Get chain ID
	chainID, err := s.client.ChainID(ctx)
	if err != nil {
		return err
	}

	// Get gas price
	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		return err
	}

	// Create transaction
	tx := types.NewTransaction(
		nonce,
		to,
		amount,
		21000, // standard gas limit for transfers
		gasPrice,
		nil, // no data for simple transfers
	)

	// Sign transaction
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), s.seedKey)
	if err != nil {
		return err
	}

	// Send transaction
	err = s.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return err
	}

	return waitForTransaction(s.client, signedTx.Hash())
}

func waitForTransaction(client ethclient.Client, hash common.Hash) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for {
		receipt, err := client.TransactionReceipt(ctx, hash)
		if err != nil {
			if err.Error() == "not found" {
				// Transaction not mined yet, continue waiting
				time.Sleep(1 * time.Second)
				continue
			}
			return fmt.Errorf("failed while waiting for transaction: %w", err)
		}
		if receipt.Status == types.ReceiptStatusFailed {
			return fmt.Errorf("transaction failed: %s", hash.Hex())
		}
		if receipt.BlockNumber != nil {
			return nil
		}
		time.Sleep(1 * time.Second)
	}
}

import { encodeLazyBlock, LazyBlock, lazyBlockToBlock } from "./LazyBlock";
import { RpcBlock, RpcTxReceipt, RpcTraceResult } from "../evmTypes";
import assert from "assert";
import test from "node:test";
import { encodeLazyTx, LazyTx, lazyTxToReceipt } from "./LazyTx";
import { encodeLazyTraces, lazyTraceToTrace, LazyTraces } from "./LazyTrace";
import { LazyTrace } from "./LazyTrace";

const preCancunBlock: RpcBlock =
{
    "baseFeePerGas": "0x5d21dba00",
    "blobGasUsed": "0x0",
    "blockGasCost": "0x0",
    "difficulty": "0x1",
    "excessBlobGas": "0x0",
    "extraData": "0x0fff000fff",//shortened for brevity
    "gasLimit": "0xe4e1c0",
    "gasUsed": "0x5208",
    "hash": "0x203fbcf52fbc44d38f08e5653b4846d516501b0a71e5bf9efa8d86b892ab8a8d",
    "logsBloom": "0x1234567890abcdef",//shortened for brevity
    "miner": "0x0100000000000000000000000000000000000000",
    "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "nonce": "0x0000000000000000",
    "number": "0x3",
    "parentBeaconBlockRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "parentHash": "0x10889bdeac8c048618c3096d0591e62c55a780af590a4a253fccc40d72b7807c",
    "receiptsRoot": "0x056b23fbba480696b65fe5a59b8f2148a1299103c4f57df839233af2cf4ca2d2",
    "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    "size": "0x2ea",
    "stateRoot": "0x0c39c74c082029e023698ba17167ef77c92fd535084eea91d432288727b57d75",
    "timestamp": "0x67dbec6d",
    "totalDifficulty": "0x3",
    "transactions": [
        {
            "blockHash": "0x203fbcf52fbc44d38f08e5653b4846d516501b0a71e5bf9efa8d86b892ab8a8d",
            "blockNumber": "0x3",
            "from": "0xb235b4e38d3843550c352c44f7b300c33fb3bf08",
            "gas": "0x5208",
            "gasPrice": "0x34630b8a00",
            "hash": "0x6a3e3765260cc511acd7b573689a1537f2b7e3ea5b25907268de5ad6ef86f550",
            "input": "0x",
            "nonce": "0x2",
            "to": "0xb235b4e38d3843550c352c44f7b300c33fb3bf08",
            "transactionIndex": "0x0",
            "value": "0x1",
            "type": "0x0",
            "chainId": "0x134fed0",
            "v": "0x269fdc3",
            "r": "0x9cbd4f87517e3495e672f7460b5a522e32e49c996f6f2ac9ae5d722ed42092aa",
            "s": "0xc88fdb78ad09446bb4c2efca82ae8663066cd1eb8355272ad2ee384244be35b"
        }
    ],
    "transactionsRoot": "0x409acd628c1381dfa2f9d3bc6d0c3bfc5b6b19f845c6fafe633c7a20f886e768",
    "uncles": []
}

const postCancunBlock: RpcBlock = {
    "baseFeePerGas": "0x5d21dba00",
    "blobGasUsed": "0x0",
    "blockGasCost": "0x30d40",
    "difficulty": "0x1",
    "excessBlobGas": "0x0",
    "extraData": "0x000000000000000000000000000b39a400000000",//shortened for brevity
    "gasLimit": "0xe4e1c0",
    "gasUsed": "0xdb8f0",
    "hash": "0x96fd20872ca10d6fecd910cf204c09d6027ce09fb9315db854aac4b49f27402c",
    "logsBloom": "0x30c0000010000000800000080000204100000000000408010000000000",//shortened for brevity
    "miner": "0x0100000000000000000000000000000000000000",
    "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "nonce": "0x0000000000000000",
    "number": "0x312705",
    "parentBeaconBlockRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "parentHash": "0xbc99db9a136e34ca558951d4a5d3ab1e8456d071957d9eea1d3020c685b36d03",
    "receiptsRoot": "0xa6cd3b6c20b65ee807d6d63ea57f138322b12990a961c2701b5e31058b5ec93e",
    "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    "size": "0xc80",
    "stateRoot": "0xcc80a3b28d0d136c5b8be3aa4a79b5d6dd15ac8fd52b331e9514ef12df62ee57",
    "timestamp": "0x685e0d2e",
    "totalDifficulty": "0x312705",
    "transactions": [
        {
            "blockHash": "0x96fd20872ca10d6fecd910cf204c09d6027ce09fb9315db854aac4b49f27402c",
            "blockNumber": "0x312705",
            "from": "0xc053dd2c75a69aff67290ebe201cebbca925e8dc",
            "gas": "0x249f0",
            "gasPrice": "0x826299e00",
            "hash": "0xe90d4049a0ecf26cac310b6c758c65a66efee9343e6c3f7e89d1b5be177427ea",
            "input": "0xa9059cbb00000000000000000000000054c7b6d0cce7c2c54d9cbbad501b731d5f6fc0520000000000000000000000000000000000000000000000008ac7230489e80000",
            "nonce": "0x9231c",
            "to": "0xf6a6d210e45930b81d5ad6fd3dfe2ed30f3b8e72",
            "transactionIndex": "0x12",
            "value": "0x0",
            "type": "0x0",
            "chainId": "0x134fed0",
            "v": "0x269fdc4",
            "r": "0x60960d6bb828af277514acdcd1e6adbd94afaf85d695e6cc06d682d11b29b89",
            "s": "0x27dd7a0d20a2bb34aa0d7e77d3d8d78ebb1ecae4bccb17b30af68e53938efa85"
        },
    ],
    "transactionsRoot": "0xb9f32b54d1a9b5ce805735835926992908807a51076b66c414e47b7e624da3c3",
    "uncles": []
}

const preCancunReceipt: RpcTxReceipt = {
    "blockHash": "0x203fbcf52fbc44d38f08e5653b4846d516501b0a71e5bf9efa8d86b892ab8a8d",
    "blockNumber": "0x3",
    "contractAddress": null,
    "cumulativeGasUsed": "0x5208",
    "effectiveGasPrice": "0x34630b8a00",
    "from": "0xb235b4e38d3843550c352c44f7b300c33fb3bf08",
    "gasUsed": "0x5208",
    "logs": [],
    "logsBloom": "0x0000000000000000000000",//shortened for brevity
    "status": "0x1",
    "to": "0xb235b4e38d3843550c352c44f7b300c33fb3bf08",
    "transactionHash": "0x6a3e3765260cc511acd7b573689a1537f2b7e3ea5b25907268de5ad6ef86f550",
    "transactionIndex": "0x0",
    "type": "0x0"
}
const postCancunReceipt: RpcTxReceipt = {
    "blockHash": "0x96fd20872ca10d6fecd910cf204c09d6027ce09fb9315db854aac4b49f27402c",
    "blockNumber": "0x312705",
    "contractAddress": null,
    "cumulativeGasUsed": "0xcdc7c",
    "effectiveGasPrice": "0x826299e00",
    "from": "0xc053dd2c75a69aff67290ebe201cebbca925e8dc",
    "gasUsed": "0x86d8",
    "logs": [
        {
            "address": "0xf6a6d210e45930b81d5ad6fd3dfe2ed30f3b8e72",
            "topics": [
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                "0x000000000000000000000000c053dd2c75a69aff67290ebe201cebbca925e8dc",
                "0x00000000000000000000000054c7b6d0cce7c2c54d9cbbad501b731d5f6fc052"
            ],
            "data": "0x0000000000000000000000000000000000000000000000008ac7230489e80000",
            "blockNumber": "0x312705",
            "transactionHash": "0xe90d4049a0ecf26cac310b6c758c65a66efee9343e6c3f7e89d1b5be177427ea",
            "transactionIndex": "0x12",
            "blockHash": "0x96fd20872ca10d6fecd910cf204c09d6027ce09fb9315db854aac4b49f27402c",
            "logIndex": "0xe",
            "removed": false
        }
    ],
    "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000010",//shortened for brevity
    "status": "0x1",
    "to": "0xf6a6d210e45930b81d5ad6fd3dfe2ed30f3b8e72",
    "transactionHash": "0xe90d4049a0ecf26cac310b6c758c65a66efee9343e6c3f7e89d1b5be177427ea",
    "transactionIndex": "0x12",
    "type": "0x0"
}

const lazyTrace: RpcTraceResult[] = [
    {
        "txHash": "0x38a63c299e76bca44acbeadc828a96d82be96497d1236fe756e5ba4f074cf126",
        "result": {
            "from": "0x90cd26d481d3b756c4134647235c3e1b4547af30",
            "gas": "0x113b9b",
            "gasUsed": "0xf5ce9",
            "to": "0x2ea363d4e8b7efe5270f744a1ce4d39b9c3038dd",
            "input": "0x0bc0abeb",
            "calls": [
                {
                    "from": "0x2ea363d4e8b7efe5270f744a1ce4d39b9c3038dd",
                    "gas": "0x10616e",
                    "gasUsed": "0xec527",
                    "to": "0xc033ee7dca293cdf9e8600840d54106fdec3ca67",
                    "input": "0x0bc0abeb30000000000000000000000004ac6378f60b624db304d1fd0691",
                    "calls": [
                        {
                            "from": "0x2ea363d4e8b7efe5270f744a1ce4d39b9c3038dd",
                            "gas": "0xfd6fc",
                            "gasUsed": "0x250b4",
                            "to": "0xf2ea2c5d75e30e4a1a25862968d4a1b0086fb50b",
                            "input": "0x008598df00000000000000000000000004ac6378f60b624db304d1fd",
                            "value": "0x0",
                            "type": "CALL",
                        },
                        {
                            "from": "0x2ea363d4e8b7efe5270f744a1ce4d39b9c3038dd",
                            "gas": "0xd6b17",
                            "gasUsed": "0x246f0",
                            "to": "0xd705090af5d33c50b6e7d787b11aeb717da7f21e",
                            "input": "0x008598df00000000000000000000000004ac",
                            "value": "0x0",
                            "type": "CALL",
                            "calls": [],
                        },
                    ],
                    "value": "0x0",
                    "type": "DELEGATECALL"
                }
            ],
            "value": "0x0",
            "type": "CALL"
        }
    }
]

test("lazy block encode decode - pre cancun", () => {
    const lazyBlockData = encodeLazyBlock(preCancunBlock);
    const lazyTxData = encodeLazyTx(preCancunBlock.transactions[0]!, preCancunReceipt);
    const block = lazyBlockToBlock(new LazyBlock(lazyBlockData), [new LazyTx(lazyTxData)]);
    const receipt = lazyTxToReceipt(new LazyTx(lazyTxData));
    assert.deepStrictEqual(block, preCancunBlock);
    assert.deepStrictEqual(receipt, preCancunReceipt);
});

test("lazy block encode decode - post cancun", () => {
    const lazyBlock = encodeLazyBlock(postCancunBlock);
    const lazyTxData = encodeLazyTx(postCancunBlock.transactions[0]!, postCancunReceipt);
    const block = lazyBlockToBlock(new LazyBlock(lazyBlock), [new LazyTx(lazyTxData)]);
    const receipt = lazyTxToReceipt(new LazyTx(lazyTxData));
    assert.deepStrictEqual(block, postCancunBlock);
    assert.deepStrictEqual(receipt, postCancunReceipt);
});

test("lazy trace encode decode", () => {
    const lazyTracesData = encodeLazyTraces(lazyTrace);
    const lazyTraces = new LazyTraces(lazyTracesData);
    const traces = lazyTraces.traces.map(lazyTrace => lazyTraceToTrace(lazyTrace));
    assert.deepStrictEqual(traces, lazyTrace);
}); 

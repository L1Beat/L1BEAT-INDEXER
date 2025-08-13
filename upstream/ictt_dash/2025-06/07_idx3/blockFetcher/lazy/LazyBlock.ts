// LazyBlock.ts
import { RLP } from '@ethereumjs/rlp'
import { bytesToHex } from '@noble/curves/abstract/utils'
import { RpcBlock } from '../evmTypes'
import { IS_DEVELOPMENT } from '../../config'
import { LazyTx, lazyTxToTx } from './LazyTx'

//we treat RLP_EMPTY_LIST_BYTE as an absent value
const BLOCK_SIG_V1 = 0x01 as const

const RLP_EMPTY_LIST_BYTE = RLP.encode(new Uint8Array())[0]

export const deserializeOptionalHex = (b: Uint8Array | undefined): string | undefined => {
    if (!b || b.length === 0) return undefined
    // Check if it's exactly [0xc0] (empty RLP list)
    if (b.length === 1 && b[0] === RLP_EMPTY_LIST_BYTE) return undefined
    return deserializeHex(b)
}


const deserializeOptionalFixedHex = (b: Uint8Array | undefined): string | undefined => {
    if (!b || b.length === 0) return undefined
    // Check if it's exactly [0xc0] (empty RLP list)
    if (b.length === 1 && b[0] === RLP_EMPTY_LIST_BYTE) return undefined
    return deserializeFixedHex(b)
}


export const deserializeNumber = (b: Uint8Array) => {
    if (!b) throw new Error('Missing required field')
    let n = 0n
    for (const byte of b) n = (n << 8n) | BigInt(byte)
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('overflow')
    return Number(n)
}

const compactBytesToHex = (b: Uint8Array) => {
    const result = bytesToHex(b)
    if (result[0] === '0') return result.slice(1)
    return result
}

export const deserializeHex = (b: Uint8Array) => {
    if (!b) throw new Error('Missing required field')
    if (b.length === 0) return '0x0'
    // Remove leading zeros but keep at least one digit
    let start = 0
    while (start < b.length - 1 && b[start] === 0) start++
    return '0x' + compactBytesToHex(b.slice(start))
}

export const deserializeFixedHex = (b: Uint8Array) => {
    if (!b) throw new Error('Missing required field')
    const result = '0x' + bytesToHex(b)
    return result
}

export class LazyBlock {
    private parts: readonly Uint8Array[]

    constructor(private blob: Uint8Array) {
        if (blob[0] !== BLOCK_SIG_V1) throw new Error('bad sig')
        // skip sig (1 byte) – cheap, produces views not copies
        this.parts = RLP.decode(blob.subarray(1)) as Uint8Array[]
    }

    /* lazy-cached getters */
    #hash?: string
    get hash() {
        return this.#hash ??= deserializeFixedHex(this.parts[0]!)
    }

    #number?: number
    get number() {
        return this.#number ??= deserializeNumber(this.parts[1]!)
    }

    #parentHash?: string
    get parentHash() {
        return this.#parentHash ??= deserializeFixedHex(this.parts[2]!)
    }

    #timestamp?: number
    get timestamp() {
        return this.#timestamp ??= deserializeNumber(this.parts[3]!)
    }

    #gasLimit?: string
    get gasLimit() {
        return this.#gasLimit ??= deserializeHex(this.parts[4]!)
    }

    #gasUsed?: string
    get gasUsed() {
        return this.#gasUsed ??= deserializeHex(this.parts[5]!)
    }

    #baseFeePerGas?: string
    get baseFeePerGas() {
        return this.#baseFeePerGas ??= deserializeHex(this.parts[6]!)
    }

    #miner?: string
    get miner() {
        return this.#miner ??= deserializeFixedHex(this.parts[7]!)
    }

    #difficulty?: string
    get difficulty() {
        return this.#difficulty ??= deserializeHex(this.parts[8]!)
    }

    #totalDifficulty?: string
    get totalDifficulty() {
        return this.#totalDifficulty ??= deserializeHex(this.parts[9]!)
    }

    #size?: string
    get size() {
        return this.#size ??= deserializeHex(this.parts[10]!)
    }

    #stateRoot?: string
    get stateRoot() {
        return this.#stateRoot ??= deserializeFixedHex(this.parts[11]!)
    }

    #transactionsRoot?: string
    get transactionsRoot() {
        return this.#transactionsRoot ??= deserializeFixedHex(this.parts[12]!)
    }

    #receiptsRoot?: string
    get receiptsRoot() {
        return this.#receiptsRoot ??= deserializeFixedHex(this.parts[13]!)
    }

    #logsBloom?: string
    get logsBloom() {
        return this.#logsBloom ??= deserializeFixedHex(this.parts[14]!)
    }

    #extraData?: string
    get extraData() {
        return this.#extraData ??= deserializeFixedHex(this.parts[15]!)
    }

    #mixHash?: string
    get mixHash() {
        return this.#mixHash ??= deserializeFixedHex(this.parts[16]!)
    }

    #nonce?: string
    get nonce() {
        return this.#nonce ??= deserializeFixedHex(this.parts[17]!)
    }

    #sha3Uncles?: string
    get sha3Uncles() {
        return this.#sha3Uncles ??= deserializeFixedHex(this.parts[18]!)
    }

    #uncles?: string[]
    get uncles() {
        if (this.#uncles) return this.#uncles
        const unclesPart = this.parts[19] as unknown as Uint8Array[]
        return this.#uncles = unclesPart.map(uncle => deserializeFixedHex(uncle))
    }

    #transactionCount?: number
    get transactionCount() {
        if (this.#transactionCount !== undefined) return this.#transactionCount
        return this.#transactionCount = deserializeNumber(this.parts[20]!)
    }

    #blobGasUsed?: string | undefined
    get blobGasUsed() {
        if (this.#blobGasUsed !== undefined) return this.#blobGasUsed
        return this.#blobGasUsed = deserializeOptionalHex(this.parts[21])
    }

    #excessBlobGas?: string | undefined
    get excessBlobGas() {
        if (this.#excessBlobGas !== undefined) return this.#excessBlobGas
        return this.#excessBlobGas = deserializeOptionalHex(this.parts[22])
    }

    #parentBeaconBlockRoot?: string | undefined
    get parentBeaconBlockRoot() {
        if (this.#parentBeaconBlockRoot !== undefined) return this.#parentBeaconBlockRoot
        const result = this.#parentBeaconBlockRoot = deserializeOptionalFixedHex(this.parts[23])
        return result
    }

    #blockGasCost?: string | undefined
    get blockGasCost() {
        if (this.#blockGasCost !== undefined) return this.#blockGasCost
        return this.#blockGasCost = deserializeOptionalHex(this.parts[24])
    }

    /* if you ever need full RLP again */
    raw() {
        return this.blob
    }
}

/* ── encoder ─────────────────────────────────────────────── */
export const encodeLazyBlock = (i: RpcBlock): Uint8Array => {
    if (IS_DEVELOPMENT) {
        // Validate no unused fields
        const expectedFields = new Set([
            'hash', 'number', 'parentHash', 'timestamp', 'gasLimit', 'gasUsed',
            'baseFeePerGas', 'miner', 'difficulty', 'totalDifficulty', 'size',
            'stateRoot', 'transactionsRoot', 'receiptsRoot', 'logsBloom',
            'extraData', 'mixHash', 'nonce', 'sha3Uncles', 'uncles', 'transactions'
        ])

        const optionalFields = new Set([
            'blobGasUsed', 'excessBlobGas', 'parentBeaconBlockRoot', 'blockGasCost'
        ])

        const actualFields = new Set(Object.keys(i))
        const unusedFields = [...actualFields].filter(field => !expectedFields.has(field) && !optionalFields.has(field))

        if (unusedFields.length > 0) {
            throw new Error(`encodeLazyBlock development: Unused fields in block: ${unusedFields.join(', ')}`)
        }

        for (const field of expectedFields) {
            if (i[field as keyof RpcBlock] === undefined && !optionalFields.has(field)) {
                throw new Error(`encodeLazyBlock development: Missing field: ${field}`)
            }
        }
    }

    const data = [
        i.hash,
        i.number,
        i.parentHash,
        i.timestamp,
        i.gasLimit,
        i.gasUsed,
        i.baseFeePerGas,
        i.miner,
        i.difficulty,
        i.totalDifficulty,
        i.size,
        i.stateRoot,
        i.transactionsRoot,
        i.receiptsRoot,
        i.logsBloom,
        i.extraData,
        i.mixHash,
        i.nonce,
        i.sha3Uncles,
        i.uncles,
        i.transactions.length,
        i.blobGasUsed || new Uint8Array(),
        i.excessBlobGas || new Uint8Array(),
        i.parentBeaconBlockRoot || new Uint8Array(),
        i.blockGasCost || new Uint8Array()
    ]

    const rlp = RLP.encode(data)
    const out = new Uint8Array(1 + rlp.length)
    out[0] = BLOCK_SIG_V1
    out.set(rlp, 1)
    return out
}

export function lazyBlockToBlock(lazyBlock: LazyBlock, transactions: LazyTx[]): RpcBlock {
    return {
        hash: lazyBlock.hash,
        number: '0x' + lazyBlock.number.toString(16),
        parentHash: lazyBlock.parentHash,
        timestamp: '0x' + lazyBlock.timestamp.toString(16),
        gasLimit: lazyBlock.gasLimit,
        gasUsed: lazyBlock.gasUsed,
        baseFeePerGas: lazyBlock.baseFeePerGas,
        miner: lazyBlock.miner,
        difficulty: lazyBlock.difficulty,
        totalDifficulty: lazyBlock.totalDifficulty,
        size: lazyBlock.size,
        stateRoot: lazyBlock.stateRoot,
        transactionsRoot: lazyBlock.transactionsRoot,
        receiptsRoot: lazyBlock.receiptsRoot,
        logsBloom: lazyBlock.logsBloom,
        extraData: lazyBlock.extraData,
        mixHash: lazyBlock.mixHash,
        nonce: lazyBlock.nonce,
        sha3Uncles: lazyBlock.sha3Uncles,
        uncles: lazyBlock.uncles,
        transactions: transactions.map(tx => lazyTxToTx(tx)),
        ...(lazyBlock.blobGasUsed !== undefined && { blobGasUsed: lazyBlock.blobGasUsed }),
        ...(lazyBlock.excessBlobGas !== undefined && { excessBlobGas: lazyBlock.excessBlobGas }),
        ...(lazyBlock.parentBeaconBlockRoot !== undefined && { parentBeaconBlockRoot: lazyBlock.parentBeaconBlockRoot }),
        ...(lazyBlock.blockGasCost !== undefined && { blockGasCost: lazyBlock.blockGasCost }),
    }
}       

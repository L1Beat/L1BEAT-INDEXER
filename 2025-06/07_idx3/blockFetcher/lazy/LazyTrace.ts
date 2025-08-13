import { RLP } from "@ethereumjs/rlp"
import type { RpcTraceResult, RpcTraceCall } from "../evmTypes";
import { TRACE_CALL_TYPES } from "../evmTypes";
import { IS_DEVELOPMENT } from '../../config'
import { deserializeFixedHex, deserializeHex } from "./LazyBlock"

const TRACE_SIG_V1 = 0x01 as const

export class LazyTraceCall {
    constructor(private callData: Uint8Array[]) { }

    #from?: string
    get from() {
        if (!this.callData[0]) throw new Error('Missing call from data')
        return this.#from ??= deserializeFixedHex(this.callData[0])
    }

    #gas?: string
    get gas() {
        if (!this.callData[1]) throw new Error('Missing call gas data')
        return this.#gas ??= deserializeHex(this.callData[1])
    }

    #gasUsed?: string
    get gasUsed() {
        if (!this.callData[2]) throw new Error('Missing call gasUsed data')
        return this.#gasUsed ??= deserializeHex(this.callData[2])
    }

    #to?: string
    get to() {
        if (!this.callData[3]) throw new Error('Missing call to data')
        return this.#to ??= deserializeFixedHex(this.callData[3])
    }

    #input?: string
    get input() {
        if (!this.callData[4]) throw new Error('Missing call input data')
        return this.#input ??= deserializeFixedHex(this.callData[4])
    }

    #value?: string
    get value() {
        if (!this.callData[5]) throw new Error('Missing call value data')
        return this.#value ??= deserializeHex(this.callData[5])
    }

    #type?: (typeof TRACE_CALL_TYPES)[number]
    get type() {
        if (!this.callData[6]) throw new Error('Missing call type data')
        if (this.#type) return this.#type
        const typeIndex = this.callData[6][0]
        if (typeIndex === undefined) {
            throw new Error('Invalid trace call type data')
        }
        if (typeIndex >= TRACE_CALL_TYPES.length) {
            throw new Error(`Invalid trace call type index: ${typeIndex}`)
        }
        return this.#type = TRACE_CALL_TYPES[typeIndex]!
    }

    #calls?: LazyTraceCall[] | undefined
    get calls() {
        if (this.#calls !== undefined) return this.#calls
        if (!this.callData[7]) throw new Error('Missing call calls data')
        const callsPart = this.callData[7]
        // If RLP decoded to Uint8Array (empty string), no calls property existed
        if (callsPart instanceof Uint8Array) {
            return this.#calls = undefined
        }
        // If RLP decoded to array, calls property existed (empty or populated)
        const callsArray = callsPart as unknown as Uint8Array[][]
        return this.#calls = callsArray.map(callData => new LazyTraceCall(callData))
    }
}

export class LazyTrace {
    private parts: readonly Uint8Array[]

    constructor(private blob: Uint8Array) {
        if (blob[0] !== TRACE_SIG_V1) throw new Error('bad sig')
        this.parts = RLP.decode(blob.subarray(1)) as Uint8Array[]
    }

    #txHash?: string
    get txHash() {
        if (!this.parts[0]) throw new Error('Missing txHash data')
        return this.#txHash ??= deserializeFixedHex(this.parts[0])
    }

    #result?: LazyTraceCall
    get result() {
        if (this.#result) return this.#result
        if (!this.parts[1]) throw new Error('Missing result data')
        const resultPart = this.parts[1] as unknown as Uint8Array[]
        return this.#result = new LazyTraceCall(resultPart)
    }

    raw() {
        return this.blob
    }
}

const encodeTraceCall = (call: RpcTraceCall): any[] => {
    const typeIndex = TRACE_CALL_TYPES.indexOf(call.type)

    if (typeIndex === -1) throw new Error(`Unknown trace call type: ${call.type}`)

    return [
        call.from,
        call.gas,
        call.gasUsed,
        call.to,
        call.input,
        call.value,
        new Uint8Array([typeIndex]),
        // Use empty string for undefined, empty array for []
        call.calls === undefined ? '' : call.calls.map(encodeTraceCall)
    ]
}

export const encodeLazyTrace = (trace: RpcTraceResult): Uint8Array => {
    if (IS_DEVELOPMENT) {
        const expectedTraceFields = new Set(['txHash', 'result'])
        const actualTraceFields = new Set(Object.keys(trace))
        const unusedTraceFields = [...actualTraceFields].filter(field => !expectedTraceFields.has(field))

        if (unusedTraceFields.length > 0) {
            throw new Error(`encodeLazyTrace development: Unused trace fields: ${unusedTraceFields.join(', ')}`)
        }
    }

    const data = [trace.txHash, encodeTraceCall(trace.result)]

    const rlp = RLP.encode(data)
    const out = new Uint8Array(1 + rlp.length)
    out[0] = TRACE_SIG_V1
    out.set(rlp, 1)
    return out
}

const lazyTraceCallToTraceCall = (lazyCall: LazyTraceCall): RpcTraceCall => {
    const result: RpcTraceCall = {
        from: lazyCall.from,
        gas: lazyCall.gas,
        gasUsed: lazyCall.gasUsed,
        to: lazyCall.to,
        input: lazyCall.input,
        value: lazyCall.value,
        type: lazyCall.type,
    }
    // Only add calls property if it's not undefined
    if (lazyCall.calls !== undefined) {
        result.calls = lazyCall.calls.map(lazyTraceCallToTraceCall)
    }
    return result
}

export function lazyTraceToTrace(lazyTrace: LazyTrace): RpcTraceResult {
    return {
        txHash: lazyTrace.txHash,
        result: lazyTraceCallToTraceCall(lazyTrace.result)
    }
}

export const encodeLazyTraces = (traces: RpcTraceResult[]): Uint8Array => {
    if (IS_DEVELOPMENT) {
        for (const trace of traces) {
            const expectedTraceFields = new Set(['txHash', 'result'])
            const actualTraceFields = new Set(Object.keys(trace))
            const unusedTraceFields = [...actualTraceFields].filter(field => !expectedTraceFields.has(field))

            if (unusedTraceFields.length > 0) {
                throw new Error(`encodeLazyTraces development: Unused trace fields: ${unusedTraceFields.join(', ')}`)
            }
        }
    }

    const data = traces.map(trace => [trace.txHash, encodeTraceCall(trace.result)])

    const rlp = RLP.encode(data)
    const out = new Uint8Array(1 + rlp.length)
    out[0] = TRACE_SIG_V1
    out.set(rlp, 1)
    return out
}

export class LazyTraces {
    private parts: readonly any[]

    constructor(private blob: Uint8Array) {
        if (blob[0] !== TRACE_SIG_V1) throw new Error('bad sig')
        this.parts = RLP.decode(blob.subarray(1)) as any[]
    }

    #traces?: LazyTrace[]
    get traces() {
        if (this.#traces) return this.#traces
        return this.#traces = this.parts.map(traceParts => {
            // Reconstruct individual trace blob
            const traceData = [traceParts[0], traceParts[1]]
            const rlp = RLP.encode(traceData)
            const out = new Uint8Array(1 + rlp.length)
            out[0] = TRACE_SIG_V1
            out.set(rlp, 1)
            return new LazyTrace(out)
        })
    }

    raw() {
        return this.blob
    }
}

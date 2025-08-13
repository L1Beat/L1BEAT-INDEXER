export const INCLUDE_GLACIER = true
if (!INCLUDE_GLACIER && !process.env.RPC_URLS) {
    throw new Error('RPC_URLS is required if INCLUDE_GLACIER is false')
}

export const RPC_URLS = process.env.RPC_URLS?.split(',') || []
export const DATA_FOLDER = process.env.DATA_FOLDER || './data'

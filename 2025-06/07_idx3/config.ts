export const IS_DEVELOPMENT = process.env['NODE_ENV'] !== 'production';
import dotenv from 'dotenv';
dotenv.config();

function requiredEnvString(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
}

function requiredEnvInt(name: string): number {
    const value = requiredEnvString(name);
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be a valid integer, got: ${value}`);
    }
    return parsed;
}

export const RPC_URL = requiredEnvString('RPC_URL');
export const CHAIN_ID = requiredEnvString('CHAIN_ID');
export const DATA_DIR = requiredEnvString('DATA_DIR');
export const RPS = requiredEnvInt('RPS');
export const REQUEST_BATCH_SIZE = requiredEnvInt('REQUEST_BATCH_SIZE');
export const MAX_CONCURRENT = requiredEnvInt('MAX_CONCURRENT');
export const BLOCKS_PER_BATCH = requiredEnvInt('BLOCKS_PER_BATCH');
export const DEBUG_RPC_AVAILABLE = requiredEnvString('DEBUG_RPC_AVAILABLE') === 'true';

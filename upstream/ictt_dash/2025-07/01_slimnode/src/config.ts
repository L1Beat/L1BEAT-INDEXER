export const ASSIGNMENT_EXPIRATION_TIME = 1000 * 60 * 5; // 5 minutes
export const SUBNETS_PER_NODE = 1;
export const MAX_NODES_PER_SUBNET = 3;
export const DATA_DIR = process.env.DATA_DIR || './data';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.NODE_COUNT) {
    console.warn('NODE_COUNT environment variable is not set, defaulting to 0');
    process.env.NODE_COUNT = '0';
}
export const NODE_COUNT = parseInt(process.env.NODE_COUNT);
if (!process.env.ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD environment variable is not set');
    process.exit(1)
}
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export const INIT_CONTAINERS_INTERVAL_MS = 30 * 1000

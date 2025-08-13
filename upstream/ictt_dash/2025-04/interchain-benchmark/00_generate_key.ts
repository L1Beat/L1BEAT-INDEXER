#!/usr/bin/env bun

import { secp256k1, utils } from "@avalabs/avalanchejs"
import * as fs from "fs"
import * as path from "path"

const key = secp256k1.randomPrivateKey();
const hex = utils.bufferToHex(key);

if (fs.existsSync(path.resolve(__dirname, "./.env"))) {
    console.log("🚨 .env file already exists, please delete it before running this script")
    process.exit(1)
}

// Write the key to .env file
const envPath = path.resolve(__dirname, "./.env");
fs.writeFileSync(envPath, `SEED_PRIVATE_KEY_HEX=${hex}\n`);

console.log(`Private key generated and saved to .env file: ${hex}`);


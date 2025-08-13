#! /usr/bin/env bun

import { evmbombardCommit, chainID, batchSize, keys } from "./00_values.ts";
import { getTerraformIps } from "./lib.ts";
import { spawnSync } from "child_process";

const cmdString = (await getTerraformIps()).map(ip => `ws://${ip}:9650/ext/bc/${chainID}/ws`).join(',')

// Instead of using Bun's $ tag, use spawnSync for better control over command execution
try {
    const args = [
        "run",
        `github.com/containerman17/experiments/2025-03/evmbombard@${evmbombardCommit}`,
        "-rpc", cmdString,
        "-batch", batchSize.toString(),
        "-keys", keys.toString()
    ]

    console.log(`go run . ${args.slice(2).join(' ')}`)

    // const result = spawnSync("/usr/local/go/bin/go", [...args], {
    //     stdio: 'inherit'
    // });

    // // Check if there was an error
    // if (result.error) {
    //     throw result.error;
    // }
} catch (e) {
    if (e && typeof e === 'object' && 'stderr' in e && e.stderr) {
        console.log((e.stderr as Buffer).toString())
    } else {
        console.log(e)
    }
}


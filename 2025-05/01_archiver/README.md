# Archiver Component

A lightweight, single-process archiver that continuously streams blockchain blocks and receipts into compressed, rotated JSONL archives.

## 1. Config Store

* **File:** `state.json`
* **Contents:** `{ "lastBlock": <number> }`
* **Purpose:** Tracks the last successfully archived block.
* **Workflow:** On startup, load `lastBlock`. After writing each block, atomically update `state.json`.

## 2. Streaming Pipeline

1. **Initialize:**

   ```js
   let current = state.lastBlock + 1;
   let blocksInBatch = 0;
   let batchStart = current;
   let out = openStream(batchStart);
   ```
2. **Fetch Loop:**

   ```js
   while (true) {
     const latest = await getBlockNumber(RPC_URL);
     while (current <= latest) {
       const block = await throttle(getBlock, [RPC_URL, current, true]);
       const receipts = await Promise.all(
         block.transactions.map(tx => throttle(getReceipt, [RPC_URL, tx.hash]))
       );
       out.write(JSON.stringify({ block, receipts }) + "\n");
       updateState(current);
       blocksInBatch++;
       current++;

       if (blocksInBatch >= 1000) rotateBatch();
     }
     await sleep(5000);
   }
   ```

### Helpers

* **`openStream(start: number)`**: returns a writable stream to `archive_<start>.jsonl.zst`, piping through `zstd -T0`.
* **`updateState(n: number)`**: sets `state.lastBlock = n` and writes `state.json`.
* **`rotateBatch()`**: closes current stream, resets `blocksInBatch = 0`, sets `batchStart = current`, and opens new stream.

## 3. File Rotation

* **Naming:** `archive_<startBlock>.jsonl.zst` (e.g. `archive_1000.jsonl.zst` contains blocks 1000–1999).
* **Rotation Trigger:** Every 1,000 blocks.

## 4. Crash Recovery

* On restart, read `state.json` → `lastBlock`; resume from `lastBlock + 1`.
* Partial writes in the active batch file are safe to truncate; completed archives are intact.

## 5. Replay Script (for indexing)

Provide a separate script to read and decompress archives in order:

```bash
for f in archive_*.jsonl.zst; do
  zstd -d < "$f" | node replay.js
done
```

## 6. Next Steps

* Add metrics (blocks/s, file sizes).
* Optionally replace `zstd` CLI with a native binding for backpressure.
* Integrate with your indexer via the replay script.

---

Built with Bun and Viem. Requires `zstd` in PATH and `RPC_URL` environment variable.

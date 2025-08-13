
let addedThisSecond = 0;
const STATS_INTERVAL = 5 * 1000;
setInterval(() => {
    console.log(`Added ${addedThisSecond / (STATS_INTERVAL / 1000)} blocks per second`);
    addedThisSecond = 0;
}, STATS_INTERVAL);

export function incrementAddedThisSecond() {
    addedThisSecond++;
}

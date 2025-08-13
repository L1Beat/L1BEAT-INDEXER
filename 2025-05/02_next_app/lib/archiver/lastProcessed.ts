export class LastProcessed {
    private lastProcessed: number;

    queue: number[] = [];

    constructor() {
        this.lastProcessed = 0;
    }

    private onIncrementedCallback: ((lastProcessed: number) => void) | null = null;
    onIncremented(callback: (lastProcessed: number) => void) {
        this.onIncrementedCallback = callback;
    }

    setLastProcessed(lastProcessed: number) {
        this.lastProcessed = lastProcessed;
    }

    reportProcessed(processed: number) {
        // If the processed number is exactly the next one, increment lastProcessed
        if (processed === this.lastProcessed + 1) {
            this.lastProcessed = processed;
            this.onIncrementedCallback?.(processed);

            // Check if we have any queued numbers that can now be processed
            this.processQueue();
        }
        // If it's a future number, add to queue
        else if (processed > this.lastProcessed + 1) {
            // Only add to queue if not already present
            if (!this.queue.includes(processed)) {
                this.queue.push(processed);
                // Sort queue to make processing sequential numbers easier
                this.queue.sort((a, b) => a - b);
            }
        }
        // Ignore if it's a number we've already processed
    }

    private processQueue() {
        let changed = true;

        // Keep processing the queue until no more changes
        while (changed) {
            changed = false;

            // Find the index of the next sequential number in queue
            const nextIndex = this.queue.findIndex(num => num === this.lastProcessed + 1);

            if (nextIndex !== -1) {
                // Update lastProcessed and remove the processed number from queue
                this.lastProcessed = this.queue[nextIndex]!;
                this.queue.splice(nextIndex, 1);
                changed = true;
                this.onIncrementedCallback?.(this.lastProcessed);
            }
        }
    }
}

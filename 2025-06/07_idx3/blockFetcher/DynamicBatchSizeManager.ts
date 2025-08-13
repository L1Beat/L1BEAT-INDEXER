const SANE_MAX_BATCH_SIZE = 500

export class DynamicBatchSizeManager {
    private minBatchSize: number;
    private currentBatchSize: number;
    private readonly decreaseRate = 0.35; // 35%
    private readonly increaseRate = 0.001; // 0.1%

    private hasErrorsThisSecond = false;
    private hasSuccessThisSecond = false;

    constructor(baseBatchSize: number) {
        this.minBatchSize = baseBatchSize;
        this.currentBatchSize = baseBatchSize;

        // Check and adjust batch size every second
        setInterval(() => {
            this.adjustBatchSize();
        }, 1000);
    }

    /**
     * Get the current dynamic batch size
     */
    getCurrentBatchSize(): number {
        return Math.floor(this.currentBatchSize);
    }

    /**
     * Called when a batch request succeeds - marks success for this second
     */
    onSuccess(): void {
        this.hasSuccessThisSecond = true;
    }

    /**
     * Called when a batch request fails - marks error for this second
     */
    onError(): void {
        this.hasErrorsThisSecond = true;
    }

    /**
     * Adjusts batch size based on errors/successes in the past second
     * Called every second by the interval timer
     */
    private adjustBatchSize(): void {
        const oldBatchSize = this.currentBatchSize;
        const oldBatchSizeFlat = Math.floor(oldBatchSize);

        if (this.hasErrorsThisSecond) {
            // Had errors this second - decrease by 5%
            const newBatchSize = this.currentBatchSize * (1 - this.decreaseRate);
            this.currentBatchSize = Math.max(newBatchSize, this.minBatchSize);

            if (oldBatchSizeFlat !== Math.floor(this.currentBatchSize)) {
                console.log(`DEBUG: Batch size decreased from ${oldBatchSize.toFixed(2)} to ${this.currentBatchSize.toFixed(2)} (errors detected)`);
            }
        } else if (this.hasSuccessThisSecond) {
            // No errors but had successes - increase by 0.1%
            this.currentBatchSize = Math.min(this.currentBatchSize * (1 + this.increaseRate), SANE_MAX_BATCH_SIZE);

            if (oldBatchSizeFlat !== Math.floor(this.currentBatchSize)) {
                console.log(`DEBUG: Batch size increased from ${oldBatchSize.toFixed(2)} to ${this.currentBatchSize.toFixed(2)} (success without errors)`);
            }
        }
        // If no errors and no successes, don't change anything

        // Reset flags for next second
        this.hasErrorsThisSecond = false;
        this.hasSuccessThisSecond = false;

        // Log current stats
        const stats = this.getStats();
    }

    /**
     * Get current statistics for monitoring
     */
    getStats(): { current: number; min: number; utilizationRatio: number } {
        return {
            current: this.getCurrentBatchSize(),
            min: this.minBatchSize,
            utilizationRatio: this.currentBatchSize / this.minBatchSize
        };
    }
} 

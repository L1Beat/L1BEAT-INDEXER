import * as fs from 'fs';
import * as path from 'path';

interface DBData {
    lastProcessedBlock: number;
    subnets: string[];
    validatedSubnets: string[];
}

class DB {
    private data: DBData;
    private filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const fileContent = fs.readFileSync(this.filePath, 'utf-8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            // If file doesn't exist or is invalid JSON, initialize with defaults
            this.data = { lastProcessedBlock: 0, subnets: [], validatedSubnets: [] };
            this._save();
        }
    }

    private _save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    }

    getAllSubnets(): string[] {
        return [...this.data.subnets]; // Return a copy
    }

    getLastprocessedBlock(): number {
        return this.data.lastProcessedBlock;
    }

    setLastprocessedBlock(block: number) {
        this.data.lastProcessedBlock = block;
        this._save();
    }

    addSubnets(subnets: string[]) {
        for (let subnet of subnets) {
            if (!this.data.subnets.includes(subnet)) {
                this.data.subnets.push(subnet);
            }
        }
        this._save();
    }

    updateValidatedSubnets(subnets: string[]) {
        this.data.validatedSubnets = [...subnets]; // Use a copy
        this._save();
    }

    getValidatedSubnets(): string[] {
        return [...this.data.validatedSubnets]; // Return a copy
    }
}

export default new DB("data/db.json");

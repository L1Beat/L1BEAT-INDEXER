import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { ASSIGNMENT_EXPIRATION_TIME, SUBNETS_PER_NODE, DATA_DIR, NODE_COUNT, MAX_NODES_PER_SUBNET } from './config';

export type NodeAssignment = {
    nodeIndex: number;
    subnetId: string;
    dateCreated: number;
    expiresAt: number;
};

interface NodeDatabase {
    assignments: NodeAssignment[];
}

class Database {
    private assignments: NodeAssignment[] = [];
    private dataDir: string;
    private filePath: string;

    constructor(private nodeCount: number) {
        this.dataDir = DATA_DIR;
        this.filePath = path.join(this.dataDir, 'chains.json');
        this.loadFromDisk();
    }

    private loadFromDisk(): void {
        try {
            // Create data directory if it doesn't exist
            if (!existsSync(this.dataDir)) {
                mkdirSync(this.dataDir, { recursive: true });
                console.log(`Created data directory: ${this.dataDir}`);
            }

            // Try loading main file first
            if (existsSync(this.filePath)) {
                const fileContent = readFileSync(this.filePath, 'utf-8');
                const data = JSON.parse(fileContent);

                // Load assignments if they exist
                if (data.assignments && Array.isArray(data.assignments)) {
                    this.assignments = data.assignments;
                    console.log(`Loaded ${this.assignments.length} assignments from database`);
                }
            } else {
                console.log(`No existing database found, starting fresh`);
            }
        } catch (error) {
            console.error('Error loading database:', error);
            this.assignments = [];
        }
    }

    private saveToDisk(): void {
        try {
            const data: NodeDatabase = { assignments: this.assignments };
            const jsonData = JSON.stringify(data, null, 2);

            // First save to main file
            writeFileSync(this.filePath, jsonData);

            // Then immediately create backup
            const backupPath = path.join(this.dataDir, 'chains.backup.json');
            writeFileSync(backupPath, jsonData);

            console.log(`Database saved to ${this.filePath} (with backup)`);
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }

    public addNodeToSubnet(subnetId: string): NodeAssignment {
        if (this.nodeCount === 0) {
            throw new Error('NODE_COUNT must be greater than 0 to assign nodes');
        }

        // Find all nodes already assigned to this subnet
        const existingNodes = this.assignments
            .filter(a => a.subnetId === subnetId)
            .map(a => a.nodeIndex);

        // Check if subnet already has max nodes
        if (existingNodes.length >= MAX_NODES_PER_SUBNET) {
            throw new Error(`Subnet ${subnetId} already has the maximum of ${MAX_NODES_PER_SUBNET} nodes assigned`);
        }

        // Find an available node
        const availableNode = this.findAvailableNode(existingNodes);

        if (availableNode === null) {
            // No available slots, remove oldest assignment
            this.removeOldestAssignment();
            // Try again
            return this.addNodeToSubnet(subnetId);
        }

        // Create new assignment
        const assignment: NodeAssignment = {
            nodeIndex: availableNode,
            subnetId,
            dateCreated: Date.now(),
            expiresAt: Date.now() + ASSIGNMENT_EXPIRATION_TIME
        };

        this.assignments.push(assignment);
        this.saveToDisk();

        console.log(`Added node ${availableNode} to subnet ${subnetId}`);
        return assignment;
    }

    public removeAssignment(subnetId: string, nodeIndex: number): boolean {
        const initialLength = this.assignments.length;
        this.assignments = this.assignments.filter(
            a => !(a.subnetId === subnetId && a.nodeIndex === nodeIndex)
        );

        if (this.assignments.length < initialLength) {
            this.saveToDisk();
            console.log(`Removed node ${nodeIndex} from subnet ${subnetId}`);
            return true;
        }

        return false;
    }

    private findAvailableNode(excludeNodes: number[]): number | null {
        const nodeCounts = this.getNodeCounts();

        for (let nodeIndex = 0; nodeIndex < this.nodeCount; nodeIndex++) {
            if (!excludeNodes.includes(nodeIndex) &&
                (nodeCounts[nodeIndex] || 0) < SUBNETS_PER_NODE) {
                return nodeIndex;
            }
        }

        return null;
    }

    private getNodeCounts(): Record<number, number> {
        const counts: Record<number, number> = {};

        for (const assignment of this.assignments) {
            counts[assignment.nodeIndex] = (counts[assignment.nodeIndex] || 0) + 1;
        }

        return counts;
    }

    private removeOldestAssignment(): void {
        if (this.assignments.length === 0) {
            throw new Error('No assignments available to remove');
        }

        // Find assignment with earliest expiration
        let oldestIndex = 0;
        let oldestExpiration = this.assignments[0].expiresAt;

        for (let i = 1; i < this.assignments.length; i++) {
            if (this.assignments[i].expiresAt < oldestExpiration) {
                oldestIndex = i;
                oldestExpiration = this.assignments[i].expiresAt;
            }
        }

        const removed = this.assignments.splice(oldestIndex, 1)[0];
        console.log(`Removed oldest assignment: node ${removed.nodeIndex} from subnet ${removed.subnetId}`);
    }

    public getSubnetAssignments(subnetId: string): NodeAssignment[] {
        return this.assignments
            .filter(a => a.subnetId === subnetId)
            .map(a => ({ ...a })); // Return copies
    }

    public getNodeAssignments(nodeIndex: number): NodeAssignment[] {
        return this.assignments
            .filter(a => a.nodeIndex === nodeIndex)
            .map(a => ({ ...a })); // Return copies
    }

    // Keep this method for backward compatibility with docker-composer
    public getNodeSubnets(nodeIndex: number): string[] {
        return this.assignments
            .filter(a => a.nodeIndex === nodeIndex)
            .map(a => a.subnetId);
    }

    // Keep for backward compatibility
    public getNodesCount(): number {
        return this.nodeCount;
    }
}

export let database = new Database(NODE_COUNT);


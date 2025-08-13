import { spawn } from 'child_process';
import kill from 'tree-kill';

// Function to spawn a child process
function runScript(command: string, args: string[], name: string, cwd?: string) {
    const process = spawn(command, args, { stdio: 'inherit', cwd });
    console.log(`[${name}] process started with PID: \${process.pid}`);

    process.on('error', (err) => {
        console.error(`[${name}] Failed to start process:`, err);
    });

    process.on('exit', (code, signal) => {
        console.log(`[${name}] process exited with code ${code} and signal ${signal}`);
        // If one process dies, we should kill the other to avoid orphaned processes
        // This is a simple approach; more sophisticated handling might be needed for production
        if (name === 'Indexer' && viteProcess && viteProcess.pid) {
            console.log('Indexer died, killing Vite server...');
            kill(viteProcess.pid, 'SIGTERM', (err) => {
                if (err) console.error('Failed to kill Vite server:', err);
                else console.log('Vite server killed.');
            });
        } else if (name === 'Vite' && indexerProcess && indexerProcess.pid) {
            console.log('Vite server died, killing Indexer...');
            kill(indexerProcess.pid, 'SIGTERM', (err) => {
                if (err) console.error('Failed to kill Indexer:', err);
                else console.log('Indexer killed.');
            });
        }
    });
    return process;
}

console.log('Starting development environment...');

// Start the indexer
// Using tsx to run the TypeScript indexer directly
const indexerProcess = runScript('tsx', ['server/indexer.ts'], 'Indexer');

// Start the Vite dev server
// Using yarn to run the original vite command. NODE_OPTIONS are inherited or can be set here if needed.
const viteProcess = runScript('yarn', ['vite'], 'Vite');


// Graceful shutdown
function cleanup() {
    console.log('\\nCleaning up processes...');
    if (indexerProcess && indexerProcess.pid) {
        kill(indexerProcess.pid, 'SIGTERM', (err) => {
            if (err) {
                console.error('Failed to kill Indexer process:', err);
            } else {
                console.log('Indexer process killed.');
            }
        });
    }
    if (viteProcess && viteProcess.pid) {
        kill(viteProcess.pid, 'SIGTERM', (err) => {
            if (err) {
                console.error('Failed to kill Vite process:', err);
            } else {
                console.log('Vite process killed.');
            }
        });
    }
}

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    cleanup();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanup();
    process.exit(1);
}); 

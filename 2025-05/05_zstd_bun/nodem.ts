import fs from 'fs';
import path from 'path';
export function readAllNodeModules(dir: string): string {
    const nodeModulesDir = path.join(dir, 'node_modules');
    let allContent = '';

    function traverse(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                traverse(fullPath);
            } else if (entry.isFile() && fullPath.includes('node_modules') && entry.name.endsWith('.js')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    allContent += content + '\n';
                } catch (error) {
                    console.error(`Error reading file ${fullPath}:`, error);
                }
            }
        }
    }

    traverse(dir);
    return allContent;
}

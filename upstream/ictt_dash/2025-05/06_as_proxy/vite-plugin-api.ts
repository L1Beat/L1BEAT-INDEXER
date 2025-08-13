import type { Plugin, ViteDevServer } from 'vite';
import { IncomingMessage, ServerResponse } from 'http';

export function apiPlugin(): Plugin {
    return {
        name: 'vite-plugin-simple-api',
        configureServer(server: ViteDevServer) {
            server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                if (req.url?.startsWith('/api')) {
                    // Example API endpoint
                    if (req.url === '/api/hello') {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ message: 'Hello from the API!' }));
                        return;
                    }

                    // Add more API routes here as needed
                    // e.g., if (req.url === '/api/another-route') { ... }


                    // Handle 404 for other /api routes
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'API route not found' }));
                    return;
                }
                next();
            });
        },
    };
}

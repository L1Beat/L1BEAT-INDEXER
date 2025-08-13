import { OpenAPIHono } from "@hono/zod-openapi";

const docs = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Indexer API Documentation</title>
    <!-- Embed elements Elements via Web Component -->
    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  </head>
  <body>

    <elements-api
      apiDescriptionUrl="/api/openapi.json"
      router="history"
      layout="sidebar"
      basePath="/api/docs"
    />

  </body>
</html>
`

export function registerDocsRoutes(app: OpenAPIHono, url: string = "/api") {
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Indexer API',
    },
    servers: [
      {
        url: url,
      }
    ]
  })

  // Serve docs at /api/docs
  app.get('/docs', (c) => c.html(docs))

  // Catchall for history router - serve the same docs for any /api/docs/* path
  app.get('/docs/*', (c) => c.html(docs))
}

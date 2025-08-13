# Project Notes

## Development Workflow

- **After changing APIs**: Run `npm run openapi` to regenerate types and client
- **Testing**: User runs the server - do not attempt to test or run anything
- **Execution**: Use `npx tsx` directly - never compile TypeScript files

## API Curl Examples

- The server does not require `Accept: application/json` header
- Use simple curl format: `curl -X GET "url"`
- Always quote URLs to prevent shell glob expansion with query parameters

## Deployment

- To deploy the project, run: `./deploy.sh`

# Contributing to L1Beat Indexer

Thank you for your interest in contributing to L1Beat Indexer! We welcome contributions from the community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/l1beat-indexer.git
   cd l1beat-indexer
   ```
3. **Install dependencies**:
   ```bash
   npm install
   npm run install:frontend
   ```
4. **Start development environment**:
   ```bash
   npm run dev:full
   ```

## Development Guidelines

### Code Style
- Use TypeScript with strict typing
- Follow the existing ESLint configuration
- Use ES6 imports (no `require()` statements)
- Avoid `toLowerCase()` in loops for performance
- Add comprehensive TypeScript types for all new APIs

### Indexing Plugins
- Accumulate changes in RAM and batch database writes
- Use synchronous `blocksDbHelper` methods (no `await` needed)
- Bump indexer version when changing indexing logic or DB structure
- Include technical details in UI descriptions (events tracked, contract addresses, etc.)

### API Development
- Chain-specific requests should start with `/api/{evmChainId}/`
- Don't add tags and summary fields on Fastify API specs
- Preserve existing data structures in endpoints for frontend compatibility
- Run `npm run openapi` from frontend directory after API changes

### Frontend Development
- Use React with TypeScript
- Implement responsive design with TailwindCSS
- Provide detailed technical information for users
- Use React Query for data fetching

## Submitting Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** following the guidelines above
3. **Test your changes** locally
4. **Commit with a clear message**:
   ```bash
   git commit -m "Add feature: brief description"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request** on GitHub

## Reporting Issues

- Use the GitHub issue tracker
- Include steps to reproduce the issue
- Provide relevant logs and error messages
- Specify your environment (OS, Node.js version, etc.)

## Questions?

Feel free to open an issue for questions or reach out to the maintainers.

Thank you for contributing!

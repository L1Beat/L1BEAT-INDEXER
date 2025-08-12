# L1Beat Indexer

A high-performance blockchain indexer and analytics dashboard for monitoring Avalanche L1 cross-chain transfers and messaging.

## Architecture

- **Backend**: FrostByte SDK indexer that processes blockchain data and serves REST APIs
- **Frontend**: React application that displays basic analytics and dashboards

## Quick Start

### Backend Only (Indexing Service)
```bash
npm run dev
```
This starts the FrostByte indexer and API server on port 3080.

### Frontend Only
```bash
npm run dev:frontend
```
This starts the React development server on port 5173, proxying API calls to port 3080.

### Full Stack Development
```bash
npm run dev:full
```
This starts both backend and frontend services concurrently.

## Setup

1. **Install backend dependencies**:
   ```bash
   npm install
   ```

2. **Install frontend dependencies**:
   ```bash
   npm run install:frontend
   ```

3. **Start L1Beat Indexer**:
   ```bash
   npm run dev:full
   ```

## Project Structure

```
.
├── backend files (root)
│   ├── plugins/          # FrostByte indexing and API plugins
│   ├── data/            # Chain configurations and SQLite databases
│   └── package.json     # Backend dependencies
├── frontend/
│   ├── src/             # React application
│   ├── public/          # Static assets
│   └── package.json     # Frontend dependencies
└── node_modules/
    └── frostbyte-sdk/   # Locally built FrostByte SDK
```

## APIs

- Backend API: http://localhost:3080/api/
- API Documentation: http://localhost:5173/api/docs
- Frontend: http://localhost:5173/

## Development

- Backend changes: Restart with `npm run dev`
- Frontend changes: Hot reload automatically
- API changes: Update client with `npm run openapi` (from frontend directory)
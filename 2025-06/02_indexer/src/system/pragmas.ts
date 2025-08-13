export const DEFAULT_PRAGMAS = `
PRAGMA page_size = 4096;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = OFF;
PRAGMA cache_size = -64000;
PRAGMA wal_autocheckpoint = 10000;
PRAGMA checkpoint_fullfsync = OFF;
`

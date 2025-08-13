import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
    url: "file:./data/indexed.db",
});

const db = drizzle(client);

export { db };

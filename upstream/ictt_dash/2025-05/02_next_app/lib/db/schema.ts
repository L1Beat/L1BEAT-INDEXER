import { int, sqliteTable, blob, text, index } from "drizzle-orm/sqlite-core";

export const blocksTable = sqliteTable("blocks", {
    number: int().primaryKey(),
    hash: text().notNull(),
    data: blob().notNull(),
}, (table) => ({
    hashIndex: index("hash_index").on(table.hash),
}));

//TODO: rename to be closer to the actual data
export type StoredBlockData = {
    txNumber: number;
    timestamp: number;
    fee: number;
}

export const configTable = sqliteTable("config", {
    key: text().primaryKey(),
    value: text(),
});

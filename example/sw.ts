import { idbx } from "../deps.ts";
import { SyncDB } from "../lib/SyncDB.ts";

const DB_VERSION = 1;
const CACHE_VERSION = "v1";

const dbreq = idbx.open("testdb", DB_VERSION);

dbreq.upgrade((event) => {
  const target = event.target as IDBOpenDBRequest;
  const db = target.result;
  SyncDB.createStore(db, "test");
});

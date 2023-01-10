// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/indexeddb@v1.1.0/polyfill_memory.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.152.0/testing/asserts.ts";
import { idbx } from "../deps.ts";
import * as mf from "https://deno.land/x/mock_fetch@0.3.0/mod.ts";

mf.install();

import { SyncDB, SyncInfo } from "./SyncDB.ts";

interface TestStore extends SyncInfo {
  id?: string;
  name: string;
}

const createDB = () => {
  const dbreq = indexedDB.open("testdb", 1);

  dbreq.onupgradeneeded = (event) => {
    const target = event.target as IDBOpenDBRequest;
    const db = target.result;
    SyncDB.createStore(db, "test");
  };

  return new Promise<IDBDatabase>((resolve) => {
    dbreq.onsuccess = (event) => {
      const target = event.target as IDBOpenDBRequest;
      const db = target.result;
      resolve(db);
    };
  });
};

const clearDB = (db: IDBDatabase) => {
  // close database
  db.close();
  // delete database
  indexedDB.deleteDatabase("testdb");
};

const fillDB = async (db: IDBDatabase) => {
  const store = db.transaction("test", "readwrite").objectStore("test");
  await idbx.addBulk<TestStore>(store, [
    { id: "1", name: "test", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test", sync_action: "none", sync_state: "synced" },
    { id: "3", name: "test", sync_action: "none", sync_state: "synced" },
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
};

const createRoutes = () => {
  mf.mock("POST@/api/create", async (req) => {
    const actualBody = await req.json();
    const expectedBody = { name: "test" };

    assertEquals(actualBody, expectedBody);
    return new Response(
      JSON.stringify({
        id: "1",
        name: "test",
        sync_action: "none",
        sync_state: "synced",
      }),
      { status: 201 },
    );
  });

  mf.mock("PUT@/api/update", async (req) => {
    const actualBody = await req.json();
    const expectedBody = { id: "1", name: "test" };

    assertEquals(actualBody, expectedBody);
    return new Response(
      JSON.stringify({
        id: "1",
        name: "test",
        sync_action: "none",
        sync_state: "synced",
      }),
      { status: 200 },
    );
  });

  mf.mock("DELETE@/api/delete", (req) => {
    const actual = new URL(req.url).searchParams.get("id");
    const expected = "1";

    assertEquals(actual, expected);
    return new Response(undefined, { status: 204 });
  });

  mf.mock("GET@/api/read", (req) => {
    const url = new URL(req.url);
    const actual = url.searchParams.get("id");
    const expected = "1";

    assertEquals(actual, expected);
    return new Response(
      JSON.stringify({
        id: "1",
        name: "test",
        sync_action: "none",
        sync_state: "synced",
      }),
      { status: 200 },
    );
  });

  mf.mock("GET@/api/read_all", (req) => {
    return new Response(
      JSON.stringify([
        {
          id: "1",
          name: "test",
          sync_action: "none",
          sync_state: "synced",
        },
        {
          id: "2",
          name: "test2",
          sync_action: "none",
          sync_state: "synced",
        },
      ]),
      { status: 200 },
    );
  });
};

const removeRoutes = () => {
  mf.remove("POST@/api/create");
  mf.remove("PUT@/api/update");
  mf.remove("DELETE@/api/delete");
  mf.remove("GET@/api/read");
  mf.remove("GET@/api/read_all");
};

const syncOptions = {
  url: "http://localhost",
};

Deno.test("SyncDB.create online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const data: TestStore = { name: "test" };
  const result = await syncdb.create(data);
  assertEquals(result, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.create offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const data: TestStore = { name: "test" };
  const result = await syncdb.create(data);

  assert(result.id.startsWith("TMP-"), "id should be a temporary id");

  const id = result.id;
  assertEquals(result, {
    id,
    name: "test",
    sync_action: "create",
    sync_state: "unsynced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.update online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const data: TestStore = { id: "1", name: "test" };
  const result = await syncdb.update(data);
  assertEquals(result, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.update offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);

  const data: TestStore = { id: "1", name: "test" };
  const result = await syncdb.update(data);
  assertEquals(result, {
    id: "1",
    name: "test",
    sync_action: "update",
    sync_state: "unsynced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.delete online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);

  // create a record
  const item = await syncdb.create({ name: "test" });
  assertEquals(item, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  // delete the record
  const result = await syncdb.delete("1");
  assertEquals(result, undefined);

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.delete offline with ID", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);

  // create a record
  const item = await syncdb.create({ name: "test" });
  const id = item.id;

  (navigator as any).onLine = false;

  // delete the record
  await syncdb.delete(id);

  const result = await syncdb.read(id);
  assertEquals(result, {
    id,
    name: "test",
    sync_action: "delete",
    sync_state: "unsynced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.delete offline with temporary ID", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);

  // create a record
  const item = await syncdb.create({ name: "test" });
  const id = item.id;

  assert(id.startsWith("TMP-"), "id should be a temporary id");

  // delete the record
  await syncdb.delete(id);

  const result = await syncdb.read(id);
  assertEquals(result, undefined);

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.read online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const item1 = await syncdb.read("1");
  assertEquals(item1, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  }, "item flagged as synced should be returned");

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.read online/sync/update", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);

  mf.mock("GET@/api/read", (req) => {
    const url = new URL(req.url);
    assertEquals(url.searchParams.get("id"), "2");
    return new Response(JSON.stringify({
      id: "2",
      name: "test2",
      sync_action: "none",
      sync_state: "synced",
    }));
  });

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const item2 = await syncdb.read("2");
  assertEquals(item2, {
    id: "2",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const item2Changed = await syncdb.read("2", true);
  assertEquals(item2Changed, {
    id: "2",
    name: "test2",
    sync_action: "none",
    sync_state: "synced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.read online/sync/delete", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);

  mf.mock("GET@/api/read", (req) => {
    const url = new URL(req.url);
    assertEquals(url.searchParams.get("id"), "3");
    return new Response(undefined, { status: 404 });
  });

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const item3 = await syncdb.read("3");
  assertEquals(item3, {
    id: "3",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const item3Deleted = await syncdb.read("3", true);
  assertEquals(item3Deleted, undefined, "item must be deleted");

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.read offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const item1 = await syncdb.read("1");
  assertEquals(item1, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.read offline/sync/update", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const item2 = await syncdb.read("2");
  assertEquals(item2, {
    id: "2",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const itemNotChanged = await syncdb.read("2", true);
  assertEquals(itemNotChanged, {
    id: "2",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  }, "item must not be changed");

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.read offline/sync/delete", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const item3 = await syncdb.read("3");
  assertEquals(item3, {
    id: "3",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const itemNotDeleted = await syncdb.read("3", true);
  assertEquals(itemNotDeleted, {
    id: "3",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  }, "item must not be deleted");

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.readAll online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const items = await syncdb.readAll();
  assertEquals(items, [
    {
      id: "1",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "2",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "3",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ], "all items flagged as synced should be returned");

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.readAll online/sync", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const items = await syncdb.readAll(true);
  assertEquals(items, [
    {
      id: "1",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "2",
      name: "test2",
      sync_action: "none",
      sync_state: "synced",
    },
    // ID 3 is deleted
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.readAll offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  const items = await syncdb.readAll();
  assertEquals(items, [
    {
      id: "1",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "2",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "3",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);

  clearDB(db);
  removeRoutes();
});

const createSyncItems = async (db: IDBDatabase) => {
  const tx = db.transaction("test", "readwrite");
  const store = tx.objectStore("test");
  await idbx.addBulk(store, [
    // synced entry
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    // updated entry
    { id: "2", name: "test2", sync_action: "update", sync_state: "unsynced" },
    // deleted entry
    { id: "3", name: "test3", sync_action: "delete", sync_state: "unsynced" },
    // new entry
    {
      id: "TMP-1",
      name: "test4",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
};

const createSyncMock = () => {
  mf.mock("POST@/api/sync", async (req) => {
    const body = await req.json();
    assertEquals(body, {
      create: [
        {
          id: "TMP-1",
          name: "test4",
          sync_action: "create",
          sync_state: "unsynced",
        },
      ],
      update: [
        {
          id: "2",
          name: "test2",
          sync_action: "update",
          sync_state: "unsynced",
        },
      ],
      delete: [
        {
          id: "3",
          name: "test3",
          sync_action: "delete",
          sync_state: "unsynced",
        },
      ],
    });
    return new Response(JSON.stringify({
      changed: [
        {
          id: "2",
          name: "test2",
          sync_action: "none",
          sync_state: "synced",
        },
        {
          id: "4",
          name: "test4",
          sync_action: "none",
          sync_state: "synced",
        },
      ],
      deleted: ["3"],
      timestamp: "2023-01-01T00:00:00.000Z",
    }));
  });
};

Deno.test("SyncDB.sync()", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await createSyncItems(db);
  createSyncMock();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  await syncdb.sync();

  const items = await syncdb.readAll();
  assertEquals(items, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "none", sync_state: "synced" },
    { id: "4", name: "test4", sync_action: "none", sync_state: "synced" },
  ]);

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB.sync() offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await createSyncItems(db);
  createSyncMock();

  const syncdb = new SyncDB<TestStore>(db, "test", syncOptions);
  await syncdb.sync();

  const items = await syncdb.readAll();
  assertEquals(items, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "update", sync_state: "unsynced" },
    { id: "3", name: "test3", sync_action: "delete", sync_state: "unsynced" },
    {
      id: "TMP-1",
      name: "test4",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);

  clearDB(db);
  removeRoutes();
});

Deno.test("SyncDB AutoSync toggle from offline to online", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await createSyncItems(db);
  createSyncMock();

  const syncdb = new SyncDB<TestStore>(db, "test", {
    ...syncOptions,
    autoSync: true,
  });

  const items = await syncdb.readAll();
  assertEquals(items, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "update", sync_state: "unsynced" },
    { id: "3", name: "test3", sync_action: "delete", sync_state: "unsynced" },
    {
      id: "TMP-1",
      name: "test4",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);

  (navigator as any).onLine = true;
  globalThis.dispatchEvent(new Event("online"));

  const state = await syncdb.syncState;
  assertEquals(state, "synced");

  const items2 = await syncdb.readAll();
  assertEquals(items2, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "none", sync_state: "synced" },
    { id: "4", name: "test4", sync_action: "none", sync_state: "synced" },
  ]);

  clearDB(db);
  removeRoutes();
});

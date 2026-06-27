const DB_NAME = "festival_pos_db";
const DB_VERSION = 1;

let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (e) {
      db = e.target.result;

      if (!db.objectStoreNames.contains("queue")) {
        const store = db.createObjectStore("queue", {
          keyPath: "id",
          autoIncrement: true
        });

        store.createIndex("status", "status", { unique: false });
      }
    };

    request.onsuccess = function (e) {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = reject;
  });
}

function addToQueue(action, data) {
  const tx = db.transaction("queue", "readwrite");
  const store = tx.objectStore("queue");

  store.add({
    action,
    data,
    status: "pending",
    createdAt: Date.now()
  });
}

async function syncQueue() {
  if (!navigator.onLine) return;

  const tx = db.transaction("queue", "readwrite");
  const store = tx.objectStore("queue");

  const request = store.getAll();

  request.onsuccess = async () => {
    const items = request.result;

    for (let item of items) {
      try {
        const res = await api(item.action, item.data);

        if (res.success) {
          store.delete(item.id);
        }
      } catch (err) {
        console.error("Sync failed:", err);
      }
    }
  };
}
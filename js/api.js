const cache = new Map();

async function api(action, data = {}) {

    const user = getSession();

    const payload = {
        action,
        token: user?.token || "",
        ...data
    };

    const key = JSON.stringify(payload);

    if (cache.has(key)) {
        return cache.get(key);
    }

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const json = await res.json();

    cache.set(key, json);

    setTimeout(() => cache.delete(key), 5000);

    return json;
}

async function batchApi(actions = []) {

    const user = getSession();

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            batch: actions,
            token: user?.token || ""
        })
    });

    return await res.json();
}
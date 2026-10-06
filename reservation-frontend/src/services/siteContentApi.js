import { fetchClient } from '../utils/fetchClient';

let cache = null;
let cacheAt = 0;
let pending = null;
let requestGeneration = 0;
const CACHE_MS = 60 * 1000;

async function parseJson(res) {
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function startSiteContentRequest() {
  const generation = ++requestGeneration;
  const request = fetchClient('/api/site-content')
    .then(parseJson)
    .then((data) => {
      if (generation === requestGeneration) {
        cache = data;
        cacheAt = Date.now();
      }
      return data;
    })
    .finally(() => {
      if (pending === request) pending = null;
    });
  pending = request;
  return request;
}

export async function fetchSiteContent({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) {
    return cache;
  }
  if (!force && pending) return pending;
  return startSiteContentRequest();
}

export function clearSiteContentCache() {
  cache = null;
  cacheAt = 0;
  pending = null;
  requestGeneration += 1;
}

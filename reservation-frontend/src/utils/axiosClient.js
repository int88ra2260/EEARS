import axios from 'axios';
import { handleAuthSessionInvalidResponse } from './fetchClient';

function getOrCreateRequestId(config) {
  // 以每次請求為單位產生 requestId，便於追查該次 API 的所有後端 log
  if (!config || !config.headers) return crypto.randomUUID();
  const existing =
    config.headers['x-request-id'] ||
    config.headers['X-Request-Id'] ||
    config.headers['x-requestid'];
  if (existing) return String(existing).slice(0, 64);

  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `rid:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

const axiosClient = axios.create({
  timeout: 30000,
});

axiosClient.interceptors.request.use((config) => {
  const rid = getOrCreateRequestId(config);
  config.headers = config.headers || {};
  if (!config.headers['x-request-id']) config.headers['x-request-id'] = rid;
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const res = error.response;
    if (res && res.status === 401) {
      try {
        await handleAuthSessionInvalidResponse(res);
      } catch (_) {
        // ignore
      }
    }
    const serverRequestId =
      res && res.headers ? (res.headers['x-request-id'] || res.headers['X-Request-Id']) : null;
    const clientRequestId = error.config && error.config.headers ? error.config.headers['x-request-id'] : null;
    const requestId = serverRequestId || clientRequestId || null;

    const apiError = res && res.data ? res.data : null;
    const apiMessage =
      (apiError && (apiError.error || apiError.message)) ||
      (typeof apiError === 'string' ? apiError : null) ||
      error.message ||
      'Request failed';

    const nextMessage = requestId ? `${apiMessage} (requestId: ${requestId})` : apiMessage;
    const err = new Error(nextMessage);
    err.requestId = requestId;
    err.status = res ? res.status : undefined;
    err.apiError = apiError;
    return Promise.reject(err);
  }
);

export default axiosClient;


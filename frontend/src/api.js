const DEFAULT_BASE_URL = '/api';

export function getStoredBaseUrl() {
  return localStorage.getItem('conveyor_api_url') || DEFAULT_BASE_URL;
}

export function setStoredBaseUrl(url) {
  localStorage.setItem('conveyor_api_url', url);
}

async function request(endpoint, options = {}) {
  const baseUrl = getStoredBaseUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errorMsg = data?.error || (typeof data === 'string' ? data : `HTTP ${res.status}`);
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      throw new Error(`Failed to connect to ${baseUrl}. Check API server.`);
    }
    throw err;
  }
}

export const api = {
  checkHealth: () => request('/healthz'),
  getStats: () => request('/stats'),
  getWorkers: () => request('/workers'),
  getDeadJobs: () => request('/dead'),
  getJob: (id) => request(`/jobs/${id}`),
  
  submitJob: ({ type, queue = 'default', priority = 0, payload = {}, max_attempts = 5, idempotency_key = '', run_at = null }) => {
    const body = {
      type,
      queue: queue || 'default',
      priority: Number(priority) || 0,
      payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
      max_attempts: Number(max_attempts) || 5,
    };
    if (run_at) body.run_at = run_at;
    if (idempotency_key) body.idempotency_key = idempotency_key;

    const headers = {};
    if (idempotency_key) {
      headers['Idempotency-Key'] = idempotency_key;
    }

    return request('/jobs', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  },

  replayJob: (id) => {
    return request(`/jobs/${id}/replay`, {
      method: 'POST',
    });
  },
};

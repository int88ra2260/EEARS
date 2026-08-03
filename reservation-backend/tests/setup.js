// tests/setup.js
// Jest 測試環境設定

// 設定測試環境變數
process.env.NODE_ENV = 'test';
// 固定測試用 JWT secret（≥32 字元），避免載入 middleware 時依賴 dev fallback
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'jest-test-jwt-secret-minimum-thirty-two-characters-long';

// 全域 rate limit 預設關閉，避免影響既有整合測試；securityMiddleware.test.js 會另行開啟
process.env.GLOBAL_RATE_LIMIT_ENABLED = process.env.GLOBAL_RATE_LIMIT_ENABLED || 'false';

// 全域 mock 設定
global.console = {
  ...console,
  // 在測試中隱藏 console.log
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

async function closeActiveServers() {
  const handles = typeof process._getActiveHandles === 'function' ? process._getActiveHandles() : [];
  const servers = handles.filter((handle) => handle?.constructor?.name === 'Server');
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve) => {
          if (!server || typeof server.close !== 'function') return resolve();
          try {
            if (typeof server.unref === 'function') server.unref();
            server.close(() => resolve());
          } catch (_) {
            resolve();
          }
        }),
    ),
  );
}

afterEach(async () => {
  await closeActiveServers();
});

afterAll(() => {
  if (process.env.JEST_DEBUG_HANDLES !== '1') return;
  const handles = (typeof process._getActiveHandles === 'function' ? process._getActiveHandles() : [])
    .filter((handle) => {
      if (!handle) return false;
      const name = handle.constructor?.name || '';
      return !['Socket', 'WriteStream', 'ReadStream'].includes(name);
    })
    .map((handle) => ({
      type: handle.constructor?.name || typeof handle,
      details: {
        ...(typeof handle.hasRef === 'function' ? { hasRef: handle.hasRef() } : {}),
        ...(handle.constructor?.name === 'Server'
          ? {
              listening: handle.listening,
              address: typeof handle.address === 'function' ? handle.address() : undefined,
            }
          : {}),
      },
    }));
  if (handles.length) {
    process.stderr.write(`\n[JEST_DEBUG_HANDLES] ${JSON.stringify(handles, null, 2)}\n`);
  }
});









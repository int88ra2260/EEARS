/**
 * 網站瀏覽計數（以 JSON 檔案儲存，不需資料庫）
 *
 * 寫入以 in-process 佇列序列化，避免並發 read-modify-write 互相覆蓋導致人次倒退。
 * 正式環境請勿將 siteStats.json 納入版控；部署時需保留該檔（見 deploy-prod.yml）。
 */
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_STATS_FILE = path.join(DATA_DIR, 'siteStats.json');

const DEFAULT_STATS = { totalViews: 0, date: '', dailyViews: 0 };

const TAIWAN_TZ = 'Asia/Taipei';

/** @type {string} */
let statsFilePath = DEFAULT_STATS_FILE;

/** 序列化寫入佇列（單程序內互斥） */
let writeChain = Promise.resolve();

/** 取得台灣時區的今日日期 YYYY-MM-DD */
function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TAIWAN_TZ });
}

function getStatsFile() {
  return statsFilePath;
}

async function ensureDataDir() {
  const dir = path.dirname(getStatsFile());
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function readStats() {
  try {
    const raw = await fs.readFile(getStatsFile(), 'utf8');
    const data = JSON.parse(raw);
    return {
      totalViews: Number(data.totalViews) || 0,
      date: data.date || '',
      dailyViews: Number(data.dailyViews) || 0,
    };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULT_STATS };
    throw err;
  }
}

/**
 * 寫入統計檔（先寫 .tmp 再替換，降低半寫入風險）
 * @param {{ totalViews: number, date: string, dailyViews: number }} stats
 */
async function writeStats(stats) {
  await ensureDataDir();
  const target = getStatsFile();
  const tmp = `${target}.tmp`;
  const payload = `${JSON.stringify(stats, null, 2)}\n`;
  await fs.writeFile(tmp, payload, 'utf8');
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    // Windows：目標已存在時 rename 會失敗
    if (err.code === 'EEXIST' || err.code === 'EPERM' || process.platform === 'win32') {
      await fs.copyFile(tmp, target);
      await fs.unlink(tmp).catch(() => {});
      return;
    }
    throw err;
  }
}

/**
 * 在寫入鎖內執行（保證同程序並發不會交錯讀寫）
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function withStatsLock(fn) {
  const run = writeChain.then(() => fn());
  // 佇列不因單次失敗而中斷；呼叫端仍會收到 rejection
  writeChain = run.catch(() => {});
  return run;
}

/**
 * 記錄一次瀏覽並回傳目前總人次與當日人次
 * @returns {Promise<{ total: number, today: number }>}
 */
async function recordViewAndGet() {
  return withStatsLock(async () => {
    const today = getTodayDate();
    let stats = await readStats();

    if (stats.date !== today) {
      stats = { ...stats, date: today, dailyViews: 0 };
    }

    stats.totalViews = (stats.totalViews || 0) + 1;
    stats.dailyViews = (stats.dailyViews || 0) + 1;

    await writeStats(stats);

    return { total: stats.totalViews, today: stats.dailyViews };
  });
}

/**
 * 僅取得目前總人次與當日人次（不累加）
 * @returns {Promise<{ total: number, today: number }>}
 */
async function getOnly() {
  return withStatsLock(async () => {
    const today = getTodayDate();
    const stats = await readStats();

    if (stats.date !== today) {
      return { total: stats.totalViews || 0, today: 0 };
    }

    return {
      total: stats.totalViews || 0,
      today: stats.dailyViews || 0,
    };
  });
}

/**
 * 測試用：覆寫統計檔路徑並清空寫入佇列
 * @param {{ statsFile?: string | null }} [opts]
 */
function _resetForTests(opts = {}) {
  statsFilePath = opts.statsFile || DEFAULT_STATS_FILE;
  writeChain = Promise.resolve();
}

module.exports = {
  recordViewAndGet,
  getOnly,
  _resetForTests,
  DEFAULT_STATS,
};

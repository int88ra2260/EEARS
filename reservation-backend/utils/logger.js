// utils/logger.js
// 統一日誌管理工具，讓終端機輸出更清晰

const { formatTaipeiTime } = require('./time');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 從環境變數取得日誌級別，預設為 INFO
const getLogLevel = () => {
  const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  return LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
};

const currentLogLevel = getLogLevel();

// 顏色代碼
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// 格式化時間戳記
const formatTimestamp = () => {
  return formatTaipeiTime();
};

// 格式化日誌訊息
const formatMessage = (level, message, data = null) => {
  const timestamp = formatTimestamp();
  const levelColors = {
    DEBUG: colors.gray,
    INFO: colors.cyan,
    WARN: colors.yellow,
    ERROR: colors.red
  };
  const levelColor = levelColors[level] || colors.reset;
  const levelText = `[${level}]`.padEnd(7);
  
  let output = `${colors.dim}${timestamp}${colors.reset} ${levelColor}${levelText}${colors.reset} ${message}`;
  
  const shouldPrintData = !!data && (
    level === 'ERROR' ||
    currentLogLevel <= LOG_LEVELS.DEBUG
  );
  if (shouldPrintData) {
    output += `\n${colors.gray}  └─ ${JSON.stringify(data, null, 2)}${colors.reset}`;
  }
  
  return output;
};

const logger = {
  debug: (message, data = null) => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', message, data));
    }
  },

  info: (message, data = null) => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(formatMessage('INFO', message, data));
    }
  },

  warn: (message, data = null) => {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, data));
    }
  },

  error: (message, error = null) => {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      const errorDetails = error ? {
        message: error.message || String(error),
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : null;
      console.error(formatMessage('ERROR', message, errorDetails));
    }
  },

  success: (message) => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(`${colors.green}✅ ${message}${colors.reset}`);
    }
  },

  // 簡潔的成功訊息（不帶時間戳）
  simple: {
    success: (message) => {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.log(`${colors.green}✅ ${message}${colors.reset}`);
      }
    },
    error: (message) => {
      if (currentLogLevel <= LOG_LEVELS.ERROR) {
        console.error(`${colors.red}❌ ${message}${colors.reset}`);
      }
    },
    warn: (message) => {
      if (currentLogLevel <= LOG_LEVELS.WARN) {
        console.warn(`${colors.yellow}⚠️  ${message}${colors.reset}`);
      }
    },
    info: (message) => {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
      }
    }
  }
};

module.exports = logger;

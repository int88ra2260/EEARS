// scripts/post_deploy_check.mjs
// 部署後自動化健康檢查腳本

import http from 'http';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const REPORT_DIR = join(process.cwd(), 'reports');

// 確保 reports 目錄存在
try {
  mkdirSync(REPORT_DIR, { recursive: true });
} catch (err) {
  // 目錄已存在，忽略錯誤
}

const results = {
  timestamp: new Date().toISOString(),
  checks: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

// HTTP 請求輔助函數
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// 執行檢查並記錄結果
async function runCheck(name, checkFn) {
  results.summary.total++;
  const checkResult = {
    name,
    status: 'pending',
    message: '',
    details: {}
  };

  try {
    const result = await checkFn();
    checkResult.status = result.passed ? 'passed' : 'failed';
    checkResult.message = result.message || '';
    checkResult.details = result.details || {};

    if (result.passed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  } catch (error) {
    checkResult.status = 'failed';
    checkResult.message = error.message;
    checkResult.details = { error: error.stack };
    results.summary.failed++;
  }

  results.checks.push(checkResult);
  console.log(`[${checkResult.status.toUpperCase()}] ${name}: ${checkResult.message}`);
}

// 1. API 健康檢查
async function checkAPIHealth() {
  try {
    const response = await httpRequest(`${API_BASE_URL}/api/events`);
    return {
      passed: response.status === 200,
      message: response.status === 200 ? 'API 健康檢查通過' : `API 返回狀態碼 ${response.status}`,
      details: { status: response.status }
    };
  } catch (error) {
    return {
      passed: false,
      message: `API 健康檢查失敗: ${error.message}`,
      details: { error: error.message }
    };
  }
}

function expectsStudentAuth(response) {
  return response.status === 401
    && response.data?.success === false
    && response.data?.code === 'STUDENT_AUTH_REQUIRED';
}

// 2. 未登入不可查黑名單（個人資料須先有學生 session）
async function checkStudentAuthOnBlacklist() {
  try {
    const response = await httpRequest(`${API_BASE_URL}/api/users/blacklist-status?studentId=`, {
      method: 'GET'
    });
    const passed = expectsStudentAuth(response);

    return {
      passed,
      message: passed
        ? '未登入不可查黑名單'
        : `未登入查黑名單應為 401 STUDENT_AUTH_REQUIRED，實際 ${response.status}`,
      details: { status: response.status, code: response.data?.code }
    };
  } catch (error) {
    return {
      passed: false,
      message: `學生登入檢查失敗: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 3. 問卷 Gate 流程檢查
async function checkSurveyGate() {
  // /api/surveys/config 已封存（410 Gone）；改檢查現行公開問卷列表。
  try {
    const response = await httpRequest(`${API_BASE_URL}/api/surveys/enabled`);
    const ok = response.status === 200 && Array.isArray(response.data);
    return {
      passed: ok,
      message: ok ? '問卷公開列表 API 正常' : '問卷公開列表 API 異常',
      details: {
        status: response.status,
        count: Array.isArray(response.data) ? response.data.length : null
      }
    };
  } catch (error) {
    return {
      passed: false,
      message: `問卷 Gate 檢查失敗: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 4. 未登入不可用別人的學號讀黑名單
async function checkBlacklistAPI() {
  try {
    const testStudentId = 'B123456789';
    const response = await httpRequest(`${API_BASE_URL}/api/users/blacklist-status?studentId=${testStudentId}`, {
      method: 'GET'
    });
    const passed = expectsStudentAuth(response);

    return {
      passed,
      message: passed
        ? '未登入不可讀取他人黑名單狀態'
        : `未登入讀取黑名單應為 401 STUDENT_AUTH_REQUIRED，實際 ${response.status}`,
      details: { status: response.status, code: response.data?.code }
    };
  } catch (error) {
    return {
      passed: false,
      message: `黑名單檢查 API 失敗: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 5. 未登入不可建立預約
async function checkReservationRequiresStudentAuth() {
  try {
    const response = await httpRequest(`${API_BASE_URL}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {}
    });
    const passed = expectsStudentAuth(response);

    return {
      passed,
      message: passed
        ? '未登入預約被拒絕'
        : `未登入預約應為 401 STUDENT_AUTH_REQUIRED，實際 ${response.status}`,
      details: { status: response.status, code: response.data?.code }
    };
  } catch (error) {
    return {
      passed: false,
      message: `預約登入檢查失敗: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 主執行函數
async function main() {
  console.log('🚀 開始執行部署後健康檢查...\n');

  // 執行所有檢查
  await runCheck('API 健康檢查', checkAPIHealth);
  await runCheck('未登入不可查黑名單', checkStudentAuthOnBlacklist);
  await runCheck('問卷 Gate API', checkSurveyGate);
  await runCheck('未登入不可讀他人黑名單', checkBlacklistAPI);
  await runCheck('未登入不可預約', checkReservationRequiresStudentAuth);

  // 生成報告
  const reportPath = join(REPORT_DIR, 'post_deploy_check.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');

  // 輸出摘要
  console.log('\n' + '='.repeat(50));
  console.log('檢查摘要');
  console.log('='.repeat(50));
  console.log(`總檢查數: ${results.summary.total}`);
  console.log(`通過: ${results.summary.passed} ✅`);
  console.log(`失敗: ${results.summary.failed} ${results.summary.failed > 0 ? '❌' : ''}`);
  console.log(`\n報告已儲存至: ${reportPath}`);

  // 如果有失敗的檢查，返回非零退出碼
  if (results.summary.failed > 0) {
    console.log('\n⚠️  有檢查項目失敗，請檢視報告並修復問題。');
    process.exit(1);
  } else {
    console.log('\n✅ 所有檢查項目通過！');
    process.exit(0);
  }
}

// 執行主函數
main().catch((error) => {
  console.error('❌ 執行健康檢查時發生錯誤:', error);
  process.exit(1);
});


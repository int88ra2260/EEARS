/**

 * 系統設定 API 薄層

 */

import { fetchClient } from '../utils/fetchClient';



const PATHS = {

  englishTestRegistration: '/api/settings/english-test-registration-enabled',

  englishTestRegistrationGroup: '/api/settings/english-test-registration-group-enabled',

};



function adminAuthHeaders(token, userRole) {

  return {

    Authorization: `Bearer ${token}`,

    'Content-Type': 'application/json',

    'X-User-Role': userRole || 'worker',

  };

}



async function parseJson(res) {

  return res.json().catch(() => ({}));

}



async function throwIfNotOk(res, fallback = '請求失敗') {

  const data = await parseJson(res);

  if (!res.ok) {

    const err = new Error(data.error || data.message || fallback);

    err.status = res.status;

    err.data = data;

    throw err;

  }

  return data;

}



export async function fetchPublicBooleanSetting(path, defaultValue = true) {

  try {

    const res = await fetchClient(path);

    const data = await parseJson(res);

    if (!res.ok) return defaultValue;

    return data.enabled !== false;

  } catch {

    return defaultValue;

  }

}



export async function fetchEnglishTestRegistrationEnabledPublic() {

  return fetchPublicBooleanSetting(PATHS.englishTestRegistration);

}



export async function fetchEnglishTestRegistrationGroupEnabledPublic() {

  return fetchPublicBooleanSetting(PATHS.englishTestRegistrationGroup);

}



export async function fetchSystemSettingsBundle(token, userRole) {

  const headers = adminAuthHeaders(token, userRole);

  const tasks = await Promise.allSettled([

    fetchClient(PATHS.englishTestRegistration, { headers }).then((r) => r.json()),

    fetchClient(PATHS.englishTestRegistrationGroup, { headers }).then((r) => r.json()),

  ]);

  return {

    englishTestRegistrationEnabled: tasks[0].status === 'fulfilled' ? tasks[0].value.enabled !== false : true,

    englishTestRegistrationGroupEnabled: tasks[1].status === 'fulfilled' ? tasks[1].value.enabled !== false : true,

    allSettingsFailed: tasks.every((t) => t.status === 'rejected'),

  };

}



export async function updateSystemSetting(token, userRole, path, enabled) {

  const res = await fetchClient(path, {

    method: 'PUT',

    headers: adminAuthHeaders(token, userRole),

    body: JSON.stringify({ enabled }),

  });

  return throwIfNotOk(res, '更新設定失敗');

}



export { PATHS as SETTINGS_PATHS };



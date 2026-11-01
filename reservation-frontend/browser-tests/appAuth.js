/**
 * 測試專用認證狀態：合成 JWT payload，再用正式 buildAccessProfile 解讀。
 * 不是後端登入，也不寫入真實憑證。
 */
export function encodeHarnessToken(payload) {
  const body = btoa(JSON.stringify(payload))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `e30.${body}.sig`;
}

export function harnessProfilePayload(profile = 'admin') {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const payloads = {
    admin: { role: 'admin', exp },
    executive: { role: 'teacher', teacherLevel: 'executive', exp },
    teacher: { role: 'teacher', teacherLevel: 'regular', exp },
    classOnly: {
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: { can_view_analytics: false },
      exp,
    },
    learning: {
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: {
        can_view_analytics: false,
        can_view_classes: false,
        can_view_learning_analytics: true,
      },
      exp,
    },
    operations: {
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: { can_view_classes: false },
      exp,
    },
    none: { role: 'office_staff', staffLevel: 'event_lead', exp },
  };
  if (profile === 'anonymous') return null;
  return payloads[profile] || payloads.admin;
}

export function applyHarnessAuth(profile = 'admin') {
  const payload = harnessProfilePayload(profile);
  if (!payload) {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('teacherName');
    localStorage.removeItem('mustResetPassword');
    return { token: '', userRole: '', username: '' };
  }
  const token = encodeHarnessToken(payload);
  localStorage.setItem('token', token);
  localStorage.setItem('userRole', payload.role);
  localStorage.setItem('username', `syn-${profile}`);
  localStorage.setItem('mustResetPassword', 'false');
  if (payload.role === 'teacher') {
    localStorage.setItem('teacherName', '合成教師');
  } else {
    localStorage.removeItem('teacherName');
  }
  return { token, userRole: payload.role, username: `syn-${profile}` };
}

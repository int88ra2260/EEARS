'use strict';

const path = require('path');
const { execFile } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const CACHE_MS = 20000;
const GIT_TIMEOUT_MS = 8000;
const FETCH_TIMEOUT_MS = 20000;

let cache = { at: 0, data: null };

function gitExec(args, timeoutMs = GIT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', REPO_ROOT, ...args],
      {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 512 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GCM_INTERACTIVE: 'Never',
        },
      },
      (err, stdout, stderr) => {
        if (err) {
          const wrapped = new Error(String(stderr || err.message || 'git failed').split('\n')[0].trim());
          wrapped.code = 'GIT_FAILED';
          reject(wrapped);
          return;
        }
        resolve(String(stdout || '').trim());
      }
    );
  });
}

function sanitizeRemoteUrl(url) {
  return String(url || '').replace(/\/\/[^@/\s]+@/, '//');
}

function parseGitHubRepo(url) {
  const text = sanitizeRemoteUrl(url).replace(/\.git$/, '');
  const match = text.match(/github\.com[:/]([^/\s]+)\/([^/\s]+)$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function parseCommitLine(text) {
  const [sha = '', subject = '', committedAt = ''] = String(text || '').split('\x1f');
  return {
    sha: sha.trim(),
    shortSha: sha.trim().slice(0, 7),
    subject: subject.trim(),
    committedAt: committedAt.trim() || null,
  };
}

function summarizeSync({ localSha, remoteSha, ahead, behind }) {
  if (!remoteSha) {
    return { state: 'unknown', label: '無法讀取 GitHub main', tone: 'secondary' };
  }
  if (localSha && localSha === remoteSha) {
    return { state: 'synced', label: '已與 GitHub main 一致', tone: 'success' };
  }
  if (behind > 0 && ahead === 0) {
    return {
      state: 'behind',
      label: `GitHub main 超前 ${behind} 個 commit，部署尚未套用`,
      tone: 'warning',
    };
  }
  if (ahead > 0 && behind === 0) {
    return {
      state: 'ahead',
      label: `這台機器超前 GitHub main ${ahead} 個 commit`,
      tone: 'warning',
    };
  }
  if (ahead > 0 && behind > 0) {
    return { state: 'diverged', label: '這台機器與 GitHub main 已分叉', tone: 'danger' };
  }
  return { state: 'different', label: '版本與 GitHub main 不同', tone: 'warning' };
}

function summarizeWorkflowRun(run) {
  if (!run) return null;
  let label = '未知';
  let tone = 'secondary';
  if (run.status && run.status !== 'completed') {
    label = '進行中';
    tone = 'warning';
  } else if (run.conclusion === 'success') {
    label = '成功';
    tone = 'success';
  } else if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
    label = '失敗';
    tone = 'danger';
  } else if (run.conclusion === 'cancelled') {
    label = '已取消';
    tone = 'secondary';
  } else if (run.conclusion === 'skipped') {
    label = '略過';
    tone = 'secondary';
  }
  return {
    name: run.name || '',
    label,
    tone,
    inProgress: label === '進行中',
    sha: String(run.head_sha || '').slice(0, 7),
    title: run.display_title || run.head_commit?.message || '',
    updatedAt: run.updated_at || run.created_at || null,
    url: run.html_url || null,
    runNumber: run.run_number || null,
  };
}

function summarizeRunner(runner) {
  let label = '離線';
  let tone = 'secondary';
  if (runner?.status === 'online' && runner.busy) {
    label = '部署中';
    tone = 'warning';
  } else if (runner?.status === 'online') {
    label = 'Idle';
    tone = 'success';
  }
  return {
    name: runner?.name || '',
    label,
    tone,
    busy: Boolean(runner?.busy),
    status: runner?.status || 'offline',
  };
}

function githubToken() {
  return String(process.env.GITHUB_OPS_TOKEN || '').trim();
}

async function githubGet(pathname, token) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'EEARS-ops',
    },
  });
  if (!response.ok) {
    const err = new Error(`GitHub API ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

function githubErrorMessage(error) {
  if (error?.status === 401) return 'GITHUB_OPS_TOKEN 無效或已過期';
  if (error?.status === 403) return 'GITHUB_OPS_TOKEN 權限不足（需要 Actions 讀取；runner 狀態另需 Administration 讀取）';
  return '無法讀取 GitHub Actions';
}

async function readCommit(rev) {
  const line = await gitExec(['log', '-1', `--format=%H%x1f%s%x1f%cI`, rev]);
  return parseCommitLine(line);
}

async function collectGitStatus() {
  const branch = await gitExec(['rev-parse', '--abbrev-ref', 'HEAD']);
  const remoteUrl = sanitizeRemoteUrl(await gitExec(['remote', 'get-url', 'origin']));
  const repo = parseGitHubRepo(remoteUrl);
  const local = await readCommit('HEAD');
  local.branch = branch;

  const porcelain = await gitExec(['status', '--porcelain', '-uno']);
  local.dirtyTrackedCount = porcelain ? porcelain.split('\n').filter(Boolean).length : 0;

  let fetchError = null;
  try {
    await gitExec(['fetch', 'origin', 'main'], FETCH_TIMEOUT_MS);
  } catch (error) {
    fetchError = error.message || 'git fetch 失敗';
  }

  let remote = null;
  let ahead = 0;
  let behind = 0;
  try {
    remote = await readCommit('origin/main');
    remote.branch = 'main';
    const counts = await gitExec(['rev-list', '--left-right', '--count', 'HEAD...origin/main']);
    const [left, right] = counts.split(/\s+/).map((n) => Number(n) || 0);
    ahead = left;
    behind = right;
  } catch (error) {
    fetchError = fetchError || error.message || '無法讀取 origin/main';
  }

  const sync = summarizeSync({ localSha: local.sha, remoteSha: remote?.sha, ahead, behind });
  const repoUrl = repo ? `https://github.com/${repo.owner}/${repo.repo}` : null;
  return {
    remoteUrl,
    repo,
    repoUrl,
    actionsUrl: repoUrl ? `${repoUrl}/actions` : null,
    local,
    remote,
    ahead,
    behind,
    sync,
    fetchError,
  };
}

async function collectGitHubActions(repo) {
  const token = githubToken();
  if (!token) {
    return {
      configured: false,
      error: null,
      note: '尚未設定 GITHUB_OPS_TOKEN。版本比對仍可用；CI、部署與 runner 需要這組只讀 token。',
      workflows: [],
      runners: [],
    };
  }
  if (!repo) {
    return {
      configured: true,
      error: 'origin 不是 GitHub 網址，無法查 Actions',
      note: null,
      workflows: [],
      runners: [],
    };
  }

  const base = `/repos/${repo.owner}/${repo.repo}`;
  const workflows = [];
  let error = null;
  try {
    const [ci, deploy] = await Promise.all([
      githubGet(`${base}/actions/workflows/ci.yml/runs?per_page=1`, token),
      githubGet(`${base}/actions/workflows/deploy-prod.yml/runs?per_page=1`, token),
    ]);
    const ciRun = summarizeWorkflowRun(ci.workflow_runs?.[0]);
    const deployRun = summarizeWorkflowRun(deploy.workflow_runs?.[0]);
    if (ciRun) workflows.push({ ...ciRun, name: 'CI' });
    if (deployRun) workflows.push({ ...deployRun, name: 'Deploy production' });
  } catch (err) {
    error = githubErrorMessage(err);
  }

  let runners = [];
  try {
    const body = await githubGet(`${base}/actions/runners?per_page=20`, token);
    runners = (body.runners || []).map(summarizeRunner);
  } catch (err) {
    const message = githubErrorMessage(err);
    error = error ? `${error}；${message}` : message;
  }

  return {
    configured: true,
    error,
    note: null,
    workflows,
    runners,
  };
}

async function getGitHubOpsStatus({ refresh = false } = {}) {
  const freshEnough = cache.data && Date.now() - cache.at < CACHE_MS;
  if (!refresh && freshEnough) return cache.data;

  const git = await collectGitStatus();
  const github = await collectGitHubActions(git.repo);
  const data = {
    ...git,
    github,
    checkedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}

function _resetGitHubOpsCacheForTests() {
  cache = { at: 0, data: null };
}

module.exports = {
  sanitizeRemoteUrl,
  parseGitHubRepo,
  summarizeSync,
  summarizeWorkflowRun,
  summarizeRunner,
  getGitHubOpsStatus,
  _resetGitHubOpsCacheForTests,
};

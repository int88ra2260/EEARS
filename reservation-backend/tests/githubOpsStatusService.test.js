'use strict';

const {
  parseGitHubRepo,
  sanitizeRemoteUrl,
  summarizeSync,
  summarizeWorkflowRun,
  summarizeRunner,
} = require('../services/githubOpsStatusService');

describe('githubOpsStatusService', () => {
  it('parses GitHub remotes without keeping credentials', () => {
    expect(sanitizeRemoteUrl('https://user:secret@github.com/int88ra2260/EEARS.git'))
      .toBe('https://github.com/int88ra2260/EEARS.git');
    expect(parseGitHubRepo('git@github.com:int88ra2260/EEARS.git')).toEqual({
      owner: 'int88ra2260',
      repo: 'EEARS',
    });
    expect(parseGitHubRepo('https://github.com/int88ra2260/EEARS')).toEqual({
      owner: 'int88ra2260',
      repo: 'EEARS',
    });
  });

  it('describes whether this machine matches GitHub main', () => {
    expect(summarizeSync({ localSha: 'aaa', remoteSha: 'aaa', ahead: 0, behind: 0 }).state).toBe('synced');
    expect(summarizeSync({ localSha: 'aaa', remoteSha: 'bbb', ahead: 0, behind: 2 }).state).toBe('behind');
    expect(summarizeSync({ localSha: 'aaa', remoteSha: 'bbb', ahead: 1, behind: 1 }).state).toBe('diverged');
    expect(summarizeSync({ localSha: 'aaa', remoteSha: '', ahead: 0, behind: 0 }).state).toBe('unknown');
  });

  it('labels workflow runs and runners for the ops page', () => {
    expect(summarizeWorkflowRun({
      status: 'completed',
      conclusion: 'success',
      head_sha: 'abcdef123456',
      html_url: 'https://github.com/int88ra2260/EEARS/actions/runs/1',
    }).label).toBe('成功');
    expect(summarizeWorkflowRun({ status: 'in_progress', conclusion: null }).inProgress).toBe(true);
    expect(summarizeRunner({ name: 'DESKTOP-DP1C2CE', status: 'online', busy: false }).label).toBe('Idle');
    expect(summarizeRunner({ name: 'DESKTOP-DP1C2CE', status: 'online', busy: true }).label).toBe('部署中');
  });
});

# UX Consolidation 祖先

命令與 exit code：

```text
git merge-base --is-ancestor consolidation/phase-2a-ux-fixes main
exit 0

git merge-base --is-ancestor consolidation/phase-2b-empty-state main
exit 0

git merge-base --is-ancestor consolidation/phase-2c-empty-state-adoption main
exit 0
```

三條都成立。尖端分別是 `a0b45e1`、`3d9f205`、`e2ab111`。

因此：

- 不需要再 merge 這些分支。
- 不需要 cherry-pick。
- 不需要重做 Phase 2a–2c。

它們的工作樹已追蹤內容是乾淨的。本次沒有改那些目錄。

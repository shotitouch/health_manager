---
name: commit-push-pr
description: Stage changes, commit with co-author footer, push, and open a GitHub PR
---

Create a commit, push, and open a pull request for the current changes.

Current git status:

```
$(git status --short 2>&1)
```

Recent commits (for message style reference):

```
$(git log --oneline -5 2>&1)
```

Steps:

1. Review the changed files above and group them logically
2. Stage the relevant files (prefer specific file names over `git add .`)
3. Write a concise commit message focused on WHY, not what — follow the style of recent commits
4. Commit with:
   ```
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
5. Push to remote (`git push -u origin HEAD` if first push on this branch)
6. Create PR with `gh pr create` — short title, bullet-point summary, test plan in body

Do not force push. Do not skip hooks. If no remote exists yet, stop after commit and tell the user.

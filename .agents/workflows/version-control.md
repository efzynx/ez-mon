---
description: version control tracking
---

Version control. When I say "this change will be committed to version xxxx" or I say I will push this change to a specific version, don't forget to update all documentation and changelogs. Then don't forget to take the changelog reference from the DEVELOPMENT.md log file. After you finish updating CHANGELOG.md by taking the DEVELOPMENT.md reference, you must delete the contents of DEVELOPMENT.md but the file will remain. This is so that the log for each session is always fresh and not mixed with the previous log. Then don't forget to create a short message so I can manually commit using git. DON'T FORGET to always use English in CHANGELOG.md, DEVELOPMENT.md, and the commit message to stay consistent in English and not mixed with Indonesian.

> [!CAUTION]
> **STRICT WARNING:**
> **NEVER** issue or suggest a `git push` command from the `dev` branch. If the agent (AI) is working on `dev`, it **MUST** instruct the user to merge into `main` or a valid release branch first. If the agent violates this, the user has the right to reject the command and penalize the agent.%  
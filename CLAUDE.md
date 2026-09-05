# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

开发文档真源在 `AGENTS.md`(跨宿主,含全部架构说明、常用命令与关键不变量);本文件只是 Claude Code 薄壳,MUST NOT 在此复制 AGENTS.md 正文(防双头漂移)。Claude Code 专属注意事项:

- 命令正文裸调 `speccode <verb>`(经 `bin/speccode` wrapper 依赖插件 `bin/` 进 PATH,仅 Claude Code 启用本插件时生效;其他宿主由各自 adapter 提供 PATH shim);手动调试用 `node bin/speccode.mjs <verb> --cwd .`。
- 本仓自用的 `speccode-workflow` skill 经 `bash support/install-skills.sh` 安装到 `.claude/skills/`,供 Claude Code 会话懒加载(首次 clone 或 `support/` 有改动后重跑)。

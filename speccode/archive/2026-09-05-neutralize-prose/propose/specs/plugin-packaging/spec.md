# plugin-packaging Delta

## MODIFIED Requirements

### Requirement: 命令通过 bin/ PATH 裸调引擎

命令正文 SHALL 通过裸调 `speccode <verb> --cwd .` 引擎——`bin/speccode` wrapper(可执行,转调同目录 `bin/speccode.mjs`)依赖插件 `bin/` 在启用期间被加入 PATH,或由宿主安装步骤提供的 PATH shim 解析;prose MUST NOT 写死 `node <绝对或相对路径>/speccode.mjs`、`speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态。`bin/speccode.mjs` 与 `bin/speccode` MUST 均具备可执行位;`speccode.mjs` 直调保留为手动终端调试形态(AGENTS.md 指引)。stdin 管道写法(`echo '<json>' | speccode <verb> --json-stdin`)MUST 保持兼容。

#### Scenario: 命令正文裸调形态
- **WHEN** 检查 `skills/*/SKILL.md` 与 `references/*.md`
- **THEN** 引擎调用写作 `speccode <verb> --cwd .`,不存在 `speccode.mjs <verb>`、`node plugins/speccode/...`、`node .claude/speccode/...` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态的引用

#### Scenario: stdin 管道写法兼容
- **WHEN** 命令需写入 config/state
- **THEN** 写作 `echo '<json>' | speccode <verb> --cwd . --json-stdin`,wrapper 与直调两种入口下管道数据均正常进入 stdin

#### Scenario: 引擎 wrapper 可执行性
- **WHEN** 检查 `bin/speccode` 文件权限并分别执行 `speccode <verb> --cwd .` 与 `node bin/speccode.mjs <verb> --cwd .`
- **THEN** wrapper 具备可执行位,两种入口对同一 verb 的输出一致

#### Scenario: speccode.mjs 手动调试形态保留
- **WHEN** 检查 `bin/speccode.mjs` 文件权限与 AGENTS.md 的调试指引
- **THEN** 首行为 `#!/usr/bin/env node`、文件具备可执行位,AGENTS.md 手动调试指引仍为 `node bin/speccode.mjs <verb> --cwd .`

### Requirement: 命令正文手写路径与引擎一致

命令正文里手写的 `.speccode/` 相对路径(`reset` 的 `rm -rf .speccode/state/`、`reset` 询问清理的 `.speccode/memory/` 与 `.speccode/sdd/` 等)SHALL 以 `--cwd` 指向的项目根为基准,与引擎 `speccodeDirOf(cwd)` 解析的目录一致。这保证裸调方案下命令正文的手写路径与引擎写入路径落在同一 `.speccode/` 目录。

#### Scenario: 手写路径与引擎写入路径一致
- **WHEN** 命令正文执行 `rm -rf .speccode/state/`(reset)或引用 `.speccode/memory/`、`.speccode/sdd/`(reset 清理询问、SDD 工作区),且 `--cwd .` 指向目标项目根
- **THEN** 这些手写路径解析到的目录与 `speccode resolve-speccode-dir --cwd .` 返回的 `speccodeDir` 相同(均为 `<repoRoot>/.speccode`),不会因裸调方式改变基准

#### Scenario: 不出现已删除机制的用例
- **WHEN** 检查本 requirement 的正文与 Scenario
- **THEN** MUST NOT 以 display-reset-to-trunk 命令、`untracked_permanent` 字段或 `.speccode/backup/` 等 v2 已删除的机制作为用例

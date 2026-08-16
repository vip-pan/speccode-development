# code-intel-rename Design

## Context

speccode 里 `knowledge` 一词指两个不同概念:
- **A. `knowledge_tools`**(config 字段):代码索引/图谱 MCP 工具(codemap / understand-anything / ...),功能 = 索引(search)+ 图谱(symbol/call/type/dep/cypher)= code intelligence。不是知识库。
- **B. `knowledge` 知识集**:`speccode/knowledge/`(tracked)、`knowledge.mjs`、`read-knowledge`/`write-knowledge`、`recording-knowledge`/`distilling-knowledge`、`knowledge-set` capability。真正的知识库。

A 占了 `knowledge` 词根,让 B(真知识库)与 A 在命令 prose/CLAUDE.md 都叫"知识..."混淆。改名 A,让 `knowledge` 回归 B。

## Goals

- `knowledge` 词根回归知识集(`knowledge-set` / `recording-knowledge` / `distilling-knowledge` / `read-knowledge` / `write-knowledge`)。
- 新名 `code_intel_tools` 从功能贴切(涵盖索引 + 图谱,code intelligence 业内通用),不撞具体 detector id。
- 层 3 彻底:capability 目录 RENAME。

## Non-Goals

- 不改知识集 `knowledge`(`knowledge-set` capability / `speccode/knowledge/` / `knowledge.mjs` / `read-knowledge` / `write-knowledge` / `recording-knowledge` / `distilling-knowledge`)。
- 不兼容历史(不 bump config version 迁移,改完重新 init)。
- 不改 detector 表内容(understand-anything / codegraph / graphify / codemap / gitnexus 不变;只改字段名 / 函数名 / verb)。
- 不重组 capability(worktree 基础目录配置 requirement 历史上凑在 knowledge-tool-integration,改名后随迁到 code-intel-tool-integration,不挪走)。

## Decisions

### D1 新名 `code_intel_tools`
功能 = 索引 + 图谱 = code intelligence(Sourcegraph / LSP 类工具统称)。不撞具体 detector id(codegraph / codemap / graphify / gitnexus / understand-anything)。简短,与现有字段风格一致(worktree_dir / pr_tool)。

### D2 verb `detect-code-intel-tools`
跟随字段名。

### D3 capability 目录 `code-intel-tool-integration`
层 3 RENAME:目录名 + 内部 Purpose / requirement 名 / 字段 scenario 全改。

### D4 中文"代码智能工具"
命令 prose "知识库工具咨询" → "代码智能工具咨询"。

### D5 不兼容重 init
`loadConfig` 不回退旧字段;用户改完重新 `/speccode:init` 重新探测写入(旧 `knowledge_tools` 字段被新 init 重写为 `code_intel_tools`)。

### D6 capability 目录 RENAME:扩展 syncing 轻量版(brainstorming 决策)

syncing 是 agent 驱动 prose(无 lib 合并函数),capability RENAME 的 `git mv` 也由 agent 执行(prose 指示),与 syncing 现状一致:
- **delta 元数据约定**:`propose/specs/<新cap>/spec.md` 顶部 HTML 注释 `<!-- speccode:rename-from: <旧capability> -->`。
- **syncing.md 加「capability RENAME 处理」段**:合并前扫描 delta,含 `rename-from` 元数据 → `git mv speccode/spec/<旧>/ <新>/`(新目录已存在则跳过,幂等)→ 继续常规合并 delta 到新目录。旧目录随 mv 消失,无空壳。
- **单测**:cli.test.mjs 文档断言(syncing.md 提 capability RENAME + rename-from 元数据)。
- 否决 (c) 空壳残留 / (b) 手动 mv 不可复现 / (d) implementing 绕过违反约定。详见 `brainstorm/2026-08-16-capability-rename-design.md`。

## Risks

- **R1 BREAKING config**:既有 config.json `knowledge_tools` 失效。缓解:改完重新 init;dogfood + 早期用户,可接受。
- **R2 capability 目录 RENAME 机制 gap**:已由 D6 决策(扩展 syncing 轻量版:delta `rename-from` 元数据 + syncing.md RENAME 段)解决。

## Open Questions

无(Q1 已在 brainstorming 决策为 D6,见 `brainstorm/2026-08-16-capability-rename-design.md`)。spec delta 已加 `rename-from` 元数据(见 `specs/code-intel-tool-integration/spec.md` 顶部)。

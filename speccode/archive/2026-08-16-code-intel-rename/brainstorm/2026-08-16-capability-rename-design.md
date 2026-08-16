# Capability Rename 机制设计(brainstorm)

## 问题

speccode spec delta/syncing 体系只有 **requirement 级** RENAMED(FROM:/TO:),无 **capability 级** RENAME/删除。capability 目录只支持"新建"(主规格无 → syncing 创建),没有 capability 目录 RENAME/删除。所以 `knowledge-tool-integration → code-intel-tool-integration` 无法通过 delta 干净表达:propose 用新名 → syncing 新建新 capability;旧目录只能 REMOVED requirements,空壳残留。

## 决策:(a) 扩展 syncing 轻量版

### delta 元数据约定

`propose/specs/<新cap>/spec.md` 顶部 HTML 注释元数据:

```markdown
<!-- speccode:rename-from: <旧capability名> -->
# <新cap> Delta
...
```

HTML 注释不渲染、Markdown 工具忽略,syncing agent 读取。

### syncing.md 加「capability RENAME 处理」段

syncing 合并前扫描 delta 文件:若顶部含 `rename-from` 元数据 →

1. `git mv speccode/spec/<旧>/ speccode/spec/<新>/`(若新目录已存在,跳过 mv,只合并 —— 幂等);
2. 继续常规合并 delta 到新目录(MODIFIED/ADDED requirements)。

旧目录随 `git mv` 消失,无空壳。

### 幂等

重跑 syncing:新目录已存在(`rename-from` 元数据仍在,但旧目录已 mv 走,`git mv` 检测目标已存在则跳过),合并 delta 幂等(按 requirement 标题去重)。

### 实现性质

syncing 是 **agent 驱动 prose**(无 lib 合并函数;命令正文"你直接读 delta 并编辑主规格")。capability RENAME 的 `git mv` 也由 agent 执行(prose 指示),与 syncing 现状一致 —— 不引入新 lib 函数。单测用 cli.test.mjs 文档断言(syncing.md 提 capability RENAME + rename-from 元数据约定)。

### 触及

- `commands/syncing.md`:加「capability RENAME 处理」段(合并前扫描 rename-from → git mv → 合并)。
- `propose/specs/code-intel-tool-integration/spec.md`:顶部加 `<!-- speccode:rename-from: knowledge-tool-integration -->`。
- `tests/cli.test.mjs`:文档断言 syncing.md 提 capability RENAME + rename-from 元数据。

## 否决

- **(c) ADDED 新 + REMOVED 旧 + 空壳残留**:旧目录删空 requirement 后剩 `# ...Specification / ## Purpose / ## Requirements`(空)空壳,需手动 rm,不干净。
- **(b) syncing 阶段手动 git mv**:超出 syncing 命令定义,不可复现(依赖人手动)。
- **(d) implementing 阶段直接 git mv + 绕过 syncing**:违反「主规格改动走 syncing」约定。

## YAGNI 检视

capability 改名罕见(本次首次),但**本次就需要**。(a) 是干净正解(无空壳、可复现、补 speccode 缺口),不是为假想需求加功能。后续 capability 改名复用同一机制。

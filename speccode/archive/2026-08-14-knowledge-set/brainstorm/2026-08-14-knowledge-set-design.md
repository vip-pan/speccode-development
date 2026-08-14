# knowledge-set 设计(2026-08-14)

## Context

speccode 现有两层知识形态:`spec/`(tracked,「系统应该是什么」,delta 合并)与 `memory/`(untracked 暂态,「这个 feature 聊到哪」,按 feature 隔离)。缺第三层——「我们知道了什么」:跨 feature 持久、可人工策展、被团队共享与版本化的知识(决策/架构模式/团队约定/坑/术语表)。

exploring 结论(承接自 `_exploring`,见 feature 记忆)已定:知识集 = tracked、可检索、按主题组织的知识库,落 `speccode/knowledge/`;来源 = 晋升命令从 spec/archive 蒸馏 + 直写路径;消费 = 读 `_index.md` 索引 → 按需读 topic 文件。本设计精化四个未定点:范围边界、晋升机制、直写命令形态、入口接入面。

F2(knowledge_tools 检测修复,PR #19)已交付两维度检测模型(available/integrated),T2 语义检索依赖其项目级集成判据,但不在本 feature 内。

## Goals

- 新增 tracked 的 `speccode/knowledge/` 层:按主题组织的 topic 文件 + `_index.md` 检索入口。
- 晋升命令 `/speccode:promote-knowledge`:从 spec/archive 全量重蒸 promoted 段,经人工闸门落盘。
- 直写命令 `/speccode:memorize`:人/agent 直接写知识,经人工闸门落盘。
- 消费入口:9 个认知型命令入口读索引 → 按需读 topic,失败静默兜底。

## Non-Goals

- T1 recall verb、T2 语义检索:不进本 feature(演进路线,决策 4)。
- hook 事件扩展:14 个事件名保持不动,晋升/记忆不触发 hook。
- memory 机制改动(迁 feature 是单独一条线,决策 6)。
- Roadmap 入知识集(决策 5)。
- knowledge/ 反向写 spec/(spec 是上游,syncing 的职责不动)。

## Decisions

### D1 范围 = T0 完整闭环

**选定 A**:knowledge/ 层 + 晋升命令 + 直写命令 + SDD 入口接入,读/写闭环成立。
**被否**:B(A + T1 recall verb,留作演进);C(更瘦,直写与接入留后续——直写是决策 2 核心,砍掉则不闭环)。

### D2 晋升 = 全量重建 + 来源标记

**选定 A**:promoted 段每次从 spec/archive 全量重蒸重写(幂等、无游标、无合并腐烂);hand-written 段保留不动。
**被否**:B(增量合并 + git 派生游标——实现复杂度高、合并腐烂风险,且知识集规模小、晋升低频,全量代价可忽略);C(纯全量重建——与直写路径冲突)。
**推论**:exploring 决策 7(增量游标 = git 派生)被本决策吸收废弃——全量重建下不需要游标。

### D3 直写 = 独立 memorize 命令

**选定 A**:新建 `/speccode:memorize`,职责单一,走「草稿 → 用户确认 → 原子写」闸门。
**被否**:B(复用晋升命令入口——触发时机、输入、闸门展示都不同,复用反而复杂);C(无命令直写——绕过闸门,违背决策 3)。

### D4 接入面 = 认知型命令全接

**选定 A**:exploring / proposing / brainstorming / writing-plans / executing-plans / subagent-driven-development / systematic-debugging / requesting-code-review / receiving-code-review 共 9 个命令入口接入。
**被否**:B(仅核心 3 个——面太窄);C(全部 21 个——流程管理型命令不需要知识)。

### D5 来源标记 = 段落级 marker

**选定 B**:`<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 围住蒸馏块。文件默认 hand-written;一文件多块多来源;晋升只重写块内,块外字节级保留。
**被否**:A(文件头 frontmatter——解析 YAML 违背零依赖,单文件混两种来源不行);C(分文件——同主题知识被劈两处,破坏按主题组织)。

### D6 蒸馏是 LLM 判断,lib 只做确定性部分

遵守「确定性逻辑下沉 lib」不变量:蒸馏(从 spec/archive 提炼知识)只能由命令层(prose)做;lib/knowledge.mjs 只承担 marker 解析、块替换、索引生成、原子写等文本确定性部分。

### D7 闸门 = 会话内确认(MVP)

晋升/直写产出先以候选形态展示,经用户确认才写 tracked 层(防蒸馏失真 + 防不该进 PR 的内容)。落盘草稿区 `knowledge/_draft/` 作为可选演进(跨会话审阅需求出现时再演),本 feature 不做。

## Architecture

### 存储层(tracked,与 spec/changes/archive 平级)

```
speccode/knowledge/
├── _index.md                  ← 检索入口:每主题一行摘要 + 文件指针
├── business/
│   ├── domain.md                领域知识 + 术语表
│   ├── workflows.md             业务逻辑/流程
│   └── lineage.md               历史路线
└── development/
    ├── architecture.md          架构/设计模式/ADR
    ├── standards.md             开发准则(含前端规范)
    ├── environment.md           依赖配置/部署拓扑/工具集
    ├── integrations.md          第三方对接/数据模型
    ├── pitfalls.md              异常整理/已知限制/技术债
    └── security.md              安全漏洞/合规
```

初始 topic 清单可演进,后续 feature 可增删文件。`_index.md` 用分组列表(非表格):

```markdown
# 知识索引
## 业务方向
- 领域知识 → business/domain.md:一句话摘要
- 业务流程 → business/workflows.md:…
## 开发方向
- 架构 → development/architecture.md:…
```

marker 块示例(文件默认 hand-written,蒸馏内容以块嵌入):

```markdown
<!-- promoted-from: archive/2026-08-13-knowledge-tools-detection/ -->
F2 将 knowledge_tools 检测改为 available/integrated 两维度模型…
<!-- /promoted -->
```

### lib + verbs

```
lib/knowledge.mjs(新增,纯函数)
  knowledgeRoot(repoRoot)          → <root>/speccode/knowledge
  listTopics(root)                 → topic 文件清单 + _index 摘要
  parsePromotedBlocks(text)        → [{source, body}](marker 解析)
  replacePromotedBlocks(text, blocks) → 逐块替换,块外字节级保留
  buildIndex(entries)              → 生成 _index.md
  writeKnowledge(root, relPath, content) → 复用 atomic.writeTextAtomic

bin verbs(新增 2 个)
  read-knowledge --cwd . [--index | --topic <name>]  → 读索引/读 topic
  write-knowledge --cwd . --rel <path> --json-stdin  → {mode, content} 原子写
```

### 晋升路径 `/speccode:promote-knowledge`

1. read-knowledge --index + 各 topic → 现状(含 promoted 块与 source)。
2. 读 speccode/spec/ + archive/。
3. LLM 逐 topic 蒸馏(promoted 内容全量重蒸;hand-written 内容作参考上下文)。
4. 展示候选 diff(逐 topic:新增/变化/删除的块)。
5. 闸门:AskUserQuestion 逐 topic 确认(可整批)。
6. 确认的经 write-knowledge(mode: replace-promoted)原子写。
7. `_index.md` 若有新 topic/摘要变化 → buildIndex 重生成。
8. 落盘即提交 + 更新 feature 记忆。

### 直写路径 `/speccode:memorize`

1. read-knowledge --index + 相关 topic → 现状。
2. 用户/agent 给出知识内容(任一主题)。
3. 展示草稿(写入位置 + 内容)→ 闸门确认。
4. write-knowledge(mode: append-hand 或 replace)原子写(hand-written 段,无 marker)。
5. `_index.md` 若新 topic → 更新。
6. 落盘即提交。

### 消费路径(9 命令入口)

```
## 知识库入口
1. read-knowledge --cwd . --index 读 _index.md(恒读,便宜);
2. 判断本任务相关主题 → 直接 Read 对应 topic 文件;
3. knowledge/ 不存在或读取失败 → 静默跳过,绝不阻断主流程。
```

## 边界与错误处理

| 场景 | 行为 |
|---|---|
| `knowledge/` 不存在 | 消费入口静默跳过;promote/memorize 首次运行创建骨架(目录 + `_index.md` + 初始 topic 空文件) |
| marker 解析失败 | 报错退出(文件损坏要人看),不静默不猜测 |
| source 指向的 archive 已消失 | 该块标 stale,闸门内展示给人处置 |
| 蒸馏结果与现状无差异 | 幂等,跳过写,报告「无变化」 |
| 入口读取失败 | 静默跳过(永不阻断主流程) |
| `_index.md` 缺失但 topic 文件存在 | promote/memorize 时 buildIndex 重建 |

## Risks

| 风险 | 缓解 |
|---|---|
| 蒸馏失真(LLM 从 spec/archive 提炼走样) | 闸门:候选 diff 经人确认才落盘 |
| 晋升重蒸覆盖手写内容 | 来源标记:只重写 promoted 块,块外字节级保留;测试覆盖字节级保留 |
| 知识集内容膨胀、_index 失修 | 命令出口更新 _index;promote/memorize 时重建校验 |
| 命令入口 prose 重复 9 处、后续漂移 | 接入段文案统一模板;prose 改动集中在入口小节 |
| marker 格式被手编破坏 | parsePromotedBlocks 单测钉死格式;解析失败显式报错 |

## Open Questions

- 无(晋升全量 vs 增量、直写命令形态、topic 清单、范围边界均已在本设计定案)。

## Testing

- `tests/knowledge.test.mjs`(新增):marker 解析、块替换(字节级保留)、buildIndex、listTopics 纯函数单测。
- `tests/cli.test.mjs`(扩展):read-knowledge / write-knowledge e2e(真实临时仓库)。
- 命令层(prose)无单测,靠 dogfood 验证。

## Spec Delta

新增 capability `knowledge-set`(主规格尚不存在,delta 带 `## Purpose` 段),四个 scenario:
1. 知识集目录结构(布局 + `_index.md`);
2. 晋升路径(全量重蒸 promoted 段 + 来源标记 + 闸门);
3. 直写路径(memorize + 闸门);
4. 消费路径(9 命令入口 + 静默兜底)。

# Design: knowledge-command-rename

## Context

四层命名现状:verb(`read-knowledge`/`write-knowledge` ↔ `read-memory`/`write-memory`)、lib(`knowledge.mjs` ↔ `memory.mjs`)、spec(`knowledge-set` ↔ `session-memory`)三层词对词对称;唯命令层 `memorize`/`promote-knowledge` 断裂——前者名指 memory 实写 knowledge,后者以 marker 类型(promoted 块)命名而非操作本质(蒸馏)。23 命令主流约定为动名词领衔(`proposing`/`syncing`/`archiving`/`creating-feature`/`finishing-feature`)。knowledge-set 刚完成收窄(骨架 9→6、business/* 日落),存量项目 knowledge 文件可能含旧 `promoted-from` marker。pre-1.0 dogfood 阶段,breaking 窗口成本低;用户即本仓。

## Goals

- 命令名见名知义:名字直指存储(knowledge)与操作(record 收录 / distill 蒸馏),两命令成对可辨。
- 术语栈同词根:命令名 ↔ 块术语 ↔ marker ↔ verb mode ↔ lib 函数一致。
- 存量零迁移负担:旧 marker 文件照常解析,重写随全量重建自然发生。
- 顺手修复 plugin-packaging 命令枚举漂移(21 → 23)。

## Non-Goals

- 不改 verb 名(`read-knowledge`/`write-knowledge` 已工整)与 `.speccode/memory/` 体系。
- 不引入用户-facing 的 memory 写入命令(memory 保持隐式运行时,由命令出入口 append);`memorize` 一名腾空后弃用,不再启用。
- 不动 `speccode/archive/` 冻结历史中的旧名字样。
- 不变 23 命令总数与知识集行为语义(闸门、日落、幂等、骨架结构全部保留)。

## Decisions

### D1 动名词构词:`recording-knowledge` / `distilling-knowledge`

对齐 `creating-feature`/`finishing-feature` 的「动名词-宾语」血统,命令表内与 `proposing`/`syncing`/`archiving` 同族;`distill` 是规格自己的词(规格全文说「蒸馏」),操作本质即蒸馏 + 全量重建 + 日落。被否备选:

- **A `knowledge-add`/`knowledge-distill`(存储锚定)**:命令面板聚簇好看,但破动名词约定,与既有 23 命令血统不合。
- **C `memorize-knowledge`/`promote-knowledge`(最小修补)**:构词对齐了,但 memorize 仍撞 session-memory,没治最大的病。

### D2 直写动词用 record 而非 add

直写语义是「经人工闸门收录一条知识进 hand-written 段」(append-hand 追加);record(记录/收录)贴合人工策展动作,add 偏机械堆叠。中文对应「记录命令」。

### D3 marker 随迁 + 读侧永久双格式

写侧只产新格式 `<!-- distilled-from: <source> -->` … `<!-- /distilled -->`;读侧同时解析新格式与旧 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->`,视为同一蒸馏块列表(同一文件新旧混排时按出现顺序统一解析),永不报废弃。被否备选:

- **marker 不动**:命令说 distill、文件写 promoted,术语永久漂移。
- **一次性迁移脚本**:蒸馏全量重建语义使其不必要(见 D4),且多一个要永久维护的命令。

### D4 迁移靠全量重建自然发生

`distilling-knowledge` 每次运行本就全量重写所有蒸馏块——改名后首次运行即把全部旧 marker 重写为新格式,hand-written 段字节级保留。无需专门迁移工具;双解析只为三类存量兜底:从未重蒸的文件、日落读现状块、stale 检测。

### D5 verb mode 与 lib 函数硬切

`replace-promoted` → `replace-distilled`;`parsePromotedBlocks` → `parseDistilledBlocks`;`replacePromotedBlocks` → `replaceDistilledBlocks`。均为插件内部契约(消费者只有 2 个命令文件 + 测试),单提交同步两侧;不留旧名别名,避免双词表长期并存。`append-hand` 与 hand-written 术语不变。

### D6 旧命令硬切,不留跳转 stub

删除 `memorize.md`/`promote-knowledge.md`,不保留重定向桩。pre-1.0 dogfood 仓、用户即本仓;CHANGELOG 记 breaking 即可。被否备选:保留 stub 一个发布期——维护成本高于收益。

### D7 顺带修复 plugin-packaging 命令枚举

「命令命名空间」scenario 的 21 命令清单漏了 memorize/promote-knowledge(knowledge-set 落地时的存量漂移);本次直接改为 23 命令全量清单并收录两个新名,并在「旧命令名」scenario 增补 memorize/promote-knowledge 不再出现,避免另开 drift 修复。

## Risks

- **R1 旧命令名的外部引用**(用户肌肉记忆、文档外链)→ CHANGELOG breaking 记录 + 4 README 同步;pre-1.0 接受。
- **R2 存量旧 marker 解析回归** → 读侧双格式解析 + 测试钉死(旧格式解析出块、新旧混排按序解析、写侧只产新格式)。
- **R3 改名漏触点**(prose、提交信息模板、索引描述)→ tasks 列全触点清单 + 收尾全仓 grep 校验(`memorize|promote` 仅允许命中 archive/、.ua/ 与 CHANGELOG 历史小节)。
- **R4 中英 README 漂移** → 仓库纪律:任何内容改动同步全部语言版本;tasks 显式列 4 文件并做对照检查。
- **R5 主规格 Purpose 含旧命令名**:syncing 不动既有 Purpose(主规格权威)→ tasks 单列 editorial 修正 `speccode/spec/knowledge-set/spec.md` 的 Purpose 段。

## Open Questions

无。

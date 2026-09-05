# Tasks: docs-multi-host

依赖顺序分组;纯文档变更,每处编辑 EN/CN 成对执行。组 3 验证含既有测试回归。

## 1. 根 README 双语定位改写

- [x] `README.md` 定位句(line 3):「built on Claude Code」→ 多宿主口径(Claude Code 主宿主 + Codex/Kimi Code/ZCode/OpenCode/Pi 适配,成熟度如实)
- [x] `README.md` Quickstart 后新增多宿主安装指引段(短段:五宿主入口表见 `references/host-mapping/README.md`、shim 一条命令、验证状态指向该表)
- [x] `README.md` How We Compare:「Native Claude Code plugin」行改「Multi-host install (6 coding agents)」口径
- [x] `README.md` 文档地图补 `references/host-mapping/` 条目
- [x] `README_CN.md`:以上四处的全量翻译对应(段落锚一致)

## 2. marketplace 与设计文档定位

- [x] `.claude-plugin/marketplace.json` description:多宿主定位展开(列宿主清单;保留既有语义短语)
- [x] `docs/DESIGN.md` §1 定位句改多宿主口径(与根 README 一致)
- [x] `docs/DESIGN_CN.md` §1 全量翻译对应

## 3. 验证

- [x] 双语结构对齐:根 README 11 段一一对应、DESIGN §1-14 对应、新增段成对出现
- [x] 版本与数量零硬编码:grep README/DESIGN 无版本字面量与用例数字(既有纪律)
- [x] 全量测试 `node --test ./tests/*.test.mjs` 全绿(299 基线;cli.test 的 README 措辞断言回归)
- [x] 门面自洽抽查:定位句 / 多宿主段 / 对比行 / 文档地图四处口径一致,验证状态指向 host-mapping README
- [x] 复审修复(With fixes,1 Important + 2 Minor 已修):①README 双语五处 v2 残留「三层分支拓扑」改双层(Why bullet/标题/ASCII 图/对比行/文档地图行,EN/CN 成对;与 DESIGN §3「Two-Layer」及 AGENTS.md「双层」对齐;文档三层分离/引擎三层架构/流程分三层等合法用词保留);②delta 文档三层分离同步改「双层分支拓扑图」+ scenario 拓扑条款更新(防 syncing 固化旧表述);③README 定位句链接文本统一为 host-mapping/README.md。接受并记录:plugin.json description 与 marketplace description 定位措辞差异(host-neutral vs 多宿主,下次合法触及 plugin.json 时对齐);DESIGN §11 放置多宿主表由 host-adapters 交付、后续可迁;superpowers 多宿主 ✅ 为探索期实测其仓库所得(非凭空)

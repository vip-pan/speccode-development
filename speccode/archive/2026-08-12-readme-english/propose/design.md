# design: readme-english

## Context

- PR #12 后现状:根 `README.md` = 中文门面(12 段骨架,4.3KB);`plugins/speccode/README.md` = 中文设计文档(260 行,§1-14);`CLAUDE.md` 含「文档分工」说明
- spec:`plugin-packaging`「文档三层分离」(根 README=用户门面/插件 README=设计文档/CLAUDE=开发文档)+「文档版本信息不漂移」+「许可证文件」
- 上一 feature 语言决策 D7:先纯中文,英文版留作后续 feature——本 feature 即该后续
- 调研基线:spec-kit 双语 toggle、BMAD 独立中文 README——双语是品类惯例

## Goals

1. GitHub 默认页(`README.md`)为英文,最大化发现性
2. 两语言版本结构一致(根 README 12 段骨架一一对应;插件 README 节号 1-14 一致),翻译可验证
3. 互链矩阵 4 组链接无死链
4. 多语言维护纪律写入 CLAUDE.md 与 spec

## Non-Goals

- `CLAUDE.md` / `CHANGELOG.md` 翻译(CHANGELOG 保持中文,发布纪律要求;CLAUDE.md 是开发文档,目标读者是维护者)
- 插件 README 内容重写(仅翻译,节号与中文版一致)
- 英文版插件 README 的「门面指针」语言指向已定:指向对应语言根 README

## Decisions

1. **同根模式命名**(用户确认):`README.md`=EN + `README_CN.md`=zh,根与插件目录统一。被否:插件 README 中文为主 + `README_EN.md`(双语结构不统一,维护心智负担)。
2. **全量翻译**(用户确认):12 段骨架一一对应,不做英文精华版。被否:精简版(结构锚漂移——两版结构不同,「结构对齐」纪律失效)。
3. **git mv 改名**:保留 git 历史。被否:新建文件复制内容(丢历史)。
4. **互链矩阵进 spec**(ADDED「文档双语互链」):4 组链接钉死——①根 EN↔CN toggle ②插件 EN↔CN toggle ③根→插件同语言对应 ④插件门面指针→同语言根 README。被否:散落各文档靠自觉(上次 feature 的教训:交叉引用漏改)。
5. **翻译节号锚定**:插件 README 英文版节号与中文版一致(§1-14),翻译以中文版节号清单为纲。防两版错位。
6. **CLAUDE.md 多语言维护说明**:双倍维护面、翻译改动必须同步两版、结构对齐(12 段骨架)为锚。
7. **专名保留原文**:`/speccode:` 命令名、worktree/trunk/feature/spec 等术语在英文版保留原文,不做意译。

## Risks

- **R1 双语漂移**:两版内容随时间偏离 → 缓解:结构对齐(12 段骨架)为锚;CLAUDE.md 维护纪律说明;「文档版本信息不漂移」扩展到双语(本 feature delta)。
- **R2 互链死链**:改名后既有链接失效(如插件 README 门面指针原指根 README) → 缓解:互链矩阵进 spec;实现后逐链验证(验收清单)。
- **R3 翻译质量与术语不一致** → 缓解:专名保留原文(Decision 7);英文版一次成型、术语表统一。
- **R4 插件 README 节号错位** → 缓解:翻译以中文版节号清单为纲(Decision 5);验收检查两版节号一致。

## Open Questions

无(探索阶段已确认全部决策)。

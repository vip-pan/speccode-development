# Design: memory-append-newline

## Context

R1 终审发现 memory 条目粘连(`...design.md)"- proposing 完成:...`),R2 起由调用方在 append 内容开头手工加 `\n` 规避。勘探核实:引擎 append 为裸 O_APPEND 追加(memory.mjs:37-42);现有 append 用例全部恰好双侧带 `\n`,无一钉住边界行为;逐字节锚定用例是 replace 模式不受影响。另发现一处既有漂移:「memory 原子写」条款(session-memory/spec.md:31)仍写「append 模式的读-改-写 MUST 采用临时文件+rename」,而实现自 a45202a 已改为单次 O_APPEND 追加写(为跨 worktree 并发不丢数据)——条款与实现矛盾,本轮一并归位。

## Goals

- append 条目边界由引擎保证,调用方传纯内容
- 不丢 O_APPEND 并发性质(单次追加写,不引入读-改-写)
- 原子写条款与实现重新一致,边界规则入契约

## Non-Goals

- 不做更多规范化(不收敛多个换行、不补尾换行、不动 replace 模式逐字节语义)
- 不改 21 个命令文档的 heredoc 示例(引擎兜底后它们天然安全;文档统一改不改留待以后)
- 不发版(攒入 0.2.2 评估)

## Decisions

- **方案 B 引擎兜底(用户选定)**:分隔判定 = `existing 非空 && !existing.endsWith('\n') && !content.startsWith('\n')` 时补恰好一个 `\n`,与内容合并为同一次 `appendFileSync`。被否备选:A 调用方保障(21 处文档改动 + 未来每个调用点靠纪律——正是已被打破一次的东西)
- **分隔符随同一次 O_APPEND 写**:判定需先读现有内容,读-写之间理论上可被并发追加穿插——代价至多是一条粘连行(装饰性),绝不丢数据;O_APPEND 不丢写 invariant 保持。被否备选:改回读-改-写+rename(违反 a45202a 的并发修复意图)
- **「memory 原子写」按模式精确化**:replace MUST 临时文件+rename(异常退出不留半写);append MUST 单次 O_APPEND(MUST NOT 读-改-写)+ 边界规则;新增 3 个 scenario(缺边界补 / 已存在不重复补 / 空文件不补前缀)
- **测试边界**:只加 2 个用例;「空文件 append 不补前置换行」由既有用例 `append on missing file behaves as replace` 已覆盖,不重复写

## Risks

- 有调用方故意跨条目续写同一行 → 勘探确认无此用法(全部调用点为行条目日志);spec 明文「其余情况原样追加」限定规范化范围
- 并发判定过期 → 决策第二条已评估,装饰性代价可接受

## Open Questions

无。

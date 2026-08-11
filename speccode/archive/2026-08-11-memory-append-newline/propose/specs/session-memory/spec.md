# session-memory Delta

## MODIFIED Requirements

### Requirement: memory 原子写

memory 写入按模式分两种原子策略:replace 模式 MUST 采用「写临时文件 + rename 覆盖」,任何异常退出 MUST NOT 产生半写状态;append 模式 MUST 为单次 O_APPEND 追加写(跨 worktree 并发追加互不覆盖),MUST NOT 使用读-改-写。append 模式 MUST 保证条目边界:既有内容非空且不以换行符结尾、且追加内容不以换行符开头时,MUST 在两者之间插入恰好一个换行符(作为同一次追加写的一部分);其余情况 MUST 原样追加,不多做规范化。

#### Scenario: replace 写入过程异常退出
- **WHEN** 进程在以 replace 模式写入 memory 文件时被 kill
- **THEN** memory 文件 MUST 保持写入前的完整旧内容,不留半写状态

#### Scenario: append 缺失边界补一个换行
- **WHEN** 文件既有内容为 `first`(无尾换行),以 append 模式追加 `- second`(无头换行)
- **THEN** 结果 MUST 为 `first\n- second`(边界插入恰好一个换行符)

#### Scenario: append 边界已存在不重复补
- **WHEN** 既有内容以换行符结尾,或追加内容以换行符开头
- **THEN** 引擎 MUST 原样追加,不插入额外换行

#### Scenario: append 空文件不补前置换行
- **WHEN** memory 文件不存在或为空,以 append 模式写入内容
- **THEN** 引擎 MUST 直接写入该内容,MUST NOT 在开头添加换行

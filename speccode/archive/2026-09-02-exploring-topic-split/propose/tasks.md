# Tasks: exploring-topic-split

## 组1:lib(TDD,先红后绿,无依赖)

- [x] `tests/memory.test.mjs`:新增 `validateMemoryBranch` 用例——接受 `_exploring` / `_knowledge` / `_exploring/<合法topic>` / `<type>/<slug>`;拒绝 `_exploring/Bad_Topic`(大写/下划线)、`_exploring/`、`_exploring/a/b`、任意非法分支;先运行确认红
- [x] `tests/memory.test.mjs`:新增 `listMemory` 用例——tmp 目录混合 `_exploring__a.md`、`_exploring__b-p1.md`、`feature__c.md`、非 md 文件,返回 `['_exploring/a','_exploring/b-p1']`;空目录返回 `[]`;先红
- [x] `tests/memory.test.mjs`:新增 `renameMemory` 用例——成功 rename(内容不变、源不残留);源不存在 → 抛错;目标已存在 → 抛错且两侧内容不变;先红
- [x] `lib/memory.mjs`:实现 `validateMemoryBranch`(保留键 `_exploring`/`_knowledge`、`_exploring/` 前缀 + `validateSlug`、回退 `validateBranch`)、`listMemory`(扫 `memory/` 目录 `_exploring__` 前缀 md,还原为键)、`renameMemory`(校验两侧 + 源存在 + 目标不存在 + 同目录 `renameSync`)
- [x] 运行 `node --test plugins/speccode/tests/memory.test.mjs` 确认绿

## 组2:CLI verb(依赖组1)

- [x] `tests/cli.test.mjs`:新增端到端用例——`list-memory` 返回 topic 清单;`write-memory --branch _exploring/<topic>` 写入后 `read-memory` 读回;`rename-memory` 承接后旧键读 null、新键读回内容;目标已存在 rename 返回 `{ok:false}` exit 1;非法 topic 返回 `{ok:false}`;既有 `_exploring` sentinel 用例语义核对(读兼容保持)
- [x] `bin/speccode.mjs`:`read-memory` / `write-memory` 的校验替换为 `validateMemoryBranch`;新增 `list-memory`、`rename-memory` verb(写 verb 走 `--json-stdin` 布尔 flag + `JSON.parse(readStdin())` 模式);更新 `VERBS` 表
- [x] 全量 `node --test ./plugins/speccode/tests/*.test.mjs` 绿

## 组3:命令 prose(依赖组2)

- [x] `commands/exploring.md`:出口改为「先 `list-memory` 列 topic 清单 → AskUserQuestion 选既有/新建 → append 到 `_exploring/<topic>`」;无 feature 归属的默认写法从 `--branch _exploring` 改为 `--branch _exploring/<topic>`;补分期前缀约定说明(`<主题>-p1`);长会话主动记忆段落同步键形式
- [x] `commands/creating-feature.md`:「决定分支名」第 2 步从读 `_exploring.md` 改为 `list-memory` + 选 topic(slug 预填 topic 名)+ 按所选文件推断 type;第 4 步骨架改为:slug=topic 命中 → `rename-memory` 承接,未命中 → 骨架填「无」;第 5 步清空删除;复用注记与钩子步骤保持

## 组4:规格 delta(依赖组3,文档)

- [x] 核对 `propose/specs/session-memory/spec.md` 与 `propose/specs/git-workflow-lifecycle/spec.md` 的 MODIFIED 名称与主规格逐字一致(requirement 标题 diff 校验)

## 组5:文档核对(依赖组3)

- [x] `plugins/speccode/README.md` / `README_CN.md`:memory 目录结构示例(`_exploring__<topic>.md`)与 trunk 级例外说明段同步改写,中英结构一一对应;不硬编码版本号/测试数量/命令数
- [x] `CHANGELOG.md`:不在此改动(发版时统一);确认无遗漏的硬编码数字触点

## 收尾验证

- [x] 全量测试绿:`node --test ./plugins/speccode/tests/*.test.mjs`(glob 形式,勿用裸目录)
- [x] 手动冒烟:tmp 仓库 `node plugins/speccode/bin/speccode.mjs list-memory / write-memory --branch _exploring/<topic> / rename-memory` 全链路
- [x] 主仓遗留 `.speccode/memory/_exploring.md` 已空(承接时清空),无迁移动作需要

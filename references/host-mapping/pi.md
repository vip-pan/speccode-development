# Pi 宿主映射

> 待验证:Pi 的扩展 API 与 skills 发现机制未经真机验证(探索期调研:Pi 有原生 skills,`.pi/extensions/*.ts` 为扩展入口)。

## 安装

1. Pi:`pi install git:github.com/vip-pan/speccode`(**待验证**:安装语法以官方文档为准)。扩展骨架见 [`.pi/extensions/speccode.ts`](../../.pi/extensions/speccode.ts)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## 工具映射

| speccode 语义 | Pi 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | 文本提问(待验证:是否有结构化提问工具) |
| 派发子代理 | 待验证(Pi 无原生 Task 等价物时,走 skill 声明的降级路由) |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- Pi 有原生 skills(探索期调研:无需兼容性 Skill 工具),扩展主要负责注册与宿主注意提示;若宿主自动发现 `skills/`,扩展骨架可只承载提示逻辑。
- 扩展 API 核对后更新 `.pi/extensions/speccode.ts` 并移除「待验证」标注。

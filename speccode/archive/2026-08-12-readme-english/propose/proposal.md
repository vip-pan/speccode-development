# proposal: readme-english

## Why

上一 feature(PR #12)确立根 README 用户门面,语言决策为「先纯中文,英文版留作后续」——本 feature 即该后续。GitHub 默认渲染 `README.md`,当前为纯中文,英文读者/贡献者的发现性受限;spec-kit(EN+简体中文 toggle)、BMAD(独立中文 README)均证明双语是品类惯例。

## What Changes

- **根 README 双语化**(BREAKING 对文件结构):`git mv README.md README_CN.md`(中文门面,12 段骨架不变,顶部加语言切换链接);新建 `README.md` = **英文全量翻译**(12 段骨架一一对应)+ 语言切换链接(badges 两版都留)
- **插件 README 双语化**(BREAKING 对文件结构):`git mv plugins/speccode/README.md plugins/speccode/README_CN.md`;新建 `plugins/speccode/README.md` = **英文全量翻译**(260 行设计文档,节号编号 1-14 与中文版一致);两版门面指针指向**对应语言**的根 README
- **CLAUDE.md 增补**:「文档分工」说明更新为四 README 文件映射;新增「多语言维护」说明(双倍维护面纪律、12 段骨架结构对齐为锚、翻译改动必须同步两版)
- **spec delta**:`plugin-packaging` — MODIFIED「文档三层分离」(双文件门面/双文件设计文档/CLAUDE 多语言维护)、ADDED「文档双语互链」(互链矩阵 4 组链接)、MODIFIED「文档版本信息不漂移」(扩展到全部语言版本)

## Capabilities

- `plugin-packaging`(MODIFIED 2 + ADDED 1)

## Impact

- 文件:根 `README.md`(EN,新)/ `README_CN.md`(改名)/ `plugins/speccode/README.md`(EN,新)/ `plugins/speccode/README_CN.md`(改名)/ `CLAUDE.md`(增补)/ `speccode/spec/plugin-packaging/spec.md`(经 syncing)
- 无引擎代码、无命令 markdown、无行为变化;CHANGELOG 保持中文(发布纪律)
- 测试:无需新增单测;回归 137/137

# Tasks: 探测器列表 LightRAG → GitNexus

- [x] 1. `lib/detect.mjs`:删除 `{id:'lightrag', match:'lightrag', bin:'lightrag', dirs:['.lightrag']}` 行,新增 `{id:'gitnexus', match:'gitnexus', bin:'gitnexus', dirs:['.gitnexus']}` 行
- [x] 2. `tests/detect.test.mjs`:lightrag 探测测试改为 gitnexus 探测测试(available=bin、integrated=dir 各一例)
- [x] 3. `README_CN.md` §9 + `README.md` §9:五类工具列表 LightRAG → GitNexus(中英同步)
- [x] 4. 跑全量测试 `node --test ./plugins/speccode/tests/*.test.mjs`,确认全绿

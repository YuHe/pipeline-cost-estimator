# Pipeline 成本估算服务 — 开发成果记录

> **项目**: pipeline-cost-estimator
> **开发周期**: 2026-04-19 ~ 2026-04-20
> **当前状态**: 功能开发完成，待全量验证

---

## 一、已完成功能清单

### Phase 1: 项目初始化与基础搭建 (2026-04-19)

| # | 功能项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 项目脚手架搭建 | ✅ 完成 | 前后端分离架构，Docker Compose 一键部署 |
| 2 | 后端 FastAPI 框架 | ✅ 完成 | 含用户认证、Pipeline CRUD、版本管理、分享、管理后台等全套 API |
| 3 | 前端 React + Vite 框架 | ✅ 完成 | 含路由、状态管理 (Zustand)、Ant Design UI |
| 4 | 数据库模型 & Alembic 迁移 | ✅ 完成 | User / Pipeline / Version / ResourceSpec / ModuleTemplate / ShareLink |
| 5 | DAG 可视化编辑器 | ✅ 完成 | 基于 React Flow，支持拖拽添加模块、连线、分流比设置 |
| 6 | 成本计算引擎 | ✅ 完成 | 拓扑排序 → QPS 分配 → 实例数计算 → 容灾补齐 → 成本汇总 |
| 7 | 版本历史与回溯 | ✅ 完成 | 每次保存创建新版本，支持回滚到历史版本 |
| 8 | 分享链接功能 | ✅ 完成 | 生成带有效期的分享链接，只读查看 Pipeline 配置与结果 |
| 9 | Pipeline 列表管理 | ✅ 完成 | 列表页展示所有 Pipeline，支持创建、复制、删除 |
| 10 | 管理后台 | ✅ 完成 | 资源规格库管理、全局模板管理、用户管理 |

### Phase 2: Bug 修复与功能增强 (2026-04-19 ~ 2026-04-20)

| # | 功能项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | TypeScript 类型修复 | ✅ 完成 | 修复 node.data 类型推断为 `{}` 的问题，添加明确泛型参数 |
| 2 | Zustand Store 类型断言 | ✅ 完成 | applyNodeChanges/applyEdgeChanges 返回值类型断言 |
| 3 | 缺少依赖修复 | ✅ 完成 | 添加 email-validator 到 requirements.txt |
| 4 | Alembic 迁移脚本修复 | ✅ 完成 | 修复 schema 问题，确保程序化迁移正常运行 |

### Phase 3: 四项核心改动 (2026-04-20)

| # | 功能项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 统一按卡计费 (gpus_per_instance) | ✅ 完成 | 去除 per_gpu/per_machine 区分，新增「每实例 GPU 数」字段，成本 = 实例数 × 卡数 × 单卡价格 |
| 2 | Pipeline 横向排布 | ✅ 完成 | DAG 布局从纵向 (Top→Bottom) 改为横向 (Left→Right) |
| 3 | 模板库统一 & 右侧编辑 | ✅ 完成 | 合并「空白模块」和「模板库」Tab 为单一视图；模板可点击在右侧抽屉直接编辑保存 |
| 4 | 保存模块为模板 | ✅ 完成 | ModuleConfigDrawer 新增「保存为模板」按钮 |

### Phase 4: 第二轮改进 (2026-04-20)

| # | 功能项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 左侧栏 UI 统一 | ✅ 完成 | 去除 Tab 分割，统一为模板库视图 |
| 2 | 版本去重保存 | ✅ 完成 | 配置未变更时跳过保存，提示「配置未变更，已是最新版本」|
| 3 | 粒子流动动画 | ✅ 完成 | 计算完成后 edge 上显示流动粒子，数量和速度与 QPS 成正比 |
| 4 | Pipeline 改名 Bug | ✅ 完成 | 修复 MissingGreenlet 错误，后端 flush 后 refresh 重载 server-set 字段 |
| 5 | PRD 同步更新 | ✅ 完成 | 更新模板库描述、版本去重策略、布局方向等章节 |

---

## 二、技术架构

```
┌─────────────────────────────────────────────────┐
│                   Nginx (前端)                    │
│                   Port: 3000                     │
├─────────────────────────────────────────────────┤
│   React 18 + Vite + TypeScript                  │
│   React Flow (DAG) + Ant Design (UI)            │
│   Zustand (State) + React Router (路由)          │
├─────────────────────────────────────────────────┤
│                   FastAPI (后端)                   │
│                   Port: 8000                     │
├─────────────────────────────────────────────────┤
│   SQLAlchemy Async + Alembic (ORM & 迁移)        │
│   PostgreSQL (数据持久化)                         │
│   JWT (用户认证)                                  │
└─────────────────────────────────────────────────┘
```

**部署方式**: Docker Compose 一键启动 (前端 + 后端 + PostgreSQL)

---

## 三、关键文件索引

### 后端

| 文件 | 说明 |
|------|------|
| `backend/app/main.py` | 应用入口，含 lifespan 初始化 (Alembic 迁移 + 种子数据) |
| `backend/app/services/calculation.py` | 成本计算核心引擎 |
| `backend/app/services/pipeline_service.py` | Pipeline CRUD 业务逻辑 |
| `backend/app/models/pipeline.py` | Pipeline / Version / ResourceSpec 数据模型 |
| `backend/app/api/` | 全部 REST API 端点 |
| `backend/tests/test_calculation.py` | 成本计算单元测试 (含容灾、分流、多链路场景) |

### 前端

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/EditorPage.tsx` | Pipeline 编辑器主页 |
| `frontend/src/components/dag/Canvas.tsx` | React Flow 画布 |
| `frontend/src/components/dag/ModuleNode.tsx` | 自定义模块节点组件 |
| `frontend/src/components/dag/CustomEdge.tsx` | 自定义边 (含粒子流动动画) |
| `frontend/src/components/dag/LeftPanel.tsx` | 左侧模板库面板 |
| `frontend/src/components/dag/ModuleConfigDrawer.tsx` | 模块配置抽屉 |
| `frontend/src/components/dag/TemplateConfigDrawer.tsx` | 模板编辑抽屉 |
| `frontend/src/components/dag/ResultPanel.tsx` | 右侧计算结果面板 |
| `frontend/src/store/pipelineStore.ts` | Pipeline 编辑器全局状态 |
| `frontend/src/store/templateStore.ts` | 模板库状态管理 |
| `frontend/src/types/index.ts` | TypeScript 类型定义 |

---

## 四、验证检查项

- [ ] `docker compose up --build -d` 全栈启动无报错
- [ ] 拖入模块到画布，验证横向排布（线条 Left→Right 连接）
- [ ] 修改 Pipeline 名称 → 刷新页面 → 名称保持不变
- [ ] 配置模块 gpus_per_instance=8，单卡价格=136，计算验证成本正确
- [ ] 保存模块为模板 → 左侧模板库出现 → 拖入新画布自动填充
- [ ] 点击我的模板 → 右侧抽屉打开 → 修改保存成功
- [ ] 计算完成后 edge 上有粒子流动动画
- [ ] 重复点保存 → 提示「配置未变更，已是最新版本」
- [ ] 运行后端测试 `pytest backend/tests/` 全部通过

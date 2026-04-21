# Pipeline 成本估算服务 — 开发过程总结

> **项目**: pipeline-cost-estimator
> **开发者**: heyu11
> **AI 辅助**: Claude (Ducc)
> **时间范围**: 2026-04-19 ~ 2026-04-20

---

## 一、项目概述

本项目是一个**可视化 Pipeline 成本估算服务**，面向 AI Pipeline（LLM 推理链路、多模型串联等）场景，帮助业务团队通过拖拽式 DAG 编辑器快速评估端到端部署成本。

技术栈：React + TypeScript + React Flow (前端) / FastAPI + SQLAlchemy Async + PostgreSQL (后端) / Docker Compose (部署)。

---

## 二、开发历程

### Day 1 (2026-04-19): 从 PRD 到可运行原型

#### Commit: `init commit` (216d98e)
- 根据 PRD v3.0 文档，一次性生成了完整的前后端代码骨架
- 后端：FastAPI 应用 + 12 个 API 模块 + 数据模型 + 成本计算引擎 + 单元测试
- 前端：8 个页面 + DAG 编辑器组件 + Zustand 状态管理 + 服务层
- 部署：Docker Compose 三服务编排 (frontend / backend / postgres)
- 共 91 个文件、8400+ 行代码

#### Commit: `fix node.data 属性被推断为 {}` (e41b66c)
- **问题**: React Flow 节点的 `data` 属性在 TypeScript 中被推断为 `{}`，导致访问 `data.module_name` 等字段报类型错误
- **修复**: 为所有组件添加了明确的泛型参数 `Node<ModuleNodeData>` 和 `Edge<SplitEdgeData>`
- 同时修复了 docker-compose.yml 的配置问题

#### Commit: `fix applyNodeChanges/applyEdgeChanges` (62fc341)
- **问题**: React Flow 的 `applyNodeChanges` 返回泛型基类 `Node[]`，赋值给 `AppNode[]` 类型不兼容
- **修复**: 添加 `as AppNode[]` 类型断言；`SplitEdgeData.split_ratio` 改为可选字段

#### Commit: `缺少 email-validator` (000edf6)
- **问题**: Pydantic 验证 `EmailStr` 需要 `email-validator` 包，但未在 requirements.txt 中声明
- **修复**: 添加依赖

### Day 2 (2026-04-20): 四项核心需求 + 第二轮迭代

#### Commit: `bug fixed` (eab9e08) — 第一轮四项需求

这是最大的一次改动 (19 个文件, +507/-243 行)，实现了用户提出的四项核心需求：

**1. 统一按卡计费 (gpus_per_instance)**
- 背景：原设计有 `cost_type` 区分 `per_gpu` 和 `per_machine` 两种计费方式，用户反馈这种区分不直观
- 方案：删除 `cost_type`，新增 `gpus_per_instance` 字段，统一计算公式为 `实例数 × 卡数/实例 × 单卡价格`
- 影响范围：后端 schema、计算引擎、测试用例、前端类型、Store、所有配置面板
- 向后兼容：Store 的 `addNode` 和 `loadConfig` 包含旧 `cost_type` 到 `gpus_per_instance` 的自动迁移逻辑

**2. Pipeline 横向排布**
- 背景：原 DAG 为纵向 Top→Bottom 排布，用户要求改为横向 Left→Right
- 方案：ModuleNode 和 ShareViewPage 中 Handle 位置从 Top/Bottom 改为 Left/Right
- React Flow 自动根据 Handle 位置路由边线，无需改动 Canvas 或 CustomEdge

**3. 模板库 (左侧面板 + 右侧编辑)**
- 背景：用户需要将常用模块保存为模板，方便复用
- 方案：
  - 新建 `templateStore.ts` 管理模板状态
  - 重写 `LeftPanel.tsx`：两个 Tab — 空白模块 / 模板库
  - 新建 `TemplateConfigDrawer.tsx`：右侧模板编辑抽屉
  - `ModuleConfigDrawer.tsx` 新增「保存为模板」按钮
  - 后端新增 `PUT /module-templates/{id}` 端点

**4. PRD 同步更新**
- 更新模块定义 (§3.2)、布局 (§6.1)、配置交互 (§6.4)、成本计算 (§7.3) 等章节

#### Commit: `删除了未使用的 ModuleTemplate 类型导入` (fd35665)
- 清理 LeftPanel.tsx 中的未使用导入

#### Commit: `fix schema` (1923943)
- 修复 Alembic 迁移问题：创建程序化迁移脚本 `001_initial_schema.py`
- 修复 `alembic/env.py` 中 metadata 导入
- 增强 `main.py` lifespan：自动执行迁移 + 种子数据初始化

#### Commit: `fixed function bug` (9fa3fae) — 第二轮四项需求

**1. 左侧栏 UI 统一**
- 用户反馈：空白模块 Tab 和模板库 Tab 功能重叠
- 修复：去除 Tab 设计，合并为单一模板库视图（顶部空白模块卡 + 全局模板区 + 我的模板区）

**2. 版本去重保存**
- 用户需求：配置未变更时不应创建新版本
- 实现：`pipelineStore` 新增 `lastSavedConfig` 状态，保存前 JSON.stringify 对比，相同则提示「配置未变更，已是最新版本」

**3. 粒子流动动画**
- 用户反馈：PRD 中定义了流量动画 (§6.9) 但从未实现
- 实现：`CustomEdge.tsx` 全面重写
  - 从 costResult 获取 edge 上的实际 QPS
  - 用 SVG `<circle>` + `<animateMotion>` 沿 bezier path 动画
  - 粒子数 (1-5) 和速度与 QPS 成正比
  - 边标签显示分流比 + QPS

**4. Pipeline 改名 Bug**
- 用户报告：新建 Pipeline 改名时后端报 `MissingGreenlet` 错误
- 根因：SQLAlchemy async 模式下，`Pipeline.updated_at` 使用 `onupdate=func.now()` 为 server-set 字段，`flush()` 后 Pydantic `model_validate` 尝试访问该字段触发懒加载失败
- 修复：在 `pipeline_service.py` 的 `create_pipeline`、`update_pipeline`、`copy_pipeline` 三个函数中，`flush()` 后添加 `await db.refresh(pipeline)` 重载服务端字段
- 附带 UI 修复：改名失败时回滚显示名称并提示错误

---

## 三、关键技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 状态管理 | Zustand | 轻量、TypeScript 友好、无 Provider 包裹 |
| DAG 组件 | React Flow | 成熟的 React DAG 库，支持自定义节点/边 |
| 后端 ORM | SQLAlchemy Async | 原生异步支持，配合 FastAPI 性能最优 |
| 数据库迁移 | Alembic 程序化迁移 | 应用启动时自动执行，无需手动运行命令 |
| 计费模型 | 统一按卡计费 | 用户反馈 per_gpu/per_machine 区分不直观，统一后更易理解 |
| 粒子动画 | SVG animateMotion | 原生 SVG 动画，无需第三方动画库，沿 bezier path 平滑移动 |
| 版本去重 | 前端 JSON 对比 | 避免后端 API 变更，简单有效 |

---

## 四、遇到的问题与解决方案

### 问题 1: TypeScript 泛型推断失败
- **现象**: React Flow 节点 `data` 被推断为 `{}`
- **原因**: 未向 React Flow 组件传递泛型参数
- **方案**: 定义 `type AppNode = Node<ModuleNodeData>` 并在所有相关位置使用

### 问题 2: SQLAlchemy Async MissingGreenlet
- **现象**: 更新 Pipeline 后序列化返回时报错 `MissingGreenlet: greenlet_spawn has not been called`
- **原因**: `updated_at` 使用 `onupdate=func.now()`，为 server-side 计算字段，`flush()` 后 ORM 对象中该字段过期，Pydantic 访问触发同步懒加载但当前在 async 上下文中
- **方案**: `flush()` 后调用 `await db.refresh(obj)` 主动重载

### 问题 3: Alembic 迁移与程序启动集成
- **现象**: Docker 容器首次启动时数据库表不存在
- **方案**: 在 FastAPI lifespan 中调用 Alembic 的 `command.upgrade("head")`，同时执行种子数据初始化

### 问题 4: React Flow 边的粒子动画
- **挑战**: 需要让粒子沿 bezier 曲线路径移动，且数量和速度反映实际流量
- **方案**: 利用 `getBezierPath` 返回的 SVG path 字符串，作为 `<animateMotion path={...}>` 的路径；通过 `begin` 属性错开多个粒子的起始时间

---

## 五、Git 提交记录

| 时间 | Hash | 说明 | 影响文件数 |
|------|------|------|-----------|
| 04-19 | `0e17fd4` | Initial commit (gitignore + LICENSE) | 3 |
| 04-19 | `216d98e` | init commit — 完整项目代码 | 91 |
| 04-19 | `e41b66c` | fix node.data 类型推断 | 10 |
| 04-19 | `62fc341` | fix 泛型类型断言 | 2 |
| 04-19 | `000edf6` | 添加 email-validator 依赖 | 1 |
| 04-20 | `eab9e08` | 四项核心需求 (计费/横排/模板/PRD) | 19 |
| 04-20 | `fd35665` | 清理未使用导入 | 1 |
| 04-20 | `1923943` | 修复 Alembic 迁移 schema | 3 |
| 04-20 | `9fa3fae` | 第二轮需求 (UI统一/版本去重/粒子动画/改名Bug) | 8 |

---

## 六、待办与后续

- [ ] 全栈部署验证 (`docker compose up --build -d`)
- [ ] 成本趋势分析功能 (PRD §14.2，尚未实现)
- [ ] PDF 报告导出功能 (PRD 目标 #11，尚未实现)
- [ ] 方案对比功能完善 (PRD §10)
- [ ] 后端单元测试补充覆盖
- [ ] 生产环境安全加固 (JWT 密钥管理、CORS 配置等)

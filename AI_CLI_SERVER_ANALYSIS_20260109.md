# AI-CLI Server 深度分析报告

> **分析时间**: 2026-01-09 13:10:57 +0800
> **ultrathink协议**: ✅ 完整执行
> **时间校验**: 3源验证通过（偏差12秒）

---

## 📊 项目概览

| 项目 | 值 |
|------|-----|
| **项目名称** | AI-CLI HTTP Server |
| **当前版本** | v2.1.0 |
| **运行位置** | NAS (192.168.80.2:8765) |
| **技术栈** | Node.js 20 + Express |
| **用途** | 为n8n提供统一的AI CLI调用接口 |

---

## 🏗️ 架构分析

### 核心组件

```
ai-cli-server/
├── server.js          # 核心HTTP服务器 (813行, 25KB)
├── Dockerfile         # Docker镜像定义
├── docker-compose.yml # 容器编排配置
├── package.json       # Node.js依赖
├── .env               # 环境变量
├── config/
│   └── codex.toml     # Codex配置
├── sessions/          # CLI认证Session（关键！）
│   ├── claude/        # Claude Max账号Session
│   ├── codex/         # OpenAI Pro账号Session
│   ├── gemini/        # Google OAuth Session
│   └── gcloud/        # gcloud凭证
├── logs/              # 访问日志
└── data/              # 数据目录
```

### 认证方式（重要）

**本项目使用Session认证，非API Key！**

| CLI工具 | 认证方式 | Session位置 | 账号类型 |
|---------|----------|-------------|----------|
| Claude Code | Web Session | `~/.claude/` | Claude Max |
| Codex | Web Session | `~/.codex/` | OpenAI Pro |
| Gemini CLI | OAuth | `~/.gemini/` | Google账号 |

---

## 🤖 支持的AI模型

### Provider配置

| Provider | 默认模型 | 优先级 | 冷却时间 |
|----------|----------|--------|----------|
| **Claude** | claude-opus-4-5 | 1 (最高) | 10分钟 |
| **Gemini** | gemini-3-flash-preview | 2 | 5分钟 |
| **Codex** | gpt-5.2-codex | 3 | 10分钟 |

### 可用模型列表

**Claude系列**:
- `claude-opus-4-5` - 最强推理能力 (默认)
- `claude-sonnet-4` - 平衡选择
- `claude-haiku-4` - 快速轻量

**Gemini系列**:
- `gemini-3-flash-preview` - 78% SWE-bench, 1M上下文 (默认)
- `gemini-3-pro-preview` - 最强推理能力
- `gemini-2.0-flash` - 稳定备选

**Codex系列**:
- `gpt-5.2-codex` - 最新代码生成 (默认)
- `gpt-5.1-codex-max` - 长任务版本
- `gpt-5.1-codex-mini` - 节省配额版本

---

## 🔌 API端点一览

### v2.0原有端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/health` | GET | 健康检查 + 配额状态 |
| `/api/generate` | POST | 指定provider生成 |
| `/api/smart` | POST | 智能轮询（推荐） |
| `/claude` | POST | Claude CLI直接调用 |
| `/codex` | POST | Codex CLI直接调用 |
| `/gemini` | POST | Gemini CLI直接调用 |
| `/api/tags` | GET | 可用模型列表 |
| `/api/quota` | GET | 配额详情 |
| `/api/quota/reset` | POST | 重置配额状态 |

### v2.1.0新增端点（OpenAI兼容）

| 端点 | 方法 | 用途 |
|------|------|------|
| `/v1/chat/completions` | POST | OpenAI Chat Completions兼容 |
| `/v1/models` | GET | OpenAI模型列表格式 |

---

## 🔄 智能轮询策略

```
请求进入
    ↓
Claude (优先级1) ──→ 成功 → 返回结果
    ↓ 失败/配额耗尽
Gemini (优先级2) ──→ 成功 → 返回结果
    ↓ 失败/配额耗尽
Codex (优先级3)  ──→ 成功 → 返回结果
    ↓ 失败
返回错误: "所有provider配额耗尽"
```

### 配额错误检测

检测以下关键词触发Provider切换：
- `rate limit`
- `quota`
- `too many requests`
- `429`
- `capacity`

---

## 🐳 Docker部署配置

### docker-compose.yml关键配置

```yaml
services:
  ai-cli-server:
    build: .
    ports:
      - "8765:8765"
    environment:
      - TZ=Asia/Kuala_Lumpur      # 时区UTC+8
      - DEFAULT_PROVIDER=claude
      - REQUEST_TIMEOUT=120000     # 2分钟超时
    volumes:
      - ./sessions/claude:/root/.claude:rw
      - ./sessions/codex:/root/.codex:rw
      - ./sessions/gemini:/root/.gemini:rw
    networks:
      - n8n-network                # 与n8n同网络
```

### Dockerfile关键步骤

1. 基于 `node:20-alpine`
2. 安装 `@anthropic-ai/claude-code`, `@openai/codex`, `@google/gemini-cli`
3. 设置时区为 `Asia/Kuala_Lumpur`
4. 健康检查: `curl -f http://localhost:8765/health`

---

## 📈 NAS运行状态（2026-01-09）

从健康检查获取的实时数据：

```json
{
  "status": "healthy",
  "version": "2.1.0",
  "providers": {
    "claude": { "available": true, "requestCount": 26 },
    "gemini": { "available": true, "requestCount": 596 },
    "codex": { "available": true, "requestCount": 0 }
  }
}
```

**观察**：Gemini使用最多（596次），可能是AI文章分类任务的主力。

---

## 🚀 部署到其他位置指南

### 前置条件

1. Docker + Docker Compose
2. Node.js 20+ (如果本地运行)
3. **CLI认证Session**（最重要！）

### 部署步骤

```bash
# 1. 复制项目
cp -r ai-cli-server /path/to/new/location/

# 2. 配置Session（必须从已认证的机器复制）
# Mac上的Session位置:
#   Claude: ~/.claude/
#   Codex: ~/.codex/
#   Gemini: ~/.gemini/

# 3. 启动服务
cd /path/to/new/location/ai-cli-server
docker-compose up -d

# 4. 验证健康状态
curl http://localhost:8765/health
```

### Session同步脚本

项目包含 `sync-sessions.sh` 脚本用于从Mac同步Session到NAS。

---

## ⚠️ 注意事项

1. **Session安全**: sessions目录包含敏感认证信息，勿提交到公开仓库
2. **网络要求**: 需要与n8n在同一Docker网络（n8n_default）
3. **配额管理**: 配额状态存储在内存，容器重启会重置
4. **时区问题**: Alpine Linux需安装tzdata才能使用TZ环境变量

---

## 📝 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v2.1.0 | 2026-01-08 | OpenAI兼容API (/v1/chat/completions) |
| v2.0.0 | 2026-01-07 | 智能轮询、配额追踪、最新模型支持 |
| v1.0.0 | 2026-01-07 | 初始版本，基础CLI调用 |

---

## 📁 本地项目位置

```
/Users/anwu/Documents/code/tools/notion-archive/ai-cli-server/
```

**状态**: ✅ 已更新到v2.1.0，与NAS版本同步

---

**生成时间**: 2026-01-09 13:20:00 +0800
**分析工具**: Claude Code + ultrathink协议

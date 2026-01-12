# Learn LangChain 1.0 Typescript with AI Agents, Tools, RAG Pipelines, Agentic RAG, MCP Integration, LangGraph Deployment

# OpenRouter & Ollama – TypeScript Examples

This repository contains **three working TypeScript examples** showing different ways to interact with Large Language Models (LLMs):

1. **Cloud-based LLMs via OpenRouter (OpenAI-compatible SDK)**
2. **Local LLMs via Ollama + Docker (axios)**
3. **Streaming responses using the OpenRouter SDK**

Each approach serves a different purpose depending on **privacy, cost, latency, and control**.

---

## 📂 Repository Structure

```text
.
├── openrouter-openai.ts      # OpenAI SDK + OpenRouter (non-streaming)
├── ollama-axios.ts           # Ollama (Docker) + TypeScript + axios (local)
├── openrouter-streaming.ts   # OpenRouter SDK with streaming
├── .env                      # API keys (not committed)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧠 What Each File Does

### 🔹 openrouter-openai.ts — OpenRouter (OpenAI SDK)

Uses the **OpenAI JavaScript SDK** pointed to **OpenRouter**.

* Simple request/response
* Works with free & paid OpenRouter models
* No streaming

**Use when:** you want a clean, OpenAI-compatible API.

---

### 🔹 ollama-axios.ts — Ollama + TypeScript (Axios)

Runs a **local LLM** using **Ollama inside Docker**, accessed from TypeScript via **axios**.

* 100% local & private
* No API keys
* Unlimited usage (hardware-bound)
* Uses Ollama native REST API (`/api/generate`)

**Use when:** privacy, offline usage, or unlimited requests matter.

---

## ✅ Pre-requisites for `ollama-axios.ts`

# Ollama + TypeScript (Axios) – Complete Command Reference

This section contains **all commands** needed to set up **Ollama (Docker)** and run it from **TypeScript using axios**.

---

### 1. Docker & Ollama Setup

#### Check Docker

```bash
docker --version
docker ps
```

#### Pull (download) the Ollama image

Downloads the Ollama Docker image from Docker Hub.

```bash
docker pull ollama/ollama
```

#### Run Ollama (Expose Port)

Creates a container from the Ollama image and exposes it locally.

```bash
docker run -d -p 11434:11434 --name ollama ollama/ollama
```

#### Verify Container

```bash
docker ps
```

Expected:

```
0.0.0.0:11434->11434/tcp
```

#### Check Ollama Health

```bash
curl http://localhost:11434/api/version
```

#### List Models

```bash
curl http://localhost:11434/api/tags
```

#### Pull Model

```bash
docker exec -it ollama ollama pull deepseek-r1:1.5b
```

---

### 2. Node.js & TypeScript Setup

#### Initialize Project

```bash
npm init -y
```

#### Install Runtime Dependency

```bash
npm install axios
```

#### Install Dev Dependencies

```bash
npm install -D typescript tsx @types/node
```

---

### 3. TypeScript Configuration

#### Create tsconfig

```bash
npx tsc --init
```

#### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true
  }
}
```

---

### 4. Run Commands

#### Recommended (No Compile Step)

```bash
npx tsx ollama-axios.ts
```

#### Compile TypeScript

```bash
npx tsc
```

#### Run Compiled JavaScript

```bash
node ollama-axios.js
```

---

### 5. Cleanup & Debug

```bash
docker stop ollama
docker rm ollama
lsof -i :11434
npm cache clean --force
```

---

### 6. Daily Workflow (Minimal)

```bash
docker start ollama
npx tsx ollama-axios.ts
```

**Status:** Fully working local LLM + TypeScript pipeline ✅

---

### 🔹 openrouter-streaming.ts — OpenRouter SDK (Streaming)

Uses **@openrouter/sdk** directly to stream token-by-token responses.

* Real-time output
* Best for chat UIs
* Uses async iteration

**Use when:** you need streaming UX.

---

## 🔐 Environment Variables

Create a `.env` file:

```env
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxx
```

⚠️ Never commit `.env` to GitHub.

---

## ▶️ Running All Examples

```bash
npx tsx openrouter-openai.ts
npx tsx ollama-axios.ts
npx tsx openrouter-streaming.ts
```

---

## 🧠 When to Use What

| Scenario           | Best Choice             |
| ------------------ | ----------------------- |
| Cloud LLM (simple) | openrouter-openai.ts    |
| Local & private    | ollama-axios.ts         |
| Streaming output   | openrouter-streaming.ts |
| Production agents  | LangChain               |

---

## 📜 License

MIT License — free to use and modify.

---

## ✍️ Blog

This repository supports the blog post:

**“Streaming LLM Responses with OpenRouter SDK in Node.js (TypeScript)”**


npx tsx ./src/langchain/3_component_agents/1_createAgent_tools.ts | tee raw.log
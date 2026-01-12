# 🟢 Flow Diagram — createAgent (Tool-Calling Agent)

---

## 1️⃣ One-Line Mental Model

```
User → LLM → (optional tool) → LLM → Final Answer
```

There is **no explicit loop graph**, only **implicit tool orchestration** handled by the agent.

---

## 2️⃣ High-Level Flow

```
User Messages
     ↓
createAgent
     ↓
ChatOpenAI (OpenRouter)
     ↓
Tool Call (if required)
     ↓
Final Assistant Message
```

---

## 3️⃣ Detailed Runtime Flow (Mapped 1-to-1 to Code)

```
┌─────────────────────────────────────────────┐
│                 User Input                  │
│                                             │
│ "What is the time in India?"                │
│ "What is the weather in the US?"            │
│ "And what about London?"                    │
│ "Summarize what we discussed."              │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│         agent.invoke({ messages })           │
│                                             │
│ • Entry point into createAgent runtime      │
│ • Messages stored as conversation state     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│        createAgent Orchestrator              │
│                                             │
│ • Registers tool schemas                    │
│ • Injects tool descriptions into prompt     │
│ • Prepares LLM request                      │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│        ChatOpenAI (OpenRouter)               │
│                                             │
│ LLM receives:                               │
│ • Full conversation history                │
│ • get_weather schema & description          │
│ • get_time schema & description             │
│                                             │
│ LLM decides:                                │
│ • Answer directly OR                        │
│ • Call a tool                               │
└──────────────────────┬──────────────────────┘
                       │
              ┌────────┴─────────┐
              │                  │
              ▼                  ▼
┌─────────────────────┐   ┌──────────────────────────┐
│  Direct Answer      │   │   Tool Call Emitted       │
│  (No tool needed)   │   │   (JSON arguments)       │
└──────────┬──────────┘   └───────────┬──────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐   ┌──────────────────────────┐
│  FINAL RESPONSE     │   │     TOOL EXECUTION        │
│  (assistant text)   │   │                          │
└─────────────────────┘   │ get_time({ city })       │
                           │ OR                       │
                           │ get_weather({ city })   │
                           └───────────┬────────────┘
                                       │
                                       ▼
                           ┌──────────────────────────┐
                           │     Tool Result           │
                           │  (string output)          │
                           └───────────┬────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────┐
│        ChatOpenAI (Second Call)              │
│                                             │
│ LLM receives:                               │
│ • Tool output                               │
│ • Conversation history                     │
│                                             │
│ Generates final natural-language reply      │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│          FINAL ASSISTANT MESSAGE             │
│                                             │
│ result.messages[last]                       │
└─────────────────────────────────────────────┘
```

---

## 4️⃣ Where Your Code Fits in This Flow

### 🤖 Model

```
mainModel (ChatOpenAI)
 → called once (no tool)
 → OR twice (with tool)
```

---

### 🔧 Tools

```
getTime()     → executed when time is requested
getWeather() → executed when weather is requested
```

---

### 📦 Agent

```
createAgent
 → orchestrates tool calling
 → no explicit reasoning loop
```

---

## 5️⃣ Message Lifecycle

```
User message
 → LLM decision
 → Tool (optional)
 → LLM final answer
```

Stored in:

```
result.messages[]
```

Accessed by:

```
result.messages[result.messages.length - 1]
```

---

## 6️⃣ One-Line Summary (For README / Docs)

```
createAgent = linear tool-calling agent (LLM decides when to use tools)
```

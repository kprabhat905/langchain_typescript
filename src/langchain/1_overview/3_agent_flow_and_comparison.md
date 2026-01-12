# Agent Basics, Flow, Differences, and Production Usage

This document explains:
- Agent basics and required components
- Complete agent execution flow
- Difference between `createAgent` and `createReactAgent`
- When and how both can be used together
- Real-world production use cases

---

## 1. Basics: What Is an Agent?

At the simplest level:

```
Agent = LLM + Decision Logic + Tools
```

An agent is **not just a model**.  
It is a **controller** that decides:

- Should I answer directly?
- Should I call a tool?
- Should I do multiple steps?
- Am I done?

---

## 2. Core Components Required for Any Agent

These components exist in **both `createAgent` and `createReactAgent`**.

### 2.1 Chat Model (LLM)

```
ChatOpenAI (OpenRouter / OpenAI / Azure)
```

Responsibilities:
- Understand user intent
- Decide next action
- Generate responses

---

### 2.2 Tools (Optional but Powerful)

Examples:
```
getWeather()
getTime()
```

Responsibilities:
- Perform real-world actions
- Fetch data, call APIs, query DBs
- Extend LLM beyond text

Each tool has:
- Implementation
- Metadata
- Schema validation

---

### 2.3 Agent Orchestrator

- `createAgent`
- `createReactAgent`

Responsibilities:
- Control execution flow
- Manage tool calls
- Maintain state

---

### 2.4 Messages (State)

```json
[
  { "role": "user", "content": "What is the time in India?" }
]
```

Responsibilities:
- Provide context
- Maintain conversation history
- Drive agent decisions

---

## 3. Basic Agent Flow

```
User Input
   ↓
Agent receives messages
   ↓
LLM decides next action
   ↓
(Optional) Tool execution
   ↓
Final response
```

---

## 4. Flow: createAgent

```
User → LLM → (optional tool) → LLM → Answer
```

Characteristics:
- Linear
- Fast
- Middleware friendly

---

## 5. Flow: createReactAgent

```
User → Reason → Act → Observe → Reason → … → Answer
```

Characteristics:
- Explicit reasoning loop
- Multi-step workflows
- Graph-based execution

---

## 6. Key Difference

```
createAgent trusts the model.
createReactAgent structures the model.
```

---

## 7. Using Both Together

```
User
 ↓
createAgent
 ↓
Is complex?
 ├─ No → Answer
 └─ Yes → createReactAgent → Answer
```

---

## 8. Production Use Cases

### Customer Support
- createAgent → FAQs
- createReactAgent → Investigations

### Finance
- createAgent → Lookups
- createReactAgent → Analysis

### Developer Tools
- createAgent → Snippets
- createReactAgent → Refactoring

---

## 9. Final Summary

```
Use createAgent by default.
Escalate to createReactAgent for complexity.
```

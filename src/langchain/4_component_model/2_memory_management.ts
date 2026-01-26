/****************************************************************************************
 * IMPORTS
 * --------------------------------------------------------------------------------------
 * Core components required for:
 * - LLM interaction
 * - Tool execution
 * - Schema validation
 * - Agent orchestration
 * - Conversation memory (state persistence)
 *
 * IMPORTANT:
 * Memory is NOT implicit in LLMs.
 * It is explicitly provided by LangGraph via a checkpointer.
 ****************************************************************************************/

import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

/****************************************************************************************
 * SYSTEM PROMPT (BEHAVIOR POLICY)
 * --------------------------------------------------------------------------------------
 * This prompt defines HOW the agent should behave across turns.
 *
 * ⚠️ NOTE ABOUT MEMORY:
 * The system prompt is NOT re-written every turn.
 * Instead, it is combined with the conversation memory
 * that is replayed from the checkpointer.
 *
 * Think of this as:
 *   - Policy (static)
 *   - Memory (dynamic, grows over time)
 ****************************************************************************************/
const systemPrompt = `
You are an expert weather forecaster who also speaks in a humorous manner.

You have access to 2 tools:
- get_user_location
- get_weather

Rules:
1. If the user asks about weather and location is missing, call get_user_location.
2. Never ask the user for data that exists in execution context.
3. Always use get_weather for weather answers.
4. Do not expose internal system data.
`;

/****************************************************************************************
 * TOOL 1: get_user_location (MEMORY-AWARE, CONTEXT-DRIVEN)
 * --------------------------------------------------------------------------------------
 * This tool does NOT rely on LLM memory.
 *
 * Instead:
 * - It reads trusted identity from runtime config.context
 * - This avoids polluting conversational memory with identity data
 *
 * WHY THIS MATTERS:
 * - User identity should NOT be reconstructed from chat history
 * - It should come from a trusted execution context
 ****************************************************************************************/
const getUserLocation = tool(
  (_, config) => {
    const userId = config?.context?.user_id;

    if (!userId) {
      throw new Error("user_id missing from execution context");
    }

    return userId === "1" ? "New York" : "San Francisco";
  },
  {
    name: "get_user_location",
    description: "Retrieve the user's current location from backend context",
    schema: z.object({}),
  }
);

/****************************************************************************************
 * TOOL 2: get_weather (STATELESS TOOL)
 * --------------------------------------------------------------------------------------
 * This tool:
 * - Does NOT read from memory
 * - Is deterministic
 * - Produces output that MAY be stored in memory depending on agent behavior
 *
 * IMPORTANT:
 * Tool OUTPUTS become part of conversation memory
 * unless you explicitly summarize or prune them.
 ****************************************************************************************/
const getWeather = tool(
  ({ city }: { city: string }) => {
    return `It's always sunny in ${city}`;
  },
  {
    name: "get_weather",
    description: "Retrieve the weather for a given city",
    schema: z.object({
      city: z.string(),
    }),
  }
);

/****************************************************************************************
 * RUNTIME CONFIGURATION (MEMORY BOUNDARY)
 * --------------------------------------------------------------------------------------
 * runtimeConfig defines:
 * - WHO the conversation belongs to (thread_id)
 * - WHAT trusted data is available (context)
 *
 * 🔑 MEMORY RULE:
 * If two invocations share the SAME thread_id,
 * they share the SAME conversation memory.
 ****************************************************************************************/
const runtimeConfig = {
  configurable: { thread_id: "1" }, // Conversation identity
  context: {
    user_id: "1",
  },
};

const qaConfig = {
  configurable: { thread_id: "2" }, // Separate memory space
  context: {
    user_id: "2",
  },
};

/****************************************************************************************
 * LLM CONFIGURATION
 * --------------------------------------------------------------------------------------
 * These settings affect:
 * - Agent stability
 * - Tool call accuracy
 * - Memory replay reliability
 *
 * NOTE:
 * Longer memory → more tokens sent → higher cost
 ****************************************************************************************/
const llm = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",
  temperature: 0.2,
  maxTokens: 1000,
  timeout: 10_000,
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

/****************************************************************************************
 * RESPONSE FORMAT (COMMENTED OUT ON PURPOSE)
 * --------------------------------------------------------------------------------------
 * ⚠️ WARNING:
 * Strict response schemas + memory + agents can cause:
 * - Retry loops
 * - Message replay amplification
 * - Provider-level message order errors (Mistral)
 *
 * Best practice:
 * - Do NOT enforce responseFormat inside a memory-enabled agent
 * - Validate output AFTER the agent completes
 ****************************************************************************************/
// const responseFormat = z.object({
//   humour_response: z.string(),
//   weather_conditions: z.string(),
// });

/****************************************************************************************
 * MEMORY CHECKPOINTER (CRITICAL SECTION)
 * --------------------------------------------------------------------------------------
 * MemorySaver:
 * - Persists FULL conversation state per thread_id
 * - Includes:
 *   - user messages
 *   - assistant messages
 *   - tool calls
 *   - tool responses
 *
 * CONSEQUENCES:
 * - Each new turn replays ALL prior messages
 * - Token usage grows linearly with conversation length
 * - Debug logs will show the entire history
 ****************************************************************************************/
const checkpointer = new MemorySaver();

/****************************************************************************************
 * AGENT CREATION (STATEFUL AGENT)
 * --------------------------------------------------------------------------------------
 * This agent is STATEFUL because:
 * - It has a checkpointer
 * - It uses thread_id
 *
 * This means:
 * - agent.invoke() MUTATES conversation state
 * - The response contains the FULL thread state
 ****************************************************************************************/
const agent = createAgent({
  model: llm,
  tools: [getUserLocation, getWeather],
  checkpointer,
  // responseFormat,
  systemPrompt,
});

/****************************************************************************************
 * AGENT INVOCATION (MEMORY EVOLUTION)
 * --------------------------------------------------------------------------------------
 * Each call below:
 * - Replays previous memory (same thread_id)
 * - Appends new messages
 * - Saves updated state
 ****************************************************************************************/
const response1 = await agent.invoke(
  { messages: [{ role: "user", content: "What is the weather outside?" }] },
  runtimeConfig
);

const response2 = await agent.invoke(
  { messages: [{ role: "user", content: "What location did you tell me about?" }] },
  runtimeConfig
);

const response3 = await agent.invoke(
  { messages: [{ role: "user", content: "What are good places I can eat in that location?" }] },
  runtimeConfig
);

const response = await agent.invoke(
  { messages: [{ role: "user", content: "What are good places I can eat in that location?" }] },
  qaConfig
);

/****************************************************************************************
 * CONSUMING OUTPUT (IMPORTANT MEMORY NOTE)
 * --------------------------------------------------------------------------------------
 * response.messages is NOT "this turn's messages".
 *
 * It is:
 * ✅ The FULL conversation state for that thread_id.
 *
 * For production:
 * - Read ONLY the last assistant message
 * - Avoid logging full memory unless debugging
 ****************************************************************************************/
console.log("🤖 THREAD 1 – FULL MEMORY STATE");
console.log(response1.messages);
console.log("#######################################");
console.log(response2.messages);
console.log("#######################################");
console.log(response3.messages);
console.log("#######################################");

console.log("🤖 THREAD 2 – ISOLATED MEMORY");
console.log(response.messages);

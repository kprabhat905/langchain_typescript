/****************************************************************************************
 * MINIMAL createAgent (LangChain v1 - NOT createReactAgent)
 * --------------------------------------------------------------------------------------
 * createAgent (v1) vs createReactAgent (v0):
 *
 * v0 createReactAgent: Explicit ReAct prompt template
 * v1 createAgent:     Auto-generates ReAct loop + middleware support
 *
 * createAgent INTERNALLY implements ReAct pattern but with:
 * ✅ Cleaner API
 * ✅ Built-in middleware
 * ✅ Native structured output
 * ✅ Better free model support
 ****************************************************************************************/

/****************************************************************************************
 * IMPORTS BREAKDOWN
 * --------------------------------------------------------------------------------------
 * ┌─────────────────────────────────────────────────────────────┐
 * │ @langchain/openai    → ChatOpenAI                           │ ✅ Provider-agnostic LLM
 * │ dotenv/config        → .env loader                          │ ✅ Secrets management
 * │ @langchain/core/tools→ tool() factory                       │ ✅ Structured tool creator
 * │ zod                 → Input validation                      │ ✅ LLM argument contracts
 * │ langchain           → createAgent() v1                      │ ✅ Modern agent framework
 * └─────────────────────────────────────────────────────────────┘
 ****************************************************************************************/
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain"; // v1 createAgent (NOT createReactAgent)

/****************************************************************************************
 * SINGLE TOOL: get_weather (LLM-INPUT DRIVEN)
 * --------------------------------------------------------------------------------------
 * createAgent TOOL FLOW:
 *
 * 1. LLM sees tool description in auto-generated prompt
 * 2. LLM parses user input → generates tool call args
 * 3. Zod validates args → executes tool
 * 4. Tool result → back to LLM for final synthesis
 *
 * NO CONTEXT NEEDED: Pure LLM input → tool → answer
 ****************************************************************************************/
const getWeather = tool(
  // LLM-GENERATED INPUT (structured + validated)
  ({ city }: { city: string }) => {
    /*
    TOOL EXECUTION CONTEXT:
    • city = "New York" (extracted from user message)
    • Production: await weatherAPI(city)
    */
    return `☀️ It's always sunny in ${city}! (72°F, clear skies)`;
  },
  {
    name: "get_weather",
    description: `
      Get the current weather for a given city.
    `,
    schema: z.object({
      city: z.string(),
    }),
  }
);

const getTime = tool(
  (city) => {
    return `the current time in ${city} is 3:00 PM.`;
  },
  {
    name: "get_time",
    description: "Get the current time for a given city",
    schema: z.object({
      city: z.string(),
    }),
  }
);
/****************************************************************************************
 * LLM: OpenRouter Free Tier (createAgent Optimized)
 * --------------------------------------------------------------------------------------
 * createAgent WORKS BETTER with free models because:
 * • Auto-optimized ReAct prompts
 * • Smarter tool call parsing
 * • Built-in recursion limits
 ****************************************************************************************/
const llm = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
  temperature: 0.1, // Reliable tool calling
});

/****************************************************************************************
 * createAgent (v1) - SIMPLIFIED REACT IMPLEMENTATION
 * --------------------------------------------------------------------------------------
 * createAgent AUTO-HANDLES:
 * 1. ReAct prompt generation ("Think → Act → Observe")
 * 2. Tool description injection
 * 3. Loop management (model → tool → model → ...)
 * 4. Termination detection
 *
 * NO EXPLICIT PROMPT TEMPLATE REQUIRED (unlike v0 createReactAgent)
 ****************************************************************************************/
const agent = createAgent({
  model: llm, // Decides reasoning vs tool calls
  tools: [getWeather, getTime], // LLM selects dynamically
});

/****************************************************************************************
 * INVOCATION: PURE USER MESSAGES
 * --------------------------------------------------------------------------------------
 * createAgent EXPECTS:
 * • User messages only
 * • Handles all system/tool prompts internally
 * • No config/context (this example has none)
 *
 * INTERNAL MESSAGE FLOW (5 steps):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 0: User: "Weather in New York?"                            │
 * │ 1: Agent: "Call get_weather(city: 'New York')"              │
 * │ 2: Tool: "☀️ Sunny in New York! (72°F)"                     │
 * │ 3: Agent: "Synthesize final answer with pun"                │
 * │ 4: Agent: "Here's your forecast! ☀️" ← result.messages[4]   │
 * └─────────────────────────────────────────────────────────────┘
 ****************************************************************************************/
const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: `
        What is the weather in New York? 
        Make the forecast punny! 🌤️
      `,
    },
    {
      role: "user",
      content: `
        What is the time in New York? 
        Make the forecast punny! 🌤️
      `,
    },
    {
      role: "user",
      content: `
        What is the time and weather in New York? 
      `,
    },
  ],
  // No config needed (no context-driven tools)
});

console.log("🤖 FINAL ANSWER:");
console.log(result.messages[result.messages.length - 1].content);

/****************************************************************************************
 * EXPECTED OUTPUT:
 *
 * 🤖 FINAL ANSWER:
 * The weather in New York is sunny! ☀️ (72°F, clear skies)
 *
 * Perfect for some "Big Apple shine"! 🍎✨
 ****************************************************************************************/

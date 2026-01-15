/****************************************************************************************
 * WHAT IS RUNTIME CONFIGURATION?
 * --------------------------------------------------------------------------------------
 * Runtime configuration is **external input** passed to the agent at invocation time.
 *
 * It is NOT part of:
 * - The prompt
 * - The tool schema
 * - The model configuration
 *
 * Instead, it is **execution-time metadata** that:
 * ✅ Persists across tool calls
 * ✅ Is invisible to the LLM unless you expose it
 * ✅ Is safely accessible inside tools and middleware
 *
 * Think of runtime config as:
 * 👉 "Everything your backend knows, but the LLM does NOT"
 *
 * Examples:
 * - userId (from auth token)
 * - tenantId
 * - permissions / roles
 * - feature flags
 * - request-scoped metadata
 ****************************************************************************************/

/****************************************************************************************
 * MINIMAL createAgent (LangChain v1 - NOT createReactAgent)
 ****************************************************************************************/

import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain";

/****************************************************************************************
 * DATABASE (INFRASTRUCTURE – NOT PART OF RUNTIME TYPE)
 ****************************************************************************************/
const db = {
  users: {
    async getById(userId: string) {
      const users: Record<string, { city: string }> = {
        "1": { city: "New York" },
        "2": { city: "San Francisco" },
      };
      return users[userId] ?? { city: "Unknown" };
    },
  },
};

/****************************************************************************************
 * RUNTIME CONFIG OBJECT
 * --------------------------------------------------------------------------------------
 * This config is passed ONLY at invocation time.
 *
 * IMPORTANT:
 * - LLM NEVER sees this directly
 * - Tools CAN read this via `config.context`
 * - This mimics real production behavior (auth, session, DB lookup)
 ****************************************************************************************/
const config = {
  context: {
    // Example: extracted from JWT / session / request header
    userId: "1",
  },
};

/****************************************************************************************
 * TOOL: get_user_location (CONTEXT-DRIVEN TOOL)
 * --------------------------------------------------------------------------------------
 * This tool does NOT take LLM input.
 *
 * Why?
 * - The user never told us their city
 * - The LLM should NOT guess sensitive data
 *
 * Instead:
 * - Backend already knows who the user is
 * - Tool reads userId from runtime config
 * - Tool resolves location internally
 *
 * KEY IDEA:
 * 👉 Tools can depend on BACKEND CONTEXT, not just LLM arguments
 ****************************************************************************************/
const getUserLocation = tool(
  // Executor
  // 1st param: Tool input arguments from the LLM. Source: From model output
  // 2nd param: Runtime execution context. Source: From agent.invoke(..., config)
  async (_, config) => {
    const userId = config.context?.userId;

    // ✅ Correct pattern: DB accessed via closure
    const user = await db.users.getById(userId);

    return user.city;
  },
  {
    name: "get_user_location",
    description: `
      Get the user's location based on authenticated user context.
      Use this when the user asks about weather without specifying a city.
    `,
    /**
     * Empty schema means:
     * - LLM sends NO arguments
     * - Tool relies entirely on runtime config
     */
    schema: z.object({}),
  }
);

/****************************************************************************************
 * TOOL: get_weather (LLM-INPUT DRIVEN TOOL)
 * --------------------------------------------------------------------------------------
 * This tool IS driven by the LLM.
 *
 * Flow:
 * 1. LLM reads tool description
 * 2. LLM extracts city from conversation
 * 3. Zod validates the input
 * 4. Tool executes
 ****************************************************************************************/
const getWeather = tool(
  ({ city }: { city: string }) => {
    return `☀️ It's always sunny in ${city}! (72°F, clear skies)`;
  },
  {
    name: "get_weather",
    description: "Get the current weather for a given city",
    schema: z.object({
      city: z.string(),
    }),
  }
);

/****************************************************************************************
 * MODEL CONFIGURATION
 ****************************************************************************************/
const llm = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
  temperature: 0.1,
});

/****************************************************************************************
 * AGENT CREATION
 * --------------------------------------------------------------------------------------
 * createAgent builds a LangGraph runtime internally.
 *
 * Internally this becomes:
 * __start__ → model → tools → model → __end__
 ****************************************************************************************/
const agent = createAgent({
  model: llm,
  tools: [getWeather, getUserLocation],
});

/****************************************************************************************
 * INVOCATION WITH RUNTIME CONFIG
 * --------------------------------------------------------------------------------------
 * This is where runtime config is injected.
 *
 * IMPORTANT:
 * - messages = what the LLM sees
 * - config    = what ONLY tools/middleware see
 ****************************************************************************************/
const result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content: "What is the weather outside?",
      },
    ],
  },
  config // 👈 runtime configuration injected here
);

console.log("🤖 FINAL ANSWER:");
console.log(result.messages.at(-1)?.content);

/****************************************************************************************
 * KEY TAKEAWAYS (PRODUCTION MENTAL MODEL)
 *
 * Prompt      → What the LLM reasons over
 * Tools       → What the LLM can DO
 * Runtime Config → What YOUR SYSTEM already knows
 *
 * NEVER:
 * ❌ Put userId, tokens, permissions in prompts
 *
 * ALWAYS:
 * ✅ Pass them via runtime config
 * ✅ Resolve sensitive data inside tools
 *
 * This separation prevents:
 * - Data leakage
 * - Prompt injection
 * - Infinite loops
 * - Hallucinated context
 ****************************************************************************************/

/****************************************************************************************
 * AGENT + TOOL SETUP WITH USER CONTEXT + SYSTEM PROMPT
 * --------------------------------------------------------------------------------------
 * This file demonstrates a REAL-WORLD agent pattern:
 *
 * 1️⃣ How tools are defined and registered with an agent
 * 2️⃣ How tools can access trusted runtime data (user_id) via `config`
 * 3️⃣ How the agent chains multiple tools automatically (ReAct loop)
 * 4️⃣ How execution context flows:
 *
 *    Application → agent.invoke(input, config)
 *                → Agent (LLM reasoning)
 *                → Tool execution (_, config)
 *                → Agent (final answer)
 *
 * IMPORTANT:
 * - User identity and personalization DO NOT come from prompts
 * - They come from runtime configuration
 ****************************************************************************************/

import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain";

/****************************************************************************************
 * SYSTEM PROMPT
 * --------------------------------------------------------------------------------------
 * This prompt defines the agent's ROLE and HIGH-LEVEL STRATEGY.
 *
 * It does NOT contain:
 * ❌ user_id
 * ❌ session data
 * ❌ personalization
 *
 * Those belong to runtime config, not prompts.
 ****************************************************************************************/
const systemPrompt = `You are an expert weather assistant.

You have access to 2 tools:

- get_user_location: Retrieves the user's current location based on their user ID.
- get_weather: Retrieves the weather for a given city.

If the user asks about the weather, ensure you know the location first.
If the question implies "wherever I am", use get_user_location.
Then use get_weather to answer.
`;

/****************************************************************************************
 * TOOL 1: get_user_location (CONTEXT-DRIVEN TOOL)
 * --------------------------------------------------------------------------------------
 * Purpose:
 * - Resolve the user's location WITHOUT asking the user
 * - Uses trusted runtime context instead of LLM input
 *
 * Why this matters:
 * - Prevents prompt injection
 * - Prevents identity spoofing
 * - Makes the tool deterministic and secure
 ****************************************************************************************/
const getUserLocation = tool(
  /**
   * TOOL EXECUTOR SIGNATURE
   *
   * (_, config)
   *
   * `_`      → LLM-generated arguments (ignored here on purpose)
   * `config` → Runtime execution context injected by the application
   *
   * The LLM DOES NOT see `config`.
   * Only your backend code does.
   */
  (_, config) => {
    /**
     * Read trusted data from runtime config.
     * This comes from `agent.invoke(input, config)`.
     */
    const userId = config.context.user_id;

    /**
     * Demo logic:
     * - Hardcoded for simplicity
     * - In production, replace with:
     *   • database lookup
     *   • user profile service
     *   • auth/session store
     */
    return userId === "1" ? "New York" : "San Francisco";
  },
  {
    /**
     * Tool name:
     * - Must be stable
     * - This is the exact string the LLM will emit when calling the tool
     */
    name: "get_user_location",

    /**
     * Tool description:
     * - Tells the LLM WHEN this tool is useful
     * - Not HOW the data is fetched
     */
    description:
      "Retrieves the user's current location based on their user ID.",

    /**
     * Empty schema (VERY IMPORTANT):
     *
     * This means:
     * ✅ LLM sends NO arguments
     * ✅ All data comes from runtime context
     *
     * Use this pattern for:
     * - Auth data
     * - Session data
     * - User identity
     */
    schema: z.object({}),
  }
);

/****************************************************************************************
 * TOOL 2: get_weather (LLM-INPUT-DRIVEN TOOL)
 * --------------------------------------------------------------------------------------
 * Purpose:
 * - Fetch weather for a specific city
 * - City can come from:
 *   • user message ("Weather in New York?")
 *   • another tool's output (get_user_location)
 ****************************************************************************************/
const getWeather = tool(
  /**
   * Tool executor receives structured, validated input from the LLM.
   * Zod guarantees `city` exists and is a string.
   */
  ({ city }: { city: string }) => {
    /**
     * In production:
     * - Call real weather API
     * - Handle failures / retries
     */
    return `It's always sunny in ${city}`;
  },
  {
    name: "get_weather",
    description: "Retrieves the weather for a given city.",

    /**
     * Input contract:
     * - Forces the LLM to generate `{ city: string }`
     * - Prevents malformed tool calls
     */
    schema: z.object({
      city: z.string(),
    }),
  }
);

/****************************************************************************************
 * RUNTIME EXECUTION CONTEXT
 * --------------------------------------------------------------------------------------
 * Runtime config is:
 * ✅ Provided by your application
 * ❌ Not generated by the LLM
 * ❌ Not visible to the user
 *
 * This is where:
 * - user identity
 * - permissions
 * - session info
 * - feature flags
 * should live.
 ****************************************************************************************/
const config = {
  context: {
    user_id: "1", // Authenticated user ID
  },
  db: {
    // Database connections, etc.
  },
};

const qaconfig = {
  context: {
    user_id: "3",
  },
  db: {
    // Database connections, etc.
  },
};

/****************************************************************************************
 * LLM CONFIGURATION (OpenRouter)
 * --------------------------------------------------------------------------------------
 * ChatOpenAI is used as a provider-agnostic client.
 * OpenRouter allows access to free-tier and multiple models.
 ****************************************************************************************/
const llm = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

/****************************************************************************************
 * AGENT CREATION
 * --------------------------------------------------------------------------------------
 * createAgent:
 * - Automatically builds a ReAct loop
 * - Handles:
 *   • reasoning
 *   • tool selection
 *   • tool execution
 *   • termination
 *
 * You do NOT need to write ReAct prompts manually.
 ****************************************************************************************/
const agent = createAgent({
  model: llm,
  tools: [getUserLocation, getWeather],
  systemPrompt,
});

/****************************************************************************************
 * AGENT INVOCATION
 * --------------------------------------------------------------------------------------
 * IMPORTANT:
 * - User messages go in `messages`
 * - Trusted data goes in `config`
 *
 * Flow:
 * 1️⃣ User asks: "What is the weather outside?"
 * 2️⃣ LLM decides location is needed
 * 3️⃣ Calls get_user_location (_, config)
 * 4️⃣ Receives city
 * 5️⃣ Calls get_weather({ city })
 * 6️⃣ Synthesizes final answer
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
  config // Runtime context passed separately from messages
);

/**
 * Final assistant response is always the LAST message.
 */
console.log(result.messages.at(-1)?.content);

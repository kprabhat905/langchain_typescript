/****************************************************************************************
 * IMPORTS
 * --------------------------------------------------------------------------------------
 * - ChatOpenAI  → OpenAI-compatible LLM client (via OpenRouter)
 * - tool()      → Structured, schema-driven tool definition
 * - zod         → Runtime validation + response contracts
 * - createAgent → LangChain v1 agent runtime (auto ReAct loop)
 ****************************************************************************************/

import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain";

/****************************************************************************************
 * SYSTEM PROMPT (POLICY, NOT CONFIGURATION)
 * --------------------------------------------------------------------------------------
 * The system prompt defines **behavioral rules**, not execution settings.
 *
 * ❌ Do NOT configure temperature, tokens, or timeouts here
 * ❌ Do NOT embed user identity or runtime data
 *
 * ✅ Prompts = reasoning policy
 * ✅ Model config = execution behavior
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
 * TOOL 1: get_user_location (CONTEXT-DRIVEN)
 * --------------------------------------------------------------------------------------
 * This tool:
 * - Takes NO input from the LLM
 * - Reads trusted identity from runtime config
 *
 * Pattern:
 * (_, config) → ignore LLM input, rely on backend context
 ****************************************************************************************/
const getUserLocation = tool(
  (_, config) => {
    const userId = config?.context?.user_id;

    if (!userId) {
      throw new Error("user_id missing from execution context");
    }

    // Demo logic — replace with DB or identity service
    return userId === "1" ? "New York" : "San Francisco";
  },
  {
    name: "get_user_location",
    description: "Retrieve the user's current location from backend context",
    schema: z.object({}), // ⬅️ No LLM arguments allowed
  }
);

/****************************************************************************************
 * TOOL 2: get_weather (LLM-INPUT-DRIVEN)
 ****************************************************************************************/
const getWeather = tool(
  ({ city }: { city: string }) => {
    // Replace with real weather API
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
 * RUNTIME CONFIGURATION
 * --------------------------------------------------------------------------------------
 * Runtime config is injected at invocation time.
 *
 * KEY RULE:
 * - If a tool reads from config.context, you MUST provide it here.
 ****************************************************************************************/
const runtimeConfig = {
  context: {
    user_id: "1", // Authenticated identity (trusted)
  },
};

/****************************************************************************************
 * LLM CONFIGURATION (AGENT-TUNED, NOT CHATBOT-TUNED)
 * --------------------------------------------------------------------------------------
 * These parameters control **agent stability**, not creativity.
 ****************************************************************************************/
const llm = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",

  /**
   * temperature
   * ------------------------------------------------------------------
   * Controls randomness in model output.
   *
   * For agents:
   * - LOWER is better (0.0 – 0.3)
   * - Reduces hallucinated tool calls
   * - Improves deterministic behavior
   *
   * High temperature is GREAT for storytelling,
   * but DANGEROUS for tool-based systems.
   */
  temperature: 0.2,

  /**
   * maxTokens
   * ------------------------------------------------------------------
   * Maximum tokens the model can generate in ONE call.
   *
   * For agents, this must cover:
   * - reasoning steps
   * - tool call JSON
   * - final response
   *
   * Too low:
   * ❌ truncated JSON
   * ❌ broken tool calls
   *
   * Too high:
   * ❌ unnecessary cost
   */
  maxTokens: 1000,

  /**
   * timeout (milliseconds)
   * ------------------------------------------------------------------
   * Maximum time allowed for ONE model call.
   *
   * Recommended ranges:
   * - 5–10s → user-facing APIs
   * - 15–30s → background workflows
   *
   * Prevents:
   * ❌ hung requests
   * ❌ stalled agent loops
   */
  timeout: 10_000,

  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

/****************************************************************************************
 * STRUCTURED RESPONSE FORMAT (NON-NEGOTIABLE FOR PRODUCTION)
 * --------------------------------------------------------------------------------------
 * This schema defines the ONLY valid final output.
 *
 * The agent:
 * - MUST return this shape
 * - MUST stop after producing it
 *
 * This turns the agent into a **reliable system component**.
 ****************************************************************************************/
const responseFormat = z.object({
  humour_response: z.string(),
  weather_conditions: z.string(),
});

/****************************************************************************************
 * AGENT CREATION
 * --------------------------------------------------------------------------------------
 * createAgent automatically:
 * - Builds ReAct loop
 * - Injects tool schemas
 * - Enforces structured output
 * - Stops execution when schema is satisfied
 ****************************************************************************************/
const agent = createAgent({
  model: llm,
  tools: [getUserLocation, getWeather],
  responseFormat,
  systemPrompt
});

/****************************************************************************************
 * AGENT INVOCATION
 * --------------------------------------------------------------------------------------
 * Messages:
 * - ONLY user messages
 * - System prompt handled by agent config
 *
 * Runtime config:
 * - Trusted data only
 ****************************************************************************************/
const response = await agent.invoke(
  {
    messages: [
      { role: "user", content: "What is the weather outside?" },
    ],
  },
  runtimeConfig
);

/****************************************************************************************
 * CONSUMING STRUCTURED OUTPUT
 * --------------------------------------------------------------------------------------
 * NO string parsing.
 * NO regex.
 * NO guessing.
 ****************************************************************************************/
console.log("🤖 STRUCTURED RESPONSE:");
console.log(response.structuredResponse);

/*
Example output:

{
  humour_response: "Looks like the sun decided to steal the spotlight today 😄",
  weather_conditions: "It's always sunny in New York"
}
*/

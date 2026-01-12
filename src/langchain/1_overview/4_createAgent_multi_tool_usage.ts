/****************************************************************************************
 * ENVIRONMENT SETUP
 * --------------------------------------------------------------------------------------
 * Loads environment variables from a `.env` file into `process.env`.
 *
 * Why this is required:
 * - Your OpenRouter API key is stored securely in `.env`
 * - `ChatOpenAI` reads the API key at runtime
 *
 * Example `.env`:
 * OPENROUTER_API_KEY=sk-xxxxxxxx
 ****************************************************************************************/
import "dotenv/config";

/****************************************************************************************
 * IMPORTS
 * --------------------------------------------------------------------------------------
 * createAgent:
 *   - High-level agent factory provided by LangChain Core.
 *   - Automatically handles:
 *       • Tool calling
 *       • Message routing
 *       • Model interaction
 *
 * summarizationMiddleware:
 *   - (Not used here, but commonly paired with createAgent)
 *   - Enables automatic conversation summarization.
 *
 * ChatOpenAI:
 *   - OpenAI-compatible chat model wrapper.
 *   - Works with OpenRouter by overriding baseURL.
 *
 * tool:
 *   - Helper to define structured, callable tools for the agent.
 *
 * zod:
 *   - Runtime schema validation for tool inputs.
 *   - Prevents malformed or hallucinated arguments.
 ****************************************************************************************/
import { createAgent, summarizationMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/****************************************************************************************
 * TOOL: getWeather
 * --------------------------------------------------------------------------------------
 * A tool is a function the agent can decide to call.
 *
 * Tool anatomy:
 * 1) Implementation:
 *    - The actual function executed at runtime
 *    - Receives validated input
 *
 * 2) Metadata:
 *    - name: identifier used by the LLM
 *    - description: tells the model WHEN to use the tool
 *    - schema: validates inputs using Zod
 ****************************************************************************************/
const getWeather = tool(
  /**
   * Tool implementation
   * - Input is automatically validated by the Zod schema below
   * - Destructuring allows direct access to `city`
   */
  async ({ city }: { city: string }) => {
    // In real-world apps, replace this with a real weather API call
    return `It's always sunny in ${city}`;
  },
  {
    /**
     * Unique tool name.
     * This is what the LLM references internally when calling the tool.
     */
    name: "get_weather",

    /**
     * Description is critical:
     * - The LLM reads this to decide whether to use the tool
     * - Be explicit and action-oriented
     */
    description: "Get weather for a city.",

    /**
     * Input schema:
     * - Enforced at runtime
     * - Prevents invalid / hallucinated arguments
     */
    schema: z.object({
      city: z.string(),
    }),
  }
);

/****************************************************************************************
 * TOOL: getTime
 * --------------------------------------------------------------------------------------
 * Second tool that returns time information for a given city.
 *
 * Having multiple tools allows the agent to:
 * - Decide which tool to call
 * - Chain reasoning + tool usage automatically
 ****************************************************************************************/
const getTime = tool(
  /**
   * Tool implementation
   */
  async ({ city }: { city: string }) => {
    // Static value for demo purposes
    return `The current time in ${city} is 3:00 PM`;
  },
  {
    name: "get_time",
    description: "Get time for a given city.",
    schema: z.object({
      city: z.string(),
    }),
  }
);

/****************************************************************************************
 * MAIN MODEL CONFIGURATION (OpenRouter – FREE)
 * --------------------------------------------------------------------------------------
 * ChatOpenAI is used with OpenRouter instead of OpenAI directly.
 *
 * Key configuration notes:
 * - model:
 *     OpenRouter-hosted free-tier model
 *
 * - apiKey:
 *     Loaded from environment variables
 *
 * - baseURL:
 *     Redirects OpenAI-compatible requests to OpenRouter
 ****************************************************************************************/
const mainModel = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

/****************************************************************************************
 * AGENT CREATION (createAgent)
 * --------------------------------------------------------------------------------------
 * createAgent wires together:
 * - The main LLM
 * - All available tools
 *
 * Internally, the agent:
 * 1) Receives user messages
 * 2) Decides whether a tool is required
 * 3) Calls the tool if needed
 * 4) Observes the tool result
 * 5) Produces a final response
 *
 * This is a TOOL-CALLING agent (not LangGraph / ReAct graph).
 ****************************************************************************************/
const agent = createAgent({
  model: mainModel,

  /**
   * List of tools the agent is allowed to use.
   * The LLM will NEVER call tools not listed here.
   */
  tools: [getWeather, getTime],
});

/****************************************************************************************
 * INVOCATION
 * --------------------------------------------------------------------------------------
 * agent.invoke():
 * - Executes the full agent loop
 * - Accepts an array of messages
 * - Returns the full conversation trace
 *
 * Message format:
 * {
 *   role: "system" | "user" | "assistant"
 *   content: string
 * }
 ****************************************************************************************/
async function run() {
  const result = await agent.invoke({
    messages: [
      { role: "user", content: "What is the time in India?" },
      { role: "user", content: "What is the weather in the US?" },
      { role: "user", content: "And what about London?" },
      { role: "user", content: "Summarize what we discussed." },
    ],
  });

  /****************************************************************************************
   * RESULT HANDLING
   * --------------------------------------------------------------------------------------
   * result contains:
   * - messages: full conversation history
   * - metadata: tool calls, usage info, etc.
   ****************************************************************************************/

  console.log("\n✅ FULL AGENT RESULT:");
  console.log(result);

  /**
   * Most common usage:
   * - Access the final assistant message only
   */
  console.log("\n✅ FINAL ASSISTANT MESSAGE:");
  console.log(result.messages[result.messages.length - 1]?.content);
}

/****************************************************************************************
 * ENTRY POINT
 ****************************************************************************************/
run().catch(console.error);

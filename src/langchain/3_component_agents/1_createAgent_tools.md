/****************************************************************************************
 * createAgent Tool Schema Flow (Zod + LLM Extraction)
 * 
 * FLOW DIAGRAM:
 * 
 *                   ┌─────────────────────────────────────────┐
 *                   │ 1. User: "Weather in New York?"         │
 *                   └─────────────────┬───────────────────────┘
 *                                     │
 *                                     ▼
 * ┌──────────────────────┐    ┌─────────────────────────────────────────┐
 * │ 2. LLM Reads Tool    │◀───│ TOOL METADATA (Param 2)                 │
 * │ Description + Schema │    │ • description: "Get weather for city"    │
 * └──────────────────────┘    │ • schema: z.object({city: z.string()})  │
 *                             └─────────────────────────────────────────┘
 *                                     │
 *                                     ▼ "Schema says: input = {city: string}"
 * ┌──────────────────────┐    ┌─────────────────────────────────────────┐
 * │ 3. LLM Extracts      │───▶│ 4. LLM Generates Structured Args         │
 * │ "New York" from      │    │ {                                      │
 * │ User Message         │    │   name: "get_weather",                  │
 * └──────────────────────┘    │   city: "New York"                      │
 *                             │ }                                        │
 *                             └─────────────────────────────────────────┘
 *                                     │
 *                                     ▼ Zod Schema Validation ✓
 * ┌──────────────────────┐    ┌─────────────────────────────────────────┐
 * │ 5. EXECUTOR Runs     │◀───│ 6. Input Passed to Function             │
 * │ (Param 1)            │    │ ({ city }: { city: string })             │
 * └──────────────────────┘    │ city = "New York"                       │
 *                             └─────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌──────────────────────┐
 * │ 7. Return Weather    │ ──▶ Agent: "Sunny in NY! ☀️"
 * │ "☀️ Sunny in NY!"    │
 * └──────────────────────┘
 ****************************************************************************************/

/****************************************************************************************
 * 2 REQUIRED PARAMETERS EXPLANATION (No Code - Pure Flow)
 * 
 * PARAMETER 1: EXECUTOR FUNCTION
 * • WHAT: Code that runs when tool is called
 * • INPUT: LLM-generated object (Zod validated)
 * • JOB: Process input → Call backend API → Return result
 * • FLOW: LLM args → Schema check → Destructuring → Your code runs
 * 
 * PARAMETER 2: METADATA (name + description + schema)
 * • WHAT: Instructions telling LLM "how to call me"
 * • name: Exact string LLM must output (e.g. "get_weather")
 * • description: Explains WHEN/WHY to use this tool
 * • schema: Defines input shape LLM must generate
 * 
 * CRITICAL FLOW:
 * 1. LLM reads description: "Weather tool? Yes!"
 * 2. LLM reads schema: "Needs {city: string}"
 * 3. LLM extracts "New York" from user message
 * 4. LLM constructs: {name: "get_weather", city: "New York"}
 * 5. Zod validates structure matches schema
 * 6. Executor receives ({city: "New York"}) → Runs your backend code
 * 7. Returns weather → LLM makes final answer
 ****************************************************************************************/

/****************************************************************************************
 * WHY SCHEMA (Zod) IS CRITICAL
 * 
 * WITHOUT SCHEMA: LLM guesses input format → Errors/Crashes
 * WITH SCHEMA:   LLM generates EXACT structure → Guaranteed execution
 * 
 * USER: "Weather in New York?"
 * 
 * LLM THINKS:
 * "User wants weather → Matches get_weather description
 *  Schema says input = {city: string} → Extract 'New York'
 *  Generate tool call: {name: 'get_weather', city: 'New York'}"
 * 
 * EXECUTOR GETS PERFECT INPUT → Runs flawlessly
 ****************************************************************************************/

const llm = new ChatOpenAI({
  model: "mistralai/devstral-2512:free",
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
});

const agent = createAgent({
  model: llm,
  tools: [getWeather],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Weather in New York?" }],
});

console.log(result.messages[result.messages.length - 1].content);
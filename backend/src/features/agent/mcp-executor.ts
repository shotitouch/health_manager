import { z } from 'zod';
import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';

// ---------------------------------------------------------------------------
// MCP tool input schemas — LLM output is external data; validate before use.
// ---------------------------------------------------------------------------

const McpInputSchemas: Record<string, z.ZodTypeAny> = {
  search_food_library: z.object({ query: z.string().min(1) }),
  search_nutrition_usda: z.object({ query: z.string().min(1) }),
  search_nutrition_thai: z.object({ query: z.string().min(1) }),
  web_search: z.object({ query: z.string().min(1) }),
  get_user_log: z.object({
    date: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  get_user_profile: z.object({}),
  save_food_entry: z.object({
    name: z.string().min(1),
    calories: z.number().nonnegative(),
    protein_g: z.number().nonnegative().optional(),
    fat_g: z.number().nonnegative().optional(),
    carbs_g: z.number().nonnegative().optional(),
    weight_g: z.number().nonnegative().optional(),
    logged_at: z.string().optional(),
  }),
  save_exercise_entry: z.object({
    name: z.string().min(1),
    calories_burned: z.number().nonnegative(),
    duration_min: z.number().nonnegative().optional(),
    logged_at: z.string().optional(),
  }),
  save_to_food_library: z.object({
    name: z.string().min(1),
    default_calories: z.number().nonnegative(),
    default_protein_g: z.number().nonnegative().optional(),
    default_fat_g: z.number().nonnegative().optional(),
    default_carbs_g: z.number().nonnegative().optional(),
    default_weight_g: z.number().nonnegative().optional(),
    source: z.string().optional(),
  }),
  save_to_exercise_library: z.object({
    name: z.string().min(1),
    default_calories_per_min: z.number().nonnegative().optional(),
    met_value: z.number().nonnegative().optional(),
    source: z.string().optional(),
  }),
  search_exercise_library: z.object({ query: z.string().min(1) }),
};

// ---------------------------------------------------------------------------
// MCP tool execution.
// ---------------------------------------------------------------------------

export async function executeMcpTool(block: ToolUseBlock, _userId: string): Promise<unknown> {
  const schema = McpInputSchemas[block.name];
  if (!schema) {
    throw Object.assign(new Error(`Unknown MCP tool: ${block.name}`), { status: 500 });
  }

  const parsed = schema.safeParse(block.input);
  if (!parsed.success) {
    throw Object.assign(
      new Error(
        `Invalid input for ${block.name}: ${parsed.error.issues.map((i) => i.message).join('; ')}`
      ),
      { status: 400 }
    );
  }
  const input = parsed.data as Record<string, unknown>;

  switch (block.name) {
    case 'search_nutrition_usda': {
      const apiKey = process.env.USDA_API_KEY;
      if (!apiKey) return { items: [], note: 'USDA_API_KEY not set in environment' };
      const query = encodeURIComponent(input.query as string);
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${query}&pageSize=3&api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return { items: [], error: `USDA API returned ${res.status}` };
      const data = (await res.json()) as {
        foods?: Array<{
          description: string;
          foodNutrients: Array<{ nutrientName: string; value: number }>;
        }>;
      };
      if (!data.foods?.length) return { items: [] };
      const pick = (nutrients: Array<{ nutrientName: string; value: number }>, name: string) =>
        nutrients.find((n) => n.nutrientName === name)?.value ?? null;
      return {
        note: 'Values are per 100g. Scale to the actual portion weight yourself.',
        items: data.foods.slice(0, 3).map((f) => ({
          // Sanitize: strip non-printable-ASCII and clamp length to prevent prompt injection from USDA data.
          name: f.description.replace(/[^\x20-\x7E]/g, '').slice(0, 200),
          per_100g: {
            calories: pick(f.foodNutrients, 'Energy'),
            protein_g: pick(f.foodNutrients, 'Protein'),
            fat_g: pick(f.foodNutrients, 'Total lipid (fat)'),
            carbs_g: pick(f.foodNutrients, 'Carbohydrate, by difference'),
          },
        })),
      };
    }

    case 'search_nutrition_thai':
      // TODO: integrate Mahidol INMU Thai Food Composition DB or Open Food Facts Thai subset.
      return { items: [], note: 'Thai nutrition database not yet integrated' };

    case 'web_search':
      // TODO: integrate Brave Search API or Serper. Set WEB_SEARCH_API_KEY in .env.
      return { results: [], note: 'Web search not yet integrated' };

    // DB stubs — implement once PostgreSQL layer exists.
    default:
      return { stub: true, note: `${block.name}: DB not yet implemented` };
  }
}

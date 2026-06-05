import Anthropic from '@anthropic-ai/sdk';

// FE tools — instruct the frontend to render a component.
// Never add entries at runtime or from user input.
export const FE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'show_dashboard',
    description: 'Instruct the frontend to render the daily calorie and macro overview dashboard.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'show_profile_form',
    description: 'Instruct the frontend to render the onboarding or profile edit form.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'show_food_input',
    description:
      'Instruct the frontend to render the food entry logging screen. Pass prefill when food was identified from text or image so the form is pre-populated.',
    input_schema: {
      type: 'object',
      properties: {
        prefill: {
          type: 'object',
          description:
            'Identified food data to pre-populate the form. Omit if nothing was identified.',
          properties: {
            name: { type: 'string' },
            calories: { type: 'number' },
            protein_g: { type: 'number' },
            fat_g: { type: 'number' },
            carbs_g: { type: 'number' },
            weight_g: { type: 'number' },
            confidence: {
              type: 'string',
              enum: ['exact', 'estimated', 'uncertain'],
              description: 'How reliable the calorie estimate is.',
            },
            source: {
              type: 'string',
              description:
                'Where the data came from: food_library | usda | thai_db | web | llm_estimate',
            },
          },
          required: ['name', 'calories'],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'show_food_log',
    description: 'Instruct the frontend to render the food entry history log.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'show_exercise_input',
    description:
      'Instruct the frontend to render the exercise session logging screen. Pass prefill when exercise was identified from text so the form is pre-populated.',
    input_schema: {
      type: 'object',
      properties: {
        prefill: {
          type: 'object',
          description:
            'Identified exercise data to pre-populate the form. Omit if nothing was identified.',
          properties: {
            name: { type: 'string' },
            duration_min: { type: 'number' },
            calories_burned: { type: 'number' },
            confidence: {
              type: 'string',
              enum: ['exact', 'estimated', 'uncertain'],
            },
            source: {
              type: 'string',
              description: 'Where the data came from: exercise_library | web | llm_estimate',
            },
          },
          required: ['name', 'calories_burned'],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'show_exercise_log',
    description: 'Instruct the frontend to render the exercise history log.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'show_health_summary',
    description: 'Instruct the frontend to render the LLM-generated health narrative summary.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ask_clarification',
    description:
      'Ask the user a targeted follow-up question when input is too ambiguous to act on (e.g. unclear portion, unspecified food, "I ate a lot"). Do not guess — ask instead.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The clarifying question to ask the user.' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional quick-reply choices shown as buttons.',
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
  {
    name: 'display_message',
    description: 'Display a plain text informational message or answer to the user.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The text message to display.' },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
];

// MCP tools — executed server-side by executeMcpTool in agent.service.ts.
// Never add entries at runtime or from user input.
export const MCP_TOOLS: Anthropic.Tool[] = [
  // --- Nutrition lookup chain (try in order until a result is found) ---
  {
    name: 'search_food_library',
    description:
      "Search the user's personal saved food library by name. Always try this first before external APIs.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Food name to search, e.g. "khanom tom"' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_nutrition_usda',
    description:
      'Search USDA FoodData Central for nutrition data. Good for general foods and branded products. Returns values per 100g.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Standardized food name, e.g. "lean beef" or "jasmine rice". Do not include weight here — scale results yourself.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_nutrition_thai',
    description:
      'Search Thai food nutrition database for Thai dishes and ingredients. Use for Thai-specific foods not found in USDA.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Thai dish name in Thai or English, e.g. "ขนมต้ม" or "khanom tom"',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'web_search',
    description:
      'Search the internet for nutrition or calorie information. Use only as a last resort when all databases fail.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query, e.g. "ขนมต้ม calories per piece nutrition"',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  // --- User data (DB) ---
  {
    name: 'get_user_log',
    description:
      "Fetch the user's food and exercise entries. Returns totals (calories_in, calories_burned, net, protein_g). Defaults to today if no date given.",
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Single date in YYYY-MM-DD format.' },
        from: { type: 'string', description: 'Range start date in YYYY-MM-DD format.' },
        to: { type: 'string', description: 'Range end date in YYYY-MM-DD format.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_user_profile',
    description: "Fetch the user's profile: BMR, TDEE, and daily nutrition targets.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'save_food_entry',
    description: 'Save a food consumption entry to the log with a timestamp.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        calories: { type: 'number' },
        protein_g: { type: 'number' },
        fat_g: { type: 'number' },
        carbs_g: { type: 'number' },
        weight_g: { type: 'number' },
        logged_at: {
          type: 'string',
          description: 'ISO 8601 datetime. Defaults to now if omitted.',
        },
      },
      required: ['name', 'calories'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_exercise_entry',
    description: 'Save an exercise session to the log with a timestamp.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        duration_min: { type: 'number' },
        calories_burned: { type: 'number' },
        logged_at: {
          type: 'string',
          description: 'ISO 8601 datetime. Defaults to now if omitted.',
        },
      },
      required: ['name', 'calories_burned'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_to_food_library',
    description:
      "Save a food item definition to the user's personal food library so it can be quickly reused in future logs without going through the full lookup chain.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        default_calories: { type: 'number' },
        default_protein_g: { type: 'number' },
        default_fat_g: { type: 'number' },
        default_carbs_g: { type: 'number' },
        default_weight_g: { type: 'number' },
        source: {
          type: 'string',
          description: 'Where the data originated: usda | thai_db | web | llm_estimate',
        },
      },
      required: ['name', 'default_calories'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_to_exercise_library',
    description:
      "Save an exercise definition to the user's personal exercise library for quick reuse.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        default_calories_per_min: { type: 'number' },
        met_value: {
          type: 'number',
          description: 'Metabolic equivalent value for intensity estimation.',
        },
        source: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_exercise_library',
    description: "Search the user's personal saved exercise library by name.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Exercise name to search, e.g. "running"' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// O(1) lookups. FE_TOOL_NAMES is not used by the 3-tier agent loop (each tier only receives
// its own tool set) but is retained for potential future use — not a security boundary.
export const FE_TOOL_NAMES: Set<string> = new Set(FE_TOOLS.map((t) => t.name));
export const MCP_TOOL_NAMES: Set<string> = new Set(MCP_TOOLS.map((t) => t.name));

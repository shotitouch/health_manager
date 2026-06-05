import { describe, it, expect } from 'vitest';
import { FE_TOOLS, MCP_TOOLS, FE_TOOL_NAMES, MCP_TOOL_NAMES } from '../tool-registry.js';

describe('tool-registry', () => {
  describe('FE_TOOL_NAMES', () => {
    it('matches FE_TOOLS array exactly', () => {
      const fromArray = new Set(FE_TOOLS.map((t) => t.name));
      expect(FE_TOOL_NAMES).toEqual(fromArray);
    });

    it('contains the same count as FE_TOOLS', () => {
      expect(FE_TOOL_NAMES.size).toBe(FE_TOOLS.length);
    });
  });

  describe('MCP_TOOL_NAMES', () => {
    it('matches MCP_TOOLS array exactly', () => {
      const fromArray = new Set(MCP_TOOLS.map((t) => t.name));
      expect(MCP_TOOL_NAMES).toEqual(fromArray);
    });

    it('contains the same count as MCP_TOOLS', () => {
      expect(MCP_TOOL_NAMES.size).toBe(MCP_TOOLS.length);
    });
  });

  describe('namespace collision', () => {
    it('FE and MCP tool names are disjoint', () => {
      const collision = [...FE_TOOL_NAMES].filter((n) => MCP_TOOL_NAMES.has(n));
      expect(collision).toHaveLength(0);
    });
  });

  describe('tool shape', () => {
    it.each([...FE_TOOLS, ...MCP_TOOLS])('$name has required fields', (tool) => {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      expect(tool.input_schema).toBeDefined();
      expect((tool.input_schema as { type: string }).type).toBe('object');
    });
  });

  describe('show_food_input', () => {
    const tool = FE_TOOLS.find((t) => t.name === 'show_food_input')!;
    const schema = tool.input_schema as {
      properties: { prefill?: { required?: string[] } };
      required?: string[];
    };

    it('exists in FE_TOOLS', () => {
      expect(tool).toBeDefined();
    });

    it('prefill is not a top-level required field', () => {
      expect(schema.required ?? []).not.toContain('prefill');
    });

    it('prefill.name and prefill.calories are required within prefill', () => {
      const prefillRequired = schema.properties.prefill?.required ?? [];
      expect(prefillRequired).toContain('name');
      expect(prefillRequired).toContain('calories');
    });
  });

  describe('show_exercise_input', () => {
    const tool = FE_TOOLS.find((t) => t.name === 'show_exercise_input')!;
    const schema = tool.input_schema as {
      properties: { prefill?: { required?: string[] } };
      required?: string[];
    };

    it('prefill.name and prefill.calories_burned are required within prefill', () => {
      const prefillRequired = schema.properties.prefill?.required ?? [];
      expect(prefillRequired).toContain('name');
      expect(prefillRequired).toContain('calories_burned');
    });
  });

  describe('display_message', () => {
    const tool = FE_TOOLS.find((t) => t.name === 'display_message')!;
    const schema = tool.input_schema as { required?: string[] };

    it('message field is required', () => {
      expect(schema.required).toContain('message');
    });
  });
});

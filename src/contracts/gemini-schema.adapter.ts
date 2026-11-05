import { z } from 'zod';

export const GEMINI_SCHEMA_ADAPTER_VERSION = '1.0.0';

export interface GeminiSchema {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
  nullable?: boolean;
}

const UNSUPPORTED_ZOD_TYPES = new Set([
  'function',
  'promise',
  'map',
  'set',
  'lazy',
  'nan',
  'bigint',
  'symbol',
  'never',
  'custom',
  'intersection',
]);

/**
 * Converts a runtime Zod schema into a deterministic, offline-testable Gemini JSON Schema
 * conforming to @google/genai Type specification.
 *
 * Rules:
 * - Preserves required fields and nested array/object hierarchy.
 * - Sorts object properties and required arrays alphabetically for deterministic output.
 * - Explicitly rejects unsupported Zod constructs (functions, maps, sets, promises, etc.).
 * - Unwraps modifiers (optional, default, effects) while maintaining nullability.
 */
export function toGeminiJsonSchema(schema: z.ZodTypeAny): GeminiSchema {
  if (!schema || typeof schema !== 'object') {
    throw new Error('Invalid schema provided to toGeminiJsonSchema');
  }

  const def = (schema as any).def || (schema as any)._def;
  if (!def || !def.type) {
    throw new Error('Unrecognized schema: missing Zod definition type');
  }

  const typeName: string = def.type;

  if (UNSUPPORTED_ZOD_TYPES.has(typeName)) {
    throw new Error(
      `Unsupported Zod construct for Gemini schema conversion: ${typeName}`,
    );
  }

  // Handle Optional modifier
  if (typeName === 'optional') {
    const inner = toGeminiJsonSchema(def.innerType);
    if (schema.description && !inner.description) {
      inner.description = schema.description;
    }
    return inner;
  }

  // Handle Nullable modifier
  if (typeName === 'nullable') {
    const inner = toGeminiJsonSchema(def.innerType);
    inner.nullable = true;
    if (schema.description && !inner.description) {
      inner.description = schema.description;
    }
    return inner;
  }

  // Handle Default modifier
  if (typeName === 'default') {
    const inner = toGeminiJsonSchema(def.innerType);
    if (schema.description && !inner.description) {
      inner.description = schema.description;
    }
    return inner;
  }

  // Handle Effects / Pipe / Transform / Catch
  if (typeName === 'pipe' || typeName === 'transform' || typeName === 'catch') {
    const target = def.in || def.schema || def.innerType;
    if (!target) {
      throw new Error(
        `Unsupported Zod construct for Gemini schema conversion: ${typeName} with unresolvable target`,
      );
    }
    const inner = toGeminiJsonSchema(target);
    if (schema.description && !inner.description) {
      inner.description = schema.description;
    }
    return inner;
  }

  // Primitive: String
  if (typeName === 'string') {
    const result: GeminiSchema = { type: 'STRING' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Primitive: Number or Integer
  if (typeName === 'number' || typeName === 'int') {
    const isInt =
      typeName === 'int' ||
      (Array.isArray(def.checks) &&
        def.checks.some(
          (c: any) =>
            c?.def?.check === 'number_format' && c?.def?.format === 'safeint',
        ));
    const result: GeminiSchema = { type: isInt ? 'INTEGER' : 'NUMBER' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Primitive: Boolean
  if (typeName === 'boolean') {
    const result: GeminiSchema = { type: 'BOOLEAN' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Enum
  if (typeName === 'enum') {
    const entries = (schema as any).options ||
      (def.entries ? Object.keys(def.entries) : []) ||
      [];
    const result: GeminiSchema = {
      type: 'STRING',
      enum: [...entries].sort(),
    };
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Literal
  if (typeName === 'literal') {
    const val = def.value;
    let geminiType: GeminiSchema['type'] = 'STRING';
    if (typeof val === 'number') {
      geminiType = Number.isInteger(val) ? 'INTEGER' : 'NUMBER';
    } else if (typeof val === 'boolean') {
      geminiType = 'BOOLEAN';
    }
    const result: GeminiSchema = {
      type: geminiType,
      enum: [String(val)],
    };
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Array
  if (typeName === 'array') {
    const element = def.element;
    if (!element) {
      throw new Error('ZodArray missing element schema');
    }
    const result: GeminiSchema = {
      type: 'ARRAY',
      items: toGeminiJsonSchema(element),
    };
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Object
  if (typeName === 'object') {
    const shape = (schema as any).shape || def.shape;
    if (!shape || typeof shape !== 'object') {
      throw new Error('ZodObject missing valid shape');
    }

    const properties: Record<string, GeminiSchema> = {};
    const required: string[] = [];

    // Deterministic property traversal: sorted alphabetically
    const keys = Object.keys(shape).sort();

    for (const key of keys) {
      const propSchema = shape[key];
      properties[key] = toGeminiJsonSchema(propSchema);

      const propDef = propSchema.def || propSchema._def;
      const isOptional =
        propDef?.type === 'optional' ||
        propSchema.safeParse(undefined).success === true;

      if (!isOptional) {
        required.push(key);
      }
    }

    const result: GeminiSchema = {
      type: 'OBJECT',
      properties,
    };

    if (required.length > 0) {
      result.required = required.sort();
    }

    if (schema.description) result.description = schema.description;
    return result;
  }

  // Union handling: support nullable/optional unions or enum-like literals
  if (typeName === 'union') {
    const options: z.ZodTypeAny[] = def.options || [];
    // Check if union is nullable or optional wrapper
    const nonNullOptions = options.filter(
      (opt) => {
        const t = (opt.def || (opt as any)._def)?.type;
        return t !== 'null' && t !== 'undefined';
      },
    );

    if (nonNullOptions.length === 1) {
      const inner = toGeminiJsonSchema(nonNullOptions[0]);
      inner.nullable = true;
      if (schema.description && !inner.description) {
        inner.description = schema.description;
      }
      return inner;
    }

    // Check if union of string literals
    const allLiterals = options.every(
      (opt) => (opt.def || (opt as any)._def)?.type === 'literal',
    );
    if (allLiterals && options.length > 0) {
      const enumValues = options
        .map((opt) => String(((opt as any).def || (opt as any)._def)?.value))
        .sort();
      const result: GeminiSchema = {
        type: 'STRING',
        enum: enumValues,
      };
      if (schema.description) result.description = schema.description;
      return result;
    }

    throw new Error(
      `Unsupported Zod construct for Gemini schema conversion: complex union without single representative type`,
    );
  }

  throw new Error(
    `Unsupported Zod construct for Gemini schema conversion: ${typeName}`,
  );
}

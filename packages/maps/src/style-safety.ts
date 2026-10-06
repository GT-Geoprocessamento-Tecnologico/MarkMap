const NULLABLE_NUMERIC_FILTER_LAYERS = new Set([
  "highway-shield-non-us",
  "highway-shield-us-interstate",
  "road_shield_us",
]);

const KNOWN_MISSING_STYLE_IMAGES = new Set([
  "sports_centre",
  "swimming_pool",
  "gate",
  "office",
]);

const NUMERIC_COMPARISON_OPERATORS = new Set(["<", "<=", ">", ">="]);

function isGetExpression(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value[0] === "get" &&
    typeof value[1] === "string"
  );
}

export function sanitizeNullableNumericComparisons(expression: unknown): unknown {
  if (!Array.isArray(expression)) return expression;

  const [operator, left, right] = expression;
  if (
    typeof operator === "string" &&
    NUMERIC_COMPARISON_OPERATORS.has(operator) &&
    expression.length === 3
  ) {
    if (isGetExpression(left) && typeof right === "number") {
      return [
        "case",
        ["!=", left, null],
        [operator, ["to-number", left], right],
        false,
      ];
    }

    if (typeof left === "number" && isGetExpression(right)) {
      return [
        "case",
        ["!=", right, null],
        [operator, left, ["to-number", right]],
        false,
      ];
    }
  }

  return expression.map((item) => sanitizeNullableNumericComparisons(item));
}

export function sanitizeKnownBasemapFilter(
  layerId: string,
  filter: unknown,
): unknown {
  if (!NULLABLE_NUMERIC_FILTER_LAYERS.has(layerId)) return filter;
  return sanitizeNullableNumericComparisons(filter);
}

export function shouldProvideMissingStyleImage(imageId: string): boolean {
  return KNOWN_MISSING_STYLE_IMAGES.has(imageId);
}

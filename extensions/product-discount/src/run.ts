// @ts-check
import {
  DiscountApplicationStrategy,
  RunInput,
  FunctionRunResult,
  Target,
  ProductVariant,
} from "../generated/api";

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * Apply discount to a set of lines (cart lines, product, or collection)
 * @param {object[]} lines - The lines to apply the discount to
 * @param {number} quantityThreshold - The minimum quantity threshold for the discount to apply
 * @param {number} percentage - The percentage discount to apply
 * @returns {Target[]} - The discount targets
 */
function applyDiscountToLines(lines, quantityThreshold, percentage) {
  return lines
    .filter(
      (line) =>
        line.quantity >= quantityThreshold &&
        line.merchandise.__typename === "ProductVariant"
    )
    .map((line) => {
      const variant = line.merchandise as ProductVariant;
      return {
        productVariant: {
          id: variant.id,
        },
      };
    });
}

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input: RunInput): FunctionRunResult {
  // Parse discount configuration from the metafield
  const discountMetafield = input?.discountNode?.metafield;
  if (!discountMetafield) {
    console.error("No discount configuration found in metafields.");
    return EMPTY_DISCOUNT;
  }

  const discountConfig = JSON.parse(discountMetafield.value || "{}");

  if (!discountConfig.quantity || !discountConfig.percentage) {
    console.error("Invalid discount configuration in metafields.");
    return EMPTY_DISCOUNT;
  }

  // Apply discount to cart lines
  const cartTargets: Target[] = applyDiscountToLines(
    input.cart.lines,
    discountConfig.quantity,
    discountConfig.percentage
  );

  // Apply discount to product page if it exists and is of type ProductVariant
  const productTargets: Target[] =
    input.cart.lines[0]?.merchandise?.__typename === "ProductVariant"
      ? applyDiscountToLines(
          [input.cart.lines[0].merchandise],
          discountConfig.quantity,
          discountConfig.percentage
        )
      : [];

  // Apply discount to collection page if it exists and is of type ProductVariant
  const collectionTargets: Target[] =
    input.cart.lines[0]?.merchandise?.__typename === "ProductVariant"
      ? applyDiscountToLines(
          [input.cart.lines[0].merchandise],
          discountConfig.quantity,
          discountConfig.percentage
        )
      : [];

  const targets: Target[] = [
    ...cartTargets,
    ...productTargets,
    ...collectionTargets,
  ];

  if (!targets.length) {
    console.error("No qualifying lines for volume discount.");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets,
        value: {
          percentage: {
            value: discountConfig.percentage.toString(),
          },
        },
      },
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.First,
  };
}

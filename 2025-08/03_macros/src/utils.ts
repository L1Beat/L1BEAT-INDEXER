import type { Macros, Product, Totals } from './types'

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return '0'
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

export function scaleMacros(product: Product, amount: number): Macros {
  const factor = product.mode === 'per100g' ? amount / 100 : amount
  return {
    protein: product.macros.protein * factor,
    fat: product.macros.fat * factor,
    carbs: product.macros.carbs * factor,
    fiber: product.macros.fiber * factor,
  }
}

export function sumTotals(values: Macros[]): Totals {
  const total = values.reduce<Macros>(
    (acc, m) => ({
      protein: acc.protein + m.protein,
      fat: acc.fat + m.fat,
      carbs: acc.carbs + m.carbs,
      fiber: acc.fiber + m.fiber,
    }),
    { protein: 0, fat: 0, carbs: 0, fiber: 0 },
  )
  const kcal = 4 * total.protein + 9 * total.fat + 4 * total.carbs
  return { ...total, kcal }
}


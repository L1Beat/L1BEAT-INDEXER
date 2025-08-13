export type Macros = {
    protein: number
    fat: number
    carbs: number
    fiber: number
}

export type ProductMode = 'per100g' | 'perPortion'

export type Product = {
    id: string
    name: string
    mode: ProductMode
    macros: Macros
    portionLabel?: string
    portionSizeGrams?: number
    createdAt: string
    updatedAt: string
}

export type PlateItem = {
    id: string
    productId: string
    amount: number // grams for per100g, portions for perPortion
}

export type AppState = {
    products: Product[]
    plate: PlateItem[]
    createdAt: string
    updatedAt: string
}

export type Totals = Macros & { kcal: number }

export const STORAGE_KEY = 'macrosTracker.v1'


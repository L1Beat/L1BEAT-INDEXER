import { create } from 'zustand'
import type { AppState, Product } from './types'
import { STORAGE_KEY } from './types'

type Store = AppState & {
    // products
    addProduct: (input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void
    updateProduct: (id: string, update: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>) => void
    deleteProduct: (id: string) => void

    // plate
    addToPlate: (productId: string, amount: number) => void
    updatePlateAmount: (plateItemId: string, amount: number) => void
    removeFromPlate: (plateItemId: string) => void
    clearPlate: () => void
}

const nowIso = () => new Date().toISOString()

function loadInitial(): AppState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            const createdAt = nowIso()
            return { products: [], plate: [], createdAt, updatedAt: createdAt }
        }
        const parsed = JSON.parse(raw) as AppState
        if (!parsed || typeof parsed !== 'object') throw new Error('bad data')
        return {
            products: Array.isArray((parsed as any).products) ? parsed.products : [],
            plate: Array.isArray((parsed as any).plate) ? parsed.plate : [],
            createdAt: typeof (parsed as any).createdAt === 'string' ? parsed.createdAt : nowIso(),
            updatedAt: typeof (parsed as any).updatedAt === 'string' ? parsed.updatedAt : nowIso(),
        }
    } catch {
        const createdAt = nowIso()
        return { products: [], plate: [], createdAt, updatedAt: createdAt }
    }
}

function persist(state: AppState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useStore = create<Store>((set) => ({
    ...loadInitial(),

    addProduct: (input) => {
        const id = crypto.randomUUID()
        const ts = nowIso()
        const product: Product = { id, createdAt: ts, updatedAt: ts, ...input }
        set((s) => {
            const next: AppState = { ...s, products: [product, ...s.products], updatedAt: ts }
            persist(next)
            return next
        })
    },

    updateProduct: (id, update) => {
        const ts = nowIso()
        set((s) => {
            const products = s.products.map((p) => (p.id === id ? { ...p, ...update, updatedAt: ts } : p))
            const next: AppState = { ...s, products, updatedAt: ts }
            persist(next)
            return next
        })
    },

    deleteProduct: (id) => {
        const ts = nowIso()
        set((s) => {
            const products = s.products.filter((p) => p.id !== id)
            const plate = s.plate.filter((pi) => pi.productId !== id)
            const next: AppState = { ...s, products, plate, updatedAt: ts }
            persist(next)
            return next
        })
    },

    addToPlate: (productId, amount) => {
        const ts = nowIso()
        set((s) => {
            const plate = [...s.plate, { id: crypto.randomUUID(), productId, amount }]
            const next: AppState = { ...s, plate, updatedAt: ts }
            persist(next)
            return next
        })
    },

    updatePlateAmount: (plateItemId, amount) => {
        const ts = nowIso()
        set((s) => {
            const plate = s.plate.map((pi) => (pi.id === plateItemId ? { ...pi, amount } : pi))
            const next: AppState = { ...s, plate, updatedAt: ts }
            persist(next)
            return next
        })
    },

    removeFromPlate: (plateItemId) => {
        const ts = nowIso()
        set((s) => {
            const plate = s.plate.filter((pi) => pi.id !== plateItemId)
            const next: AppState = { ...s, plate, updatedAt: ts }
            persist(next)
            return next
        })
    },

    clearPlate: () => {
        const ts = nowIso()
        set((s) => {
            const next: AppState = { ...s, plate: [], updatedAt: ts }
            persist(next)
            return next
        })
    },
}))


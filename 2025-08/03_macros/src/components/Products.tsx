import { useMemo, useState } from 'react'
import type { Product, ProductMode } from '../types'
import { useStore } from '../store'
import { formatNumber } from '../utils'

type Editing =
    | { mode: 'none' }
    | { mode: 'new' }
    | { mode: 'edit'; id: string }

const emptyForm = () => ({
    name: '',
    mode: 'per100g' as ProductMode,
    protein: '',
    fat: '',
    carbs: '',
    fiber: '0',
})

export function Products() {
    const products = useStore((s) => s.products)
    const addProduct = useStore((s) => s.addProduct)
    const updateProduct = useStore((s) => s.updateProduct)
    const deleteProduct = useStore((s) => s.deleteProduct)

    const [editing, setEditing] = useState<Editing>({ mode: 'none' })
    const [form, setForm] = useState(emptyForm())

    const sorted = useMemo(
        () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [products],
    )

    function startNew() {
        setForm(emptyForm())
        setEditing({ mode: 'new' })
    }

    function startEdit(p: Product) {
        setForm({
            name: p.name,
            mode: p.mode,
            protein: String(p.macros.protein),
            fat: String(p.macros.fat),
            carbs: String(p.macros.carbs),
            fiber: '0',
        })
        setEditing({ mode: 'edit', id: p.id })
    }

    function cancel() {
        setEditing({ mode: 'none' })
    }

    function save() {
        const protein = Number(form.protein)
        const fat = Number(form.fat)
        const carbs = Number(form.carbs)
        const fiber = 0
        if (!form.name.trim()) return
        if ([protein, fat, carbs].some((n) => Number.isNaN(n) || n < 0)) return

        if (editing.mode === 'new') {
            addProduct({
                name: form.name.trim(),
                mode: form.mode,
                macros: { protein, fat, carbs, fiber },
            })
        } else if (editing.mode === 'edit') {
            updateProduct(editing.id, {
                name: form.name.trim(),
                mode: form.mode,
                macros: { protein, fat, carbs, fiber },
            })
        }
        setEditing({ mode: 'none' })
    }

    return (
        <div>
            <div className="flex items-center justify-between p-3 border-b">
                <h2 className="text-lg font-bold">Продукты</h2>
                <button
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    onClick={startNew}
                >
                    Добавить
                </button>
            </div>

            {(editing.mode === 'new' || editing.mode === 'edit') && (
                <div className="p-3 bg-gray-50 border-b">
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                className="px-2 py-1.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Название"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                            <select
                                className="px-2 py-1.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                value={form.mode}
                                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as ProductMode }))}
                            >
                                <option value="per100g">на 100 г</option>
                                <option value="perPortion">за порцию</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <NumberInput label="Белки" value={form.protein} onChange={(v) => setForm((f) => ({ ...f, protein: v }))} />
                            <NumberInput label="Жиры" value={form.fat} onChange={(v) => setForm((f) => ({ ...f, fat: v }))} />
                            <NumberInput label="Углеводы" value={form.carbs} onChange={(v) => setForm((f) => ({ ...f, carbs: v }))} />
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                                onClick={save}
                            >
                                Сохранить
                            </button>
                            <button
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                                onClick={cancel}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                {sorted.map((p) => (
                    <div
                        key={p.id}
                        className="px-3 py-2 border-b hover:bg-gray-50 transition-colors group"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{p.name}</div>
                                <div className="text-xs text-gray-600">
                                    <span>{p.mode === 'per100g' ? 'на 100 г' : 'за порцию'}</span>
                                    <span className="mx-1">•</span>
                                    <span>Б: {formatNumber(p.macros.protein)}</span>
                                    <span className="mx-1">•</span>
                                    <span>Ж: {formatNumber(p.macros.fat)}</span>
                                    <span className="mx-1">•</span>
                                    <span>У: {formatNumber(p.macros.carbs)}</span>
                                </div>
                            </div>
                            <div className="shrink-0 flex gap-1">
                                <button
                                    className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 transition-colors"
                                    onClick={() => startEdit(p)}
                                >
                                    Ред.
                                </button>
                                <button
                                    className="px-2 py-1 text-xs bg-white border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                                    onClick={() => {
                                        if (confirm('Удалить продукт?')) deleteProduct(p.id)
                                    }}
                                >
                                    Уд.
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {sorted.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        Пока нет продуктов
                    </div>
                )}
            </div>
        </div>
    )
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs text-gray-700">{label}</label>
            <input
                className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value.replace(/,/g, '.'))}
                placeholder="0"
            />
        </div>
    )
}

export default Products

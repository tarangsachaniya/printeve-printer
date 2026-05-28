'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Product {
  id: string
  name: string
  base_price: number
  selected: boolean
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ items: Product[] }>('/printer/products')
      .then((res) => setProducts(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle(product: Product) {
    setToggling(product.id)
    try {
      if (product.selected) {
        await api.delete(`/printer/products/${product.id}`)
      } else {
        await api.post(`/printer/products/${product.id}`, {})
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, selected: !p.selected } : p))
      )
    } catch {
      // leave state unchanged on error
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <span className="text-sm text-muted-foreground">
          {products.filter((p) => p.selected).length} of {products.length} selected
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground text-center">
            No products available.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Base price: ₹{product.base_price}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {product.selected && (
                    <Badge variant="default" className="text-xs">Active</Badge>
                  )}
                  <Button
                    size="sm"
                    variant={product.selected ? 'outline' : 'default'}
                    disabled={toggling === product.id}
                    onClick={() => toggle(product)}
                  >
                    {toggling === product.id
                      ? '...'
                      : product.selected
                      ? 'Remove'
                      : 'Add'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

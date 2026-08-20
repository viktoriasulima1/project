'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { AddInventoryItemDialog } from './AddInventoryItemDialog';

export interface InventoryRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  purchasePricePerUnit: number | null;
  expiryDate: string | null;
  registrationNumber: string | null;
  isManualEntry: boolean;
  ctgbAuthorisationStatus: string | null;
}

type StockStatus = { label: string; color: string; background: string };

// Priority order matches the urgency a farmer needs to act on: an expired
// product is worse than one merely running low. Mirrors the low-stock/
// expiring-soon logic already used for dashboard alerts (dashboard-data.ts),
// just resolved to a single badge per row instead of a combined alert flag.
function resolveStockStatus(item: InventoryRow): StockStatus | null {
  const now = new Date();
  const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
  if (expiry && expiry < now) {
    return { label: 'Expired', color: 'var(--color-red)', background: 'var(--color-red-subtle)' };
  }
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry && expiry <= in30Days) {
    return { label: 'Expiring soon', color: 'var(--color-amber)', background: 'var(--color-amber-subtle)' };
  }
  if (item.currentStock < item.minimumStock) {
    return { label: 'Low stock', color: 'var(--color-amber)', background: 'var(--color-amber-subtle)' };
  }
  if (item.minimumStock > 0) {
    return { label: 'OK', color: 'var(--color-green)', background: 'var(--color-green-subtle)' };
  }
  return null;
}

export function InventoryClient({ items }: { items: InventoryRow[] }) {
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    setShowDialog(false);
    router.refresh();
  }, [router]);

  return (
    <>
      {showDialog && (
        <AddInventoryItemDialog onClose={() => setShowDialog(false)} onSuccess={handleSuccess} />
      )}

      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
          <Button variant="primary" onClick={() => setShowDialog(true)}>+ Add product</Button>
        </div>

        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Name</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Category</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)' }}>Stock</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)' }}>Price / unit</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Expiry</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = resolveStockStatus(item);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      {item.name}
                      {item.registrationNumber && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', marginLeft: '6px' }}>
                          ({item.registrationNumber})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textTransform: 'capitalize' }}>{item.category}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                      {item.currentStock} {item.unit}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                      {item.purchasePricePerUnit != null ? `€${item.purchasePricePerUnit.toFixed(2)}` : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      {status && (
                        <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '999px', fontSize: 'var(--font-xs)', fontWeight: 500, color: status.color, background: status.background }}>
                          {status.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      {item.isManualEntry ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>Manual / unverified</span>
                      ) : (
                        <span style={{ color: 'var(--color-blue)' }}>
                          Ctgb verified{item.ctgbAuthorisationStatus ? ` · ${item.ctgbAuthorisationStatus}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

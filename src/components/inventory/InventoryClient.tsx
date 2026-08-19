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
  registrationNumber: string | null;
  isManualEntry: boolean;
  ctgbAuthorisationStatus: string | null;
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

        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Name</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Category</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)' }}>Stock</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

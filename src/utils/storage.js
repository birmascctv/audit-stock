export const INITIAL_PRODUCTS = [
  {
    id: 'prod-1',
    no: 1,
    barcode: '8997026800122',
    brand: 'Kulturale',
    varian: 'Lychee',
    qty: 24,
    initialQty: 24,
    capacity: 24,
    minStockAlert: 5,
    price: 35000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    no: 2,
    barcode: '8997026800030',
    brand: 'Kulturale',
    varian: 'Mango',
    qty: 24,
    initialQty: 24,
    capacity: 24,
    minStockAlert: 5,
    price: 35000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    no: 3,
    barcode: '8997026800078',
    brand: 'Kulturale',
    varian: 'Apple',
    qty: 24,
    initialQty: 24,
    capacity: 24,
    minStockAlert: 5,
    price: 35000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    no: 4,
    barcode: '8997026800016',
    brand: 'Kulturale',
    varian: 'Original',
    qty: 24,
    initialQty: 24,
    capacity: 24,
    minStockAlert: 5,
    price: 35000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-5',
    no: 5,
    barcode: '8993156000074',
    brand: 'Albens',
    varian: 'LL Stout',
    qty: 20,
    initialQty: 20,
    capacity: 24,
    minStockAlert: 4,
    price: 45000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-6',
    no: 6,
    barcode: '8993156668267',
    brand: 'Albens',
    varian: 'Amarillo',
    qty: 20,
    initialQty: 20,
    capacity: 24,
    minStockAlert: 4,
    price: 45000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-7',
    no: 7,
    barcode: '8993156668229',
    brand: 'Albens',
    varian: 'Naganini',
    qty: 20,
    initialQty: 20,
    capacity: 24,
    minStockAlert: 4,
    price: 45000,
    updatedAt: new Date().toISOString(),
  },
];

export function formatDateTime(isoString) {
  try {
    const dateObj = new Date(isoString);
    const date = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = dateObj.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const now = Date.now();
    const diffSeconds = Math.floor((now - dateObj.getTime()) / 1000);
    let relative = 'Just now';
    if (diffSeconds > 60 && diffSeconds < 3600) {
      relative = `${Math.floor(diffSeconds / 60)}m ago`;
    } else if (diffSeconds >= 3600 && diffSeconds < 86400) {
      relative = `${Math.floor(diffSeconds / 3600)}h ago`;
    } else if (diffSeconds >= 86400) {
      relative = `${Math.floor(diffSeconds / 86400)}d ago`;
    }

    return { date, time, full: `${date} ${time}`, relative };
  } catch {
    return { date: '', time: '', full: isoString, relative: '' };
  }
}

export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

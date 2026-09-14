/* -------------------------------------------------------------
   VMP Studio Contable - Libro IVA Digital View Component
   ------------------------------------------------------------- */
import { getActiveCompany, getTransactions } from '../db/mockdb.js';

export function renderIVA() {
  const activeCompany = getActiveCompany();
  const txs = getTransactions(activeCompany.id);
  const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';

  const periodNames = {
    '2026-05': 'Mayo 2026',
    '2026-04': 'Abril 2026',
    '2026-03': 'Marzo 2026',
    '2026-02': 'Febrero 2026',
    '2026-01': 'Enero 2026',
    '2025-12': 'Diciembre 2025'
  };

  // Filtrar transacciones por período fiscal activo
  const filteredVentas = txs.ventas.filter(v => v.fecha.startsWith(activePeriod));
  const filteredCompras = txs.compras.filter(c => c.fecha.startsWith(activePeriod));

  // Calcular totales impositivos
  const totalNetSalesGravadas = filteredVentas.filter(v => !v.exento).reduce((sum, v) => sum + v.neto, 0);
  const totalNetSalesExentas = filteredVentas.filter(v => v.exento).reduce((sum, v) => sum + v.neto, 0);
  const totalNetSales = totalNetSalesGravadas + totalNetSalesExentas;
  const totalIvaSales = filteredVentas.reduce((sum, v) => sum + v.iva, 0);
  const totalSales = filteredVentas.reduce((sum, v) => sum + v.total, 0);

  const totalNetPurchases = filteredCompras.reduce((sum, c) => sum + c.neto, 0);
  // 1) Se excluye el crédito de proveedores con CUIT no habilitado/inactivo en ARCA.
  const creditoFiscalHabilitado = filteredCompras.reduce((sum, c) => {
    const cleanCuit = c.cuit.replace(/[^0-9]/g, '');
    if (cleanCuit.endsWith('9')) return sum;
    return sum + c.iva;
  }, 0);
  // 2) Prorrateo del crédito fiscal de uso común (Art. 13 Ley de IVA): cuando hay
  // ventas gravadas Y exentas, el crédito de gastos no atribuibles a una sola
  // actividad se reconoce solo en la proporción de ventas gravadas sobre el total.
  const prorrateoGravado = totalNetSales > 0 ? (totalNetSalesGravadas / totalNetSales) : 1;
  const totalIvaPurchases = Math.round(creditoFiscalHabilitado * prorrateoGravado * 100) / 100;
  const totalPurchases = filteredCompras.reduce((sum, c) => sum + c.total, 0);

  const balance = totalIvaSales - totalIvaPurchases;

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Libro IVA Digital</h1>
      <p class="view-subtitle">Liquidación mensual de IVA, débitos y créditos fiscales.</p>
    </div>
    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
      <button class="btn btn-outline" id="btn-export-excel-iva" style="border-color: var(--color-accent-light); color: var(--color-accent-light); display: flex; align-items: center; gap: 6px;">
        <i data-lucide="file-spreadsheet"></i> Exportar Excel (CSV)
      </button>
      <button class="btn btn-outline" id="btn-print-iva" style="display: flex; align-items: center; gap: 6px;">
        <i data-lucide="printer"></i> Imprimir PDF
      </button>
      <button class="btn btn-primary" id="btn-show-arca-exports" style="display: flex; align-items: center; gap: 6px;">
        <i data-lucide="download"></i> Exportar ARCA
      </button>
    </div>
  </div>

  <!-- Exports Panel (Collapsible/Hidden by default) -->
  <div class="card" id="arca-exports-panel" style="display: none; margin-bottom: 32px; border-color: var(--color-indigo);">
    <div class="card-header" style="background: rgba(22,163,74,0.02)">
      <h3 style="color:var(--color-accent-light)"><i data-lucide="share-2"></i> Generación de Archivos de Importación ARCA (Libro IVA Digital)</h3>
      <button class="btn-icon-sm" id="btn-close-exports" title="Cerrar"><i data-lucide="x"></i></button>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size: 13.5px; margin-bottom: 20px;">
        Descargá los archivos de texto delimitados oficiales para subirlos directamente al portal de <strong>ARCA (Libro IVA Digital / IVA Simple F.2051)</strong> sin tipear una sola factura manualmente.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <i data-lucide="file-text" style="width: 32px; height: 32px; color: var(--color-teal-light); margin-bottom: 12px; margin-inline: auto;"></i>
            <h4 style="font-size: 13.5px; margin-bottom: 6px;">RE.CO. Ventas (Comprobantes)</h4>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">Cabeceras de todas tus facturas de venta emitidas.</p>
          </div>
          <button class="btn btn-outline btn-sm w-full" id="btn-export-ventas-txt">Descargar TXT</button>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <i data-lucide="percent" style="width: 32px; height: 32px; color: var(--color-teal-light); margin-bottom: 12px; margin-inline: auto;"></i>
            <h4 style="font-size: 13.5px; margin-bottom: 6px;">RE.CO. Ventas (Alícuotas)</h4>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">Detalle de alícuotas (21%, 10.5%, exento) de ventas.</p>
          </div>
          <button class="btn btn-outline btn-sm w-full" id="btn-export-ventas-ali-txt">Descargar TXT</button>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <i data-lucide="file-spreadsheet" style="width: 32px; height: 32px; color: #fbbf24; margin-bottom: 12px; margin-inline: auto;"></i>
            <h4 style="font-size: 13.5px; margin-bottom: 6px;">RE.CO. Compras (Comprobantes)</h4>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">Cabeceras de facturas de compra recibidas del período.</p>
          </div>
          <button class="btn btn-outline btn-sm w-full" id="btn-export-compras-txt" style="border-color:#fbbf24; color:#fbbf24;">Descargar TXT</button>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <i data-lucide="calculator" style="width: 32px; height: 32px; color: #fbbf24; margin-bottom: 12px; margin-inline: auto;"></i>
            <h4 style="font-size: 13.5px; margin-bottom: 6px;">RE.CO. Compras (Alícuotas)</h4>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">Desglose de IVA alícuotas para crédito fiscal compras.</p>
          </div>
          <button class="btn btn-outline btn-sm w-full" id="btn-export-compras-ali-txt" style="border-color:#fbbf24; color:#fbbf24;">Descargar TXT</button>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <i data-lucide="file-check-2" style="width: 32px; height: 32px; color: var(--color-accent-light); margin-bottom: 12px; margin-inline: auto;"></i>
            <h4 style="font-size: 13.5px; margin-bottom: 6px;">F. 2051 Borrador (PDF)</h4>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">Pre-declaración consolidada borrador de actividad.</p>
          </div>
          <button class="btn btn-outline btn-sm w-full" id="btn-export-borrador-pdf">Descargar PDF</button>
        </div>
      </div>
    </div>
  </div>

  <!-- VAT Consolidated Summary -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
    <!-- Sales (Debit) -->
    <div class="card" style="border-left: 4px solid var(--color-emerald)">
      <div class="card-header">
        <h3><i data-lucide="trending-up" class="text-emerald"></i> Resumen de Ventas (Débito Fiscal)</h3>
      </div>
      <div class="card-body" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span class="text-secondary">Total Neto Gravado:</span>
          <span class="font-mono" style="font-weight: 600;">$ ${totalNetSalesGravadas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ${totalNetSalesExentas > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span class="text-secondary">Total Neto Exento (Art. 7 Ley IVA):</span>
          <span class="font-mono" style="font-weight: 600; color: #94a3b8;">$ ${totalNetSalesExentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span class="text-secondary">IVA Débito Fiscal:</span>
          <span class="font-mono" style="font-weight: 600;">$ ${totalIvaSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 700;">
          <span>Total Facturado Ventas:</span>
          <span class="font-mono text-emerald">$ ${totalSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>

    <!-- Purchases (Credit) -->
    <div class="card" style="border-left: 4px solid #ef4444">
      <div class="card-header">
        <h3><i data-lucide="shopping-bag" class="text-red"></i> Resumen de Compras (Crédito Fiscal)</h3>
      </div>
      <div class="card-body" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span class="text-secondary">Total Neto Gravado:</span>
          <span class="font-mono" style="font-weight: 600;">$ ${totalNetPurchases.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ${totalNetSalesExentas > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span class="text-secondary">Crédito habilitado (antes de prorratear):</span>
          <span class="font-mono" style="color: #94a3b8;">$ ${creditoFiscalHabilitado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span class="text-secondary">Prorrateo por ventas exentas (Art. 13):</span>
          <span class="font-mono" style="color: #94a3b8;">× ${(prorrateoGravado * 100).toFixed(1)}%</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span class="text-secondary">IVA Crédito Fiscal:</span>
          <span class="font-mono" style="font-weight: 600;">$ ${totalIvaPurchases.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 700;">
          <span>Total Facturado Compras:</span>
          <span class="font-mono">$ ${totalPurchases.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Settlement Summary Banner -->
  <div class="card" style="background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-md); padding: 24px; margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <div style="width: 48px; height: 48px; background: rgba(245, 158, 11, 0.08); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fbbf24;">
        <i data-lucide="calculator" style="width: 24px; height: 24px;"></i>
      </div>
      <div>
        <h4 style="font-size: 16px; font-weight: 700; color: #fbbf24;">
          Liquidación de IVA - ${periodNames[activePeriod]}
        </h4>
        <p class="text-secondary" style="font-size: 13px; margin-top: 4px;">
          ${balance >= 0 
            ? 'Resultado: Saldo a pagar al fisco por diferencia de débito sobre crédito.' 
            : 'Resultado: Saldo técnico a favor del contribuyente acumulable para el próximo período.'}
        </p>
      </div>
    </div>
    <div style="text-align: right;">
      <div class="text-secondary" style="font-size: 11px; font-weight: 600; text-transform: uppercase;">Saldo de IVA Neto</div>
      <div class="font-mono" style="font-size: 28px; font-weight: 800; color: ${balance >= 0 ? '#fbbf24' : 'var(--color-emerald-light)'}">
        $ ${Math.abs(balance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </div>
    </div>
  </div>

  <!-- VAT Ledger Book Tabs -->
  <div class="card">
    <div class="card-header">
      <h3><i data-lucide="book-open"></i> Subdiario de Comprobantes Consolidados</h3>
      <span class="badge" style="margin: 0; font-size: 11px;">Período: ${periodNames[activePeriod]}</span>
    </div>
    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Número</th>
              <th>Cliente / Proveedor</th>
              <th>CUIT</th>
              <th class="text-right">Neto</th>
              <th class="text-right">IVA DF</th>
              <th class="text-right">IVA CF</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filteredVentas.length === 0 && filteredCompras.length === 0 ? `
              <tr>
                <td colspan="9" class="text-center text-muted" style="padding: 32px;">No hay transacciones registradas en este período.</td>
              </tr>
            ` : [
              ...filteredVentas.map(v => ({ ...v, type: 'venta', df: v.iva, cf: 0 })),
              ...filteredCompras.map(c => {
                const cleanCuit = c.cuit.replace(/[^0-9]/g, '');
                const isInactive = cleanCuit.endsWith('9');
                return { ...c, type: 'compra', df: 0, cf: isInactive ? 0 : c.iva, isCuitInactive: isInactive };
              })
            ].sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).map(item => `
              <tr>
                <td class="font-mono text-sm">${item.fecha.split('-').reverse().join('/')}</td>
                <td>
                  <span class="badge-status ${item.type === 'venta' ? 'active' : 'pending'}" style="font-size: 10px; padding: 1px 6px;">
                    ${item.tipo_comprobante}
                  </span>
                </td>
                <td class="font-mono text-xs">${item.numero}</td>
                <td style="font-weight: 600; font-size: 12.5px;">
                  <div>${item.cliente || item.proveedor}</div>
                  ${item.es_activo ? `
                    <span style="font-size: 8px; font-weight: 700; color: var(--color-accent-light); background: rgba(22, 163, 74, 0.08); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(22, 163, 74, 0.2); display: inline-flex; align-items: center; gap: 2px; margin-top: 2px;">
                      <i data-lucide="building" style="width: 8px; height: 8px;"></i> BIEN DE USO
                    </span>
                  ` : ''}
                </td>
                <td class="font-mono text-xs" style="color: var(--text-secondary);">
                  <div>${item.cuit}</div>
                  ${item.isCuitInactive ? `
                    <span title="La CUIT del emisor está inactiva en ARCA. El crédito fiscal no es computable." style="font-size: 8px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.06); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(245,158,11,0.2); display: inline-flex; align-items: center; gap: 2px; margin-top: 2px; cursor: help;">
                      <i data-lucide="shield-alert" style="width: 8px; height: 8px;"></i> INACTIVA
                    </span>
                  ` : ''}
                </td>
                <td class="font-mono text-right text-sm">$ ${item.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td class="font-mono text-right text-sm text-emerald">${item.df > 0 ? '$ ' + item.df.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : `<span title="Esta operación es una compra: no genera Débito Fiscal para tu empresa, solo Crédito Fiscal." style="cursor:help; text-decoration:underline dashed; text-decoration-color: var(--text-muted);">—</span>`}</td>
                <td class="font-mono text-right text-sm text-red">
                  ${item.cf > 0
                    ? '$ ' + item.cf.toLocaleString('es-AR', { minimumFractionDigits: 2 })
                    : item.isCuitInactive
                      ? `<span style="text-decoration:line-through;color:var(--text-muted);" title="Originalmente $ ${item.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}. Excluido por CUIT Inactiva.">$ ${item.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span> <span style="font-size:9.5px;color:#f59e0b;display:block;">$ 0,00</span>`
                      : `<span title="Esta operación es una venta: no genera Crédito Fiscal para tu empresa, solo Débito Fiscal." style="cursor:help; text-decoration:underline dashed; text-decoration-color: var(--text-muted);">—</span>`}
                </td>
                <td class="font-mono text-right text-sm" style="font-weight: 700;">$ ${item.total.toLocaleString('es-AR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

export function initIVA(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const activeCompany = getActiveCompany();

  const expPanel = document.getElementById('arca-exports-panel');
  const btnShowExp = document.getElementById('btn-show-arca-exports');
  const btnCloseExp = document.getElementById('btn-close-exports');

  const btnPrint = document.getElementById('btn-print-iva');

  // Print function
  btnPrint?.addEventListener('click', () => {
    window.print();
  });

  // Export to Excel (CSV)
  const btnExcel = document.getElementById('btn-export-excel-iva');
  btnExcel?.addEventListener('click', () => {
    const txs = getTransactions(activeCompany.id);
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    const filteredVentas = txs.ventas.filter(v => v.fecha.startsWith(activePeriod));
    const filteredCompras = txs.compras.filter(c => c.fecha.startsWith(activePeriod));

    const combined = [
      ...filteredVentas.map(v => ({ ...v, type: 'VENTA', ent: v.cliente, df: v.iva, cf: 0 })),
      ...filteredCompras.map(c => ({ ...c, type: 'COMPRA', ent: c.proveedor, df: 0, cf: c.iva }))
    ].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    if (combined.length === 0) {
      mainApp.showToast('No hay transacciones registradas en este período.', 'error');
      return;
    }

    // CSV format separated by semicolon with UTF-8 BOM so Excel opens it perfectly in Spanish locale
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Fecha;Tipo Operacion;Tipo Comprobante;Numero;Cliente/Proveedor;CUIT;Neto Gravado;IVA Debito;IVA Credito;Total Facturado\r\n";

    combined.forEach(item => {
      const date = item.fecha.split('-').reverse().join('/');
      const name = (item.ent || '').replace(/;/g, ',');
      csvContent += `${date};${item.type};${item.tipo_comprobante};${item.numero};${name};${item.cuit};${item.neto.toFixed(2)};${item.df.toFixed(2)};${item.cf.toFixed(2)};${item.total.toFixed(2)}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `libro_iva_${activeCompany.razon_social.toLowerCase().replace(/ /g, '_')}_${activePeriod}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    mainApp.showToast('¡Libro de IVA exportado a Excel (CSV) con éxito!', 'success');
  });

  // Toggle exports
  btnShowExp?.addEventListener('click', () => {
    expPanel.style.display = 'block';
  });

  btnCloseExp?.addEventListener('click', () => {
    expPanel.style.display = 'none';
  });

  // Text files downloads helper
  const downloadTXT = (filename, text) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // RE.CO. Ventas (Comprobantes) TXT structure simulation
  document.getElementById('btn-export-ventas-txt')?.addEventListener('click', () => {
    const txs = getTransactions(activeCompany.id).ventas;
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    const filteredVentas = txs.filter(v => v.fecha.startsWith(activePeriod));

    if (filteredVentas.length === 0) {
      mainApp.showToast('No hay ventas registradas en este período para exportar.', 'error');
      return;
    }

    let output = "";
    filteredVentas.forEach(v => {
      const dateStr = v.fecha.replace(/-/g, ''); // AAAAMMDD
      const typeCode = v.tipo_comprobante.includes('A') ? '001' : '006';
      const pv = v.numero.split('-')[0].padStart(5, '0');
      const num = v.numero.split('-')[1].padStart(8, '0');
      const docType = v.cuit.startsWith('00') ? '99' : '80'; // CUIT o Sin identificar
      const cleanCuit = v.cuit.replace(/-/g, '').padEnd(11, '0');
      const name = v.cliente.padEnd(30, ' ').substring(0, 30);
      const totalStr = Math.round(v.total * 100).toString().padStart(15, '0');
      
      output += `${dateStr}${typeCode}${pv}${num}${num}${docType}${cleanCuit}${name}${totalStr}\r\n`;
    });

    downloadTXT(`arca-ventas-comprobantes-${activeCompany.razon_social.toLowerCase().replace(/ /g, '-')}-${activePeriod}.txt`, output);
    mainApp.showToast('¡Archivo de Comprobantes descargado con éxito!', 'success');
  });

  // RE.CO. Ventas (Alícuotas) TXT structure simulation
  document.getElementById('btn-export-ventas-ali-txt')?.addEventListener('click', () => {
    const txs = getTransactions(activeCompany.id).ventas;
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    const filteredVentas = txs.filter(v => v.fecha.startsWith(activePeriod));

    if (filteredVentas.length === 0) {
      mainApp.showToast('No hay ventas registradas en este período para exportar.', 'error');
      return;
    }

    let output = "";
    filteredVentas.forEach(v => {
      const typeCode = v.tipo_comprobante.includes('A') ? '001' : '006';
      const pv = v.numero.split('-')[0].padStart(5, '0');
      const num = v.numero.split('-')[1].padStart(8, '0');
      const netStr = Math.round(v.neto * 100).toString().padStart(15, '0');
      // Código de alícuota real según la relación IVA/Neto de cada venta
      // (RG 3685): 0003 exento/no gravado, 0004 10,5%, 0005 21%, 0006 27%.
      let ivaCode = '0005';
      const aliquotRatio = v.neto > 0 ? (v.iva / v.neto) : 0;
      if (v.iva === 0) ivaCode = '0003';
      else if (Math.abs(aliquotRatio - 0.105) < 0.02) ivaCode = '0004';
      else if (Math.abs(aliquotRatio - 0.27) < 0.02) ivaCode = '0006';
      const ivaStr = Math.round(v.iva * 100).toString().padStart(15, '0');
      
      output += `${typeCode}${pv}${num}${netStr}${ivaCode}${ivaStr}\r\n`;
    });

    downloadTXT(`arca-ventas-alicuotas-${activeCompany.razon_social.toLowerCase().replace(/ /g, '-')}-${activePeriod}.txt`, output);
    mainApp.showToast('¡Archivo de Alícuotas descargado con éxito!', 'success');
  });

  // RE.CO. Compras (Comprobantes) TXT structure simulation
  document.getElementById('btn-export-compras-txt')?.addEventListener('click', () => {
    const txs = getTransactions(activeCompany.id).compras;
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    const filteredCompras = txs.filter(c => c.fecha.startsWith(activePeriod));

    if (filteredCompras.length === 0) {
      mainApp.showToast('No hay compras registradas en este período para exportar.', 'error');
      return;
    }

    let output = "";
    filteredCompras.forEach(c => {
      const dateStr = c.fecha.replace(/-/g, ''); // AAAAMMDD
      const typeCode = c.tipo_comprobante.includes('A') ? '001' : (c.tipo_comprobante.includes('B') ? '006' : '011');
      const pv = c.numero.split('-')[0].padStart(5, '0');
      const num = c.numero.split('-')[1].padStart(20, '0');
      const docType = '80'; // CUIT
      const cleanCuit = c.cuit.replace(/-/g, '').padStart(20, '0');
      const name = (c.proveedor || '').padEnd(30, ' ').substring(0, 30);
      const totalStr = Math.round(c.total * 100).toString().padStart(15, '0');
      const zeroField = "".padStart(15, '0');
      const currency = 'PES';
      const exchangeRate = '0001000000'; // 1.000000 (10 chars)
      const countAli = '1';
      const compIva = Math.round(c.iva * 100).toString().padStart(15, '0');
      
      output += `${dateStr}${typeCode}${pv}${num}${"".padStart(16, ' ')}${docType}${cleanCuit}${name}${totalStr}${zeroField}${zeroField}${zeroField}${zeroField}${zeroField}${zeroField}${zeroField}${currency}${exchangeRate}${countAli}${" "}${compIva}${zeroField}\r\n`;
    });

    downloadTXT(`arca-compras-comprobantes-${activeCompany.razon_social.toLowerCase().replace(/ /g, '-')}-${activePeriod}.txt`, output);
    mainApp.showToast('¡Libro de Compras (Comprobantes) descargado con éxito!', 'success');
  });

  // RE.CO. Compras (Alícuotas) TXT structure simulation
  document.getElementById('btn-export-compras-ali-txt')?.addEventListener('click', () => {
    const txs = getTransactions(activeCompany.id).compras;
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    const filteredCompras = txs.filter(c => c.fecha.startsWith(activePeriod));

    if (filteredCompras.length === 0) {
      mainApp.showToast('No hay compras registradas en este período para exportar.', 'error');
      return;
    }

    let output = "";
    filteredCompras.forEach(c => {
      const typeCode = c.tipo_comprobante.includes('A') ? '001' : (c.tipo_comprobante.includes('B') ? '006' : '011');
      const pv = c.numero.split('-')[0].padStart(5, '0');
      const num = c.numero.split('-')[1].padStart(20, '0');
      const docType = '80'; // CUIT
      const cleanCuit = c.cuit.replace(/-/g, '').padStart(20, '0');
      const netStr = Math.round(c.neto * 100).toString().padStart(15, '0');
      
      let ivaCode = '0005'; // 21%
      if (c.iva === 0) ivaCode = '0003';
      else if (Math.abs((c.iva / c.neto) - 0.105) < 0.02) ivaCode = '0004';
      else if (Math.abs((c.iva / c.neto) - 0.27) < 0.02) ivaCode = '0006';

      const ivaStr = Math.round(c.iva * 100).toString().padStart(15, '0');
      
      output += `${typeCode}${pv}${num}${docType}${cleanCuit}${netStr}${ivaCode}${ivaStr}\r\n`;
    });

    downloadTXT(`arca-compras-alicuotas-${activeCompany.razon_social.toLowerCase().replace(/ /g, '-')}-${activePeriod}.txt`, output);
    mainApp.showToast('¡Libro de Compras (Alícuotas) descargado con éxito!', 'success');
  });

  // Mock borrador PDF download
  document.getElementById('btn-export-borrador-pdf')?.addEventListener('click', () => {
    mainApp.showToast('Generando formulario F. 2002 interactivo...', 'info');
    setTimeout(() => {
      window.print();
    }, 1000);
  });
}

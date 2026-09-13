/* -------------------------------------------------------------
   VMP Studio Contable - WhatsApp Omnichannel Inbox View
   Pilar 2: Omnicanalidad y AI-OCR (Gemini Vision)
   ------------------------------------------------------------- */
import { getActiveCompany, addTransaction } from '../db/mockdb.js';

let activeChatId = 'co-1'; // Default active chat
let scanState = 'idle'; // 'idle' | 'scanning' | 'scanned' | 'registered'
let extractedData = null;

export function renderWhatsApp() {
  const activeCompany = getActiveCompany();

  const unreadCounts = JSON.parse(localStorage.getItem('vmp_wa_unread_counts') || '{"co-1": 1, "co-2": 0, "co-3": 0}');
  if (unreadCounts[activeChatId] > 0) {
    unreadCounts[activeChatId] = 0;
    localStorage.setItem('vmp_wa_unread_counts', JSON.stringify(unreadCounts));
  }

  // Mock chats list
  const chats = [
    { id: 'co-1', name: 'Transportes Patagónicos S.A.', lastMsg: 'Te paso el ticket del camión...', time: '11:42', avatar: '#0d9488', count: unreadCounts['co-1'] },
    { id: 'co-2', name: 'TecnoDesarrollos Sur', lastMsg: 'Matias, ¿viste la recategorización?', time: 'Ayer', avatar: '#8A6D3B', count: unreadCounts['co-2'] },
    { id: 'co-3', name: 'Alimentos del Valle S.R.L.', lastMsg: 'Factura de luz cargada.', time: 'Ayer', avatar: '#1F5C43', count: unreadCounts['co-3'] }
  ];

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  // Define chat history based on active chat
  let chatHistoryHTML = '';
  if (activeChatId === 'co-1') {
    chatHistoryHTML = `
      <div class="chat-msg client">
        <div class="msg-bubble">
          <p>Hola Matías! Te paso la foto de la factura de la nueva maquinaria que compramos para la sucursal. Avisame si pudimos meterla en el ejercicio de este mes.</p>
          <span class="msg-time">11:38 AM</span>
        </div>
      </div>
      <div class="chat-msg client">
        <div class="msg-bubble attachment-bubble">
          <div class="file-attachment-card">
            <div class="fa-icon"><i data-lucide="image"></i></div>
            <div class="fa-details">
              <span class="fa-name">COMPRA_MAQUINARIA_AUTOMATICA.jpg</span>
              <span class="fa-size">3.4 MB · Imagen de Cámara</span>
            </div>
          </div>
          ${renderOCRScannerPanel()}
          <span class="msg-time">11:39 AM</span>
        </div>
      </div>
    `;
  } else if (activeChatId === 'co-2') {
    chatHistoryHTML = `
      <div class="chat-msg client">
        <div class="msg-bubble">
          <p>Hola! Che, ¿cómo vengo con el límite del Monotributo? Facturé una consultoría grande ayer y tengo miedo de pasarme de la categoría H.</p>
          <span class="msg-time">Ayer</span>
        </div>
      </div>
      <div class="chat-msg system">
        <div class="msg-bubble">
          <p><strong>💡 AI Auto-Response:</strong> Hola. Según las facturas del período actual, has consumido un 85% de la Categoría H. Te quedan $5.200.000 antes del límite legal de exclusión de $ 35.000.000.</p>
          <span class="msg-time">Ayer · Bot</span>
        </div>
      </div>
    `;
  } else {
    chatHistoryHTML = `
      <div class="chat-msg client">
        <div class="msg-bubble">
          <p>Buenas, te dejé cargada la factura de luz en el portal. Confirmame si está todo bien.</p>
          <span class="msg-time">Ayer</span>
        </div>
      </div>
      <div class="chat-msg agent">
        <div class="msg-bubble">
          <p>Hola! Sí, la pudimos ver y conciliar contra el extracto del Banco Nación. Ya quedó registrada en el Libro IVA Compras del mes.</p>
          <span class="msg-time">Ayer</span>
        </div>
      </div>
    `;
  }

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Inbox de WhatsApp Omnicanal</h1>
      <p class="view-subtitle">Ecosistema WhatsApp-First. Recibí comprobantes de tus clientes y delegalos a IA-OCR en tiempo real.</p>
    </div>
    <div style="background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #25d366; display: flex; align-items: center; gap: 6px;">
      <span style="background: #25d366; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px #25d366;"></span> WhatsApp Gateway Activo
    </div>
  </div>

  <div class="whatsapp-layout-card" style="display: grid; grid-template-columns: 320px 1fr; background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); min-height: 600px;">
    
    <!-- Left Sidebar: Chat List -->
    <div class="wa-sidebar" style="border-right: 1px solid var(--border-color); display: flex; flex-direction: column;">
      <div style="padding: 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);">
        <div style="position: relative;">
          <input type="text" placeholder="Buscar conversación..." style="width: 100%; padding: 8px 12px 8px 32px; font-size: 12.5px; border-radius: 6px; border: 1px solid var(--border-color); background: #fff; outline: none;">
          <i data-lucide="search" style="position: absolute; left: 10px; top: 9px; width: 14px; height: 14px; color: var(--text-secondary);"></i>
        </div>
      </div>

      <div class="wa-chats-container" style="flex-grow: 1; overflow-y: auto;">
        ${chats.map(c => `
          <div class="wa-chat-item ${c.id === activeChatId ? 'active' : ''}" data-id="${c.id}" style="padding: 14px 16px; border-bottom: 1px solid rgba(0,0,0,0.04); display: flex; gap: 12px; cursor: pointer; transition: background 0.2s;">
            <div style="background: ${c.avatar}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0; font-size: 14px;">
              ${c.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
            </div>
            <div style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                <span style="font-size: 12.5px; font-weight: 700; color: var(--color-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">${c.name}</span>
                <span style="font-size: 10px; color: var(--text-muted);">${c.time}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${c.lastMsg}</span>
                ${c.count > 0 ? `<span style="background: #25d366; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; min-width: 18px; text-align: center;">${c.count}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Right Chat Window -->
    <div class="wa-chat-window" style="display: flex; flex-direction: column; background: #efeae2; position: relative;">
      
      <!-- Chat Header -->
      <div class="chat-header" style="padding: 10px 20px; background: #fff; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; z-index: 10;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: ${activeChat.avatar}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 13px;">
            ${activeChat.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
          </div>
          <div>
            <h4 style="font-size: 13.5px; font-weight: 750; color: var(--color-primary); margin: 0;">${activeChat.name}</h4>
            <span style="font-size: 10.5px; color: var(--color-teal-light); font-weight: 600;">Ecosistema Sincronizado</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-outline btn-sm" onclick="alert('Historial impositivo sincronizado con ARCA')" style="font-size: 11px; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-color: rgba(31,92,67,0.25);">
            <i data-lucide="history" style="width: 13px; height: 13px;"></i> Auditoría
          </button>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="chat-messages-container" style="flex-grow: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
        ${chatHistoryHTML}
      </div>

      <!-- Bottom Chat Bar -->
      <div class="chat-footer-bar" style="padding: 12px 20px; background: #f0f0f0; display: flex; align-items: center; gap: 12px; border-top: 1px solid var(--border-color);">
        <button class="btn-icon-sm" style="color: var(--text-secondary); background: transparent; border: none; cursor: pointer;"><i data-lucide="paperclip"></i></button>
        <div style="flex-grow: 1; position: relative;">
          <input type="text" placeholder="Escribe un mensaje de WhatsApp..." style="width: 100%; padding: 10px 16px; border-radius: 20px; border: none; background: #fff; outline: none; font-size: 13px;" disabled value="${scanState === 'registered' ? 'La factura ha sido procesada e ingresada automáticamente.' : ''}">
        </div>
        <button class="btn-primary" style="background: #25d366; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer;"><i data-lucide="send" style="width: 16px; height: 16px;"></i></button>
      </div>

    </div>

  </div>
  `;
}

function renderOCRScannerPanel() {
  if (scanState === 'idle') {
    return `
      <div style="margin-top: 12px; border: 1px dashed rgba(31, 92, 67, 0.3); border-radius: 6px; background: rgba(31, 92, 67, 0.02); padding: 12px; text-align: center;">
        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 8px 0;">📎 Se ha detectado un comprobante de compras en este chat.</p>
        <button class="btn btn-primary btn-sm" id="btn-start-ocr" style="background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; padding: 8px;">
          <i data-lucide="scan"></i> Procesar con AI-OCR (Gemini)
        </button>
      </div>
    `;
  }

  if (scanState === 'scanning') {
    return `
      <div style="margin-top: 12px; border: 1px solid rgba(31, 92, 67, 0.2); border-radius: 6px; background: rgba(31, 92, 67, 0.04); padding: 16px; text-align: center; position: relative; overflow: hidden;">
        <!-- Laser Scanning Bar Animation -->
        <div class="ocr-scanner-laser" style="position: absolute; left: 0; right: 0; top: 0; height: 3px; background: var(--color-accent); box-shadow: 0 0 8px var(--color-accent); animation: scanLaser 1.5s ease-in-out infinite;"></div>
        
        <i data-lucide="loader" class="spin" style="width: 24px; height: 24px; color: var(--color-accent); margin: 0 auto 10px auto; display: block; animation: spin 1s linear infinite;"></i>
        <h5 style="font-size: 12.5px; color: var(--color-primary); font-weight: 750; margin: 0 0 4px 0;">Escaneando documento impositivo</h5>
        <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">Extrayendo CUIT, fecha, montos y alícuotas con Gemini Pro Vision...</p>
      </div>
    `;
  }

  if (scanState === 'scanned') {
    return `
      <div style="margin-top: 12px; border: 1px solid var(--color-accent-light); border-radius: 6px; background: rgba(47, 122, 89, 0.02); padding: 16px;">
        <div style="display: flex; align-items: center; gap: 6px; color: var(--color-accent-light); font-size: 12.5px; font-weight: 750; margin-bottom: 12px;">
          <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Datos Extraídos con Éxito (Confianza 98.4%)
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #fff; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 11px; margin-bottom: 12px;">
          <div>
            <span style="color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 2px;">PROVEEDOR:</span>
            <span style="font-weight: 750; color: var(--color-primary);">Maquinarias Pampeanas S.A.</span>
          </div>
          <div>
            <span style="color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 2px;">CUIT EMISOR:</span>
            <span style="font-family: monospace; font-weight: 750; color: var(--color-primary);">30-58472910-9</span>
          </div>
          <div>
            <span style="color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 2px;">TIPO DE COMPROBANTE:</span>
            <span style="font-weight: 750; color: var(--color-primary);">Factura A</span>
          </div>
          <div>
            <span style="color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 2px;">FECHA COMPRA:</span>
            <span style="font-weight: 750; color: var(--color-primary);">2026-05-28</span>
          </div>
          <div>
            <span style="color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 2px;">NETO IMPONIBLE:</span>
            <span style="font-weight: 750; color: var(--color-primary);">$ 1.500.000,00</span>
          </div>
          <div>
            <span style="color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 2px;">IVA (21%):</span>
            <span style="font-weight: 750; color: var(--color-primary);">$ 315.000,00</span>
          </div>
          <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="color: var(--text-muted); font-weight: 600; display: block;">MÉTRICA DE DESTINO:</span>
              <span style="font-weight: 750; color: var(--color-teal-light);">Bienes de Uso (Amortización RT 54)</span>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); font-weight: 600; display: block;">TOTAL:</span>
              <span style="font-weight: 800; color: var(--color-accent-light); font-size: 13px;">$ 1.815.000,00</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm" id="btn-cancel-ocr" style="flex: 1; font-size: 11px; padding: 8px;">Descartar</button>
          <button class="btn btn-primary btn-sm" id="btn-confirm-ocr" style="flex: 2; background: var(--color-accent-light); border-color: var(--color-accent-light); font-weight: 700; font-size: 11px; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <i data-lucide="check-check"></i> Registrar en Ledger
          </button>
        </div>
      </div>
    `;
  }

  if (scanState === 'registered') {
    return `
      <div style="margin-top: 12px; border: 1px solid var(--color-accent-light); border-radius: 6px; background: rgba(47, 122, 89, 0.06); padding: 14px;">
        <div style="display: flex; align-items: center; gap: 6px; color: var(--color-accent-light); font-size: 12.5px; font-weight: 800;">
          <i data-lucide="shield-check" style="width: 16px; height: 16px;"></i> ¡Comprobante en Ledger!
        </div>
        <p style="font-size: 11.5px; color: var(--text-secondary); margin: 6px 0 0 0; line-height: 1.4;">
          El comprobante fue insertado exitosamente en **Libro de Compras** de Dino S.A. y clasificado como <strong>Bien de Uso</strong> en el sub-libro de amortizaciones **RT 54**.
        </p>
      </div>
      
      <div class="chat-msg agent" style="margin-top: 12px;">
        <div class="msg-bubble" style="background: #d9fdd3; align-self: flex-end; border-top-right-radius: 0;">
          <p><strong>estudio_comahue_bot:</strong> ¡Recibido! Gasto de $ 1.815.000 (Bienes de Uso) cargado correctamente en el período Mayo 2026. La amortización RT 54 se recalculó de forma automática.</p>
          <span class="msg-time">Hace un momento · Bot</span>
        </div>
      </div>
    `;
  }
}

export function initWhatsApp(mainApp) {
  // Inject keyframe animation for laser scanning
  if (!document.getElementById('vmp-ocr-laser-style')) {
    const style = document.createElement('style');
    style.id = 'vmp-ocr-laser-style';
    style.innerHTML = `
      @keyframes scanLaser {
        0% { top: 0%; opacity: 0.8; }
        50% { top: 100%; opacity: 0.8; }
        100% { top: 0%; opacity: 0.8; }
      }
      .chat-msg { display: flex; width: 100%; margin-bottom: 6px; }
      .chat-msg.client { justify-content: flex-start; }
      .chat-msg.agent { justify-content: flex-end; }
      .chat-msg.system { justify-content: center; }
      .msg-bubble {
        padding: 10px 14px;
        border-radius: 8px;
        max-width: 65%;
        font-size: 12.5px;
        line-height: 1.5;
        box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      }
      .client .msg-bubble { background: #fff; align-self: flex-start; border-top-left-radius: 0; color: #1e293b; }
      .agent .msg-bubble { background: #d9fdd3; align-self: flex-end; border-top-right-radius: 0; color: #1e293b; }
      .system .msg-bubble { background: rgba(31,92,67,0.06); border: 1px solid rgba(31,92,67,0.15); color: #4f46e5; text-align: center; font-size: 11px; max-width: 80%; border-radius: 12px; }
      .attachment-bubble { width: 340px; max-width: 100%; }
      .msg-time { display: block; font-size: 9.5px; color: var(--text-muted); text-align: right; margin-top: 4px; }
      .file-attachment-card {
        background: #f1f5f9;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 10px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .fa-icon { background: #e2e8f0; color: var(--text-secondary); width: 32px; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
      .fa-details { display: flex; flex-direction: column; overflow: hidden; }
      .fa-name { font-size: 11px; font-weight: 700; color: var(--color-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fa-size { font-size: 9px; color: var(--text-secondary); }
      .wa-chat-item.active { background: rgba(31, 92, 67, 0.06); border-left: 3px solid var(--color-accent); }
      .wa-chat-item:hover { background: #f8fafc; }
    `;
    document.head.appendChild(style);
  }

  // Handle switching chats
  document.querySelectorAll('.wa-chat-item').forEach(item => {
    item.addEventListener('click', () => {
      activeChatId = item.dataset.id;
      // Reset OCR state when changing chat
      scanState = 'idle';
      extractedData = null;
      mainApp.router();
    });
  });

  // Handle starting the OCR scan
  document.getElementById('btn-start-ocr')?.addEventListener('click', () => {
    scanState = 'scanning';
    mainApp.router();
    
    // Simulate OCR delay (1.8s)
    setTimeout(() => {
      scanState = 'scanned';
      extractedData = {
        fecha: '2026-05-28',
        proveedor: 'Maquinarias Pampeanas S.A.',
        cuit: '30-58472910-9',
        tipo_comprobante: 'Factura A',
        numero: '0005-00004928',
        neto: 1500000.00,
        iva: 315000.00,
        total: 1815000.00,
        es_activo: true, // Marked as Capital Asset (RT 54)
        categoria: 'Bienes de Uso'
      };
      mainApp.router();
    }, 1800);
  });

  // Discard OCR
  document.getElementById('btn-cancel-ocr')?.addEventListener('click', () => {
    scanState = 'idle';
    extractedData = null;
    mainApp.router();
  });

  // Confirm OCR and register in ledger
  document.getElementById('btn-confirm-ocr')?.addEventListener('click', () => {
    if (extractedData) {
      // Add transaction reactively into the DB for the sender client's company (activeChatId)
      addTransaction(activeChatId, 'compras', extractedData);
      
      scanState = 'registered';
      mainApp.showToast('¡Comprobante OCR registrado en la empresa del cliente remitente!', 'success');
      
      // Auto refresh the screen
      mainApp.router();
    }
  });
}

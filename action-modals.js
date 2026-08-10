/**
 * action-modals.js
 * Shared utility for Action confirmation modals with mandatory remarks.
 * Used by Delete, Payment Skip, and Step Back actions.
 */

// Inject modal HTML once into the DOM
function ensureActionModalExists() {
  if (document.getElementById('action-remarks-modal')) return;
  const html = `
  <div id="action-remarks-modal" style="display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%;
    background:rgba(0,0,0,0.6); align-items:center; justify-content:center;">
    <div style="background:var(--surface-color); border-radius:12px; width:480px; max-width:95%; padding:28px;
      box-shadow:0 8px 32px rgba(0,0,0,0.4); border:1px solid var(--border-color);">
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
        <h2 id="arm-title" style="margin:0; font-size:1.15rem; color:var(--text-primary);">Confirm Action</h2>
        <button id="arm-close-btn" style="background:transparent; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
      </div>

      <div id="arm-info-section" style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.04); border-radius:8px; border-left:3px solid var(--primary-color);">
        <!-- Client info populated dynamically -->
      </div>

      <div id="arm-extra-fields" style="margin-bottom:16px;">
        <!-- Extra fields (e.g. Step Name dropdown) populated dynamically -->
      </div>

      <div style="margin-bottom:20px;">
        <label for="arm-remarks" style="display:block; margin-bottom:8px; font-weight:500; color:var(--text-primary);">
          Reason / Remarks <span style="color:#F87171;">*</span>
        </label>
        <textarea id="arm-remarks" rows="4" placeholder="Enter mandatory reason/remarks..."
          style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);
          background:var(--bg-color); color:var(--text-primary); font-size:0.9rem; resize:vertical; box-sizing:border-box;"></textarea>
        <p id="arm-remarks-error" style="color:#F87171; font-size:0.82rem; margin:4px 0 0; display:none;">
          ⚠ Remarks are mandatory. Please enter a reason.
        </p>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px;">
        <button id="arm-cancel-btn" style="padding:9px 20px; border-radius:8px; border:1px solid var(--border-color);
          background:transparent; color:var(--text-primary); cursor:pointer; font-size:0.9rem;">Cancel</button>
        <button id="arm-confirm-btn" style="padding:9px 20px; border-radius:8px; border:none;
          background:var(--primary-color); color:white; cursor:pointer; font-size:0.9rem; font-weight:600;">Confirm</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('arm-close-btn').addEventListener('click', closeActionModal);
  document.getElementById('arm-cancel-btn').addEventListener('click', closeActionModal);

  // Close on overlay click
  document.getElementById('action-remarks-modal').addEventListener('click', (e) => {
    if (e.target.id === 'action-remarks-modal') closeActionModal();
  });
}

function closeActionModal() {
  const modal = document.getElementById('action-remarks-modal');
  if (modal) modal.style.display = 'none';
  const remarksEl = document.getElementById('arm-remarks');
  if (remarksEl) remarksEl.value = '';
  const errEl = document.getElementById('arm-remarks-error');
  if (errEl) errEl.style.display = 'none';
  const extraEl = document.getElementById('arm-extra-fields');
  if (extraEl) extraEl.innerHTML = '';
  // Remove old confirm listener
  const confirmBtn = document.getElementById('arm-confirm-btn');
  if (confirmBtn) {
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  }
}

/**
 * Show action modal with mandatory remarks
 * @param {object} options
 * @param {string} options.title - Modal title
 * @param {string} options.infoHtml - HTML for the info section (client details)
 * @param {string} options.confirmBtnText - Text for confirm button
 * @param {string} options.confirmBtnColor - CSS color for confirm button (e.g. '#F87171')
 * @param {string} [options.extraFieldsHtml] - Optional extra fields HTML
 * @param {function} options.onConfirm - Callback(remarks, extraData) called when confirmed
 */
window.showActionModal = function(options) {
  ensureActionModalExists();

  document.getElementById('arm-title').textContent = options.title || 'Confirm Action';
  document.getElementById('arm-info-section').innerHTML = options.infoHtml || '';
  document.getElementById('arm-remarks').value = '';
  document.getElementById('arm-remarks-error').style.display = 'none';

  const extraEl = document.getElementById('arm-extra-fields');
  extraEl.innerHTML = options.extraFieldsHtml || '';

  const confirmBtn = document.getElementById('arm-confirm-btn');
  confirmBtn.textContent = options.confirmBtnText || 'Confirm';
  confirmBtn.style.background = options.confirmBtnColor || 'var(--primary-color)';

  confirmBtn.addEventListener('click', () => {
    const remarks = document.getElementById('arm-remarks').value.trim();
    if (!remarks) {
      document.getElementById('arm-remarks-error').style.display = 'block';
      document.getElementById('arm-remarks').focus();
      return;
    }
    document.getElementById('arm-remarks-error').style.display = 'none';

    // Collect extra fields data
    const extraData = {};
    if (extraEl.querySelectorAll('select, input').length) {
      extraEl.querySelectorAll('select, input').forEach(el => {
        if (el.id) extraData[el.id] = el.value;
      });
    }

    closeActionModal();
    options.onConfirm(remarks, extraData);
  });

  document.getElementById('action-remarks-modal').style.display = 'flex';
  if (typeof options.onOpen === 'function') {
    options.onOpen();
  }
  setTimeout(() => document.getElementById('arm-remarks').focus(), 100);
};

window.closeActionModal = closeActionModal;

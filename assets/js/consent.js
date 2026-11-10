const storageKey = 'dcmcriator.cookie-consent.v1';
const dialog = document.createElement('dialog');
dialog.id = 'cookie-preferences';
dialog.className = 'cookie-preferences';
dialog.setAttribute('aria-labelledby', 'cookie-title');
dialog.innerHTML = `
  <h2 id="cookie-title">Preferências de cookies</h2>
  <p>O Google Maps só será carregado se você permitir cookies funcionais. O Google poderá receber dados de navegação e usar cookies próprios.</p>
  <p>A preferência é salva neste navegador. <a href="/privacidade.html">Política de Privacidade</a></p>
  <label><input type="checkbox" id="functional-cookies"> Permitir cookies funcionais (Google Maps)</label>
  <p id="cookie-storage-status" role="status"></p>
  <div class="cookie-actions">
    <button type="button" class="btn btn-outline" data-reject>Rejeitar funcionais</button>
    <button type="button" class="btn btn-primary" data-accept>Aceitar funcionais</button>
    <button type="button" class="btn btn-outline" data-save>Salvar preferências</button>
    <button type="button" class="btn btn-outline" data-close>Fechar</button>
  </div>`;
document.body.append(dialog);
const checkbox = dialog.querySelector('input');
const status = dialog.querySelector('[role="status"]');
let functional = false;
let decided = false;
let opener;

function readChoice() {
  try {
    const choice = JSON.parse(localStorage.getItem(storageKey));
    decided = choice?.version === 1 && typeof choice.functional === 'boolean';
    functional = decided && choice.functional;
  } catch {
    decided = false;
    functional = false;
  }
}

function applyChoice() {
  checkbox.checked = functional;
  document.querySelectorAll('[data-map-src]').forEach(container => {
    const existing = container.querySelector('iframe');
    if (!functional) existing?.remove();
    if (functional && !existing) {
      const frame = document.createElement('iframe');
      frame.className = 'location-map-iframe';
      frame.title = 'Localização de Descalvado - SP';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.src = container.dataset.mapSrc;
      container.append(frame);
    }
    container.querySelector('.map-consent-placeholder').hidden = functional;
  });
}

function openPreferences(event) {
  opener = event?.currentTarget || document.activeElement;
  checkbox.checked = functional;
  if (!dialog.open) dialog.showModal();
}

function saveChoice(allowed) {
  functional = allowed;
  decided = true;
  applyChoice();
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, functional }));
    status.textContent = '';
    dialog.close();
  } catch {
    status.textContent = 'A escolha foi aplicada nesta página, mas o navegador não permitiu salvá-la. Ao recarregar, o mapa ficará bloqueado.';
  }
}

document.querySelectorAll('[data-cookie-preferences]').forEach(button => {
  button.addEventListener('click', openPreferences);
});
dialog.querySelector('[data-reject]').addEventListener('click', () => saveChoice(false));
dialog.querySelector('[data-accept]').addEventListener('click', () => saveChoice(true));
dialog.querySelector('[data-save]').addEventListener('click', () => saveChoice(checkbox.checked));
dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => opener?.focus());
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) {
    readChoice();
    applyChoice();
  }
});
readChoice();
applyChoice();
if (!decided) openPreferences();

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      padding: 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      backdrop-filter: blur(12px);
    }

    .group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    button,
    label.color-picker {
      border: none;
      border-radius: 14px;
      padding: 10px 14px;
      background: linear-gradient(180deg, #ffffff, #eef3ff);
      color: #172033;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, opacity 0.18s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    button:hover,
    label.color-picker:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 22px rgba(15, 23, 42, 0.16);
      background: linear-gradient(180deg, #ffffff, #e7efff);
    }

    button:active,
    label.color-picker:active {
      transform: translateY(0);
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
    }

    button[disabled],
    label.color-picker.disabled {
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
      box-shadow: none;
    }

    .icon {
      font-size: 1rem;
    }

    input[type='color'] {
      inline-size: 26px;
      block-size: 26px;
      border: none;
      padding: 0;
      background: transparent;
      cursor: pointer;
    }

    input[type='file'] {
      display: none;
    }

    @media (max-width: 900px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .group {
        justify-content: center;
      }
    }
  </style>
  <div class="toolbar">
    <div class="group">
      <button type="button" data-action="generate"><span class="icon">✦</span><span>Сгенерировать полигон</span></button>
      <button type="button" data-action="delete-selected"><span class="icon">⌫</span><span>Удалить выбранный</span></button>
      <button type="button" data-action="delete-all"><span class="icon">⨯</span><span>Удалить все</span></button>
      <label class="color-picker disabled" part="color-picker">
        <span class="icon">🎨</span>
        <span>Цвет</span>
        <input type="color" value="#2A9D8F" aria-label="Изменить цвет выбранного полигона" />
      </label>
    </div>
    <div class="group">
      <button type="button" data-action="undo"><span class="icon">↶</span><span>Отменить</span></button>
      <button type="button" data-action="redo"><span class="icon">↷</span><span>Повторить</span></button>
      <button type="button" data-action="export"><span class="icon">⤓</span><span>Экспорт JSON</span></button>
      <button type="button" data-action="import"><span class="icon">⤒</span><span>Импорт JSON</span></button>
      <input type="file" accept="application/json,.json" />
    </div>
  </div>
`;

class AppToolbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.colorLabel = this.shadowRoot.querySelector('.color-picker');
    this.colorInput = this.shadowRoot.querySelector('input[type="color"]');
    this.fileInput = this.shadowRoot.querySelector('input[type="file"]');

    this.handleAction = this.handleAction.bind(this);
    this.handleColorChange = this.handleColorChange.bind(this);
    this.handleFileInput = this.handleFileInput.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.handleAction);
    this.colorInput.addEventListener('input', this.handleColorChange);
    this.fileInput.addEventListener('change', this.handleFileInput);
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this.handleAction);
    this.colorInput.removeEventListener('input', this.handleColorChange);
    this.fileInput.removeEventListener('change', this.handleFileInput);
  }

  updateState({ canUndo, canRedo, hasSelection, selectedColor }) {
    this.shadowRoot.querySelector('[data-action="undo"]').disabled = !canUndo;
    this.shadowRoot.querySelector('[data-action="redo"]').disabled = !canRedo;
    this.shadowRoot.querySelector('[data-action="delete-selected"]').disabled = !hasSelection;

    this.colorInput.disabled = !hasSelection;
    this.colorLabel.classList.toggle('disabled', !hasSelection);

    if (selectedColor) {
      this.colorInput.value = selectedColor;
    }
  }

  handleAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const { action } = button.dataset;
    if (action === 'import') {
      this.fileInput.value = '';
      this.fileInput.click();
      return;
    }

    this.dispatchEvent(
      new CustomEvent('toolbar-action', {
        bubbles: true,
        composed: true,
        detail: { action },
      })
    );
  }

  handleColorChange(event) {
    this.dispatchEvent(
      new CustomEvent('color-change', {
        bubbles: true,
        composed: true,
        detail: { color: event.target.value },
      })
    );
  }

  async handleFileInput(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const text = await file.text();
    this.dispatchEvent(
      new CustomEvent('import-scene', {
        bubbles: true,
        composed: true,
        detail: {
          name: file.name,
          text,
        },
      })
    );
  }
}

customElements.define('app-toolbar', AppToolbar);

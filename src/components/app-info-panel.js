const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      backdrop-filter: blur(12px);
    }

    .item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .label {
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .value {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .panel {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <div class="panel">
    <div class="item">
      <span class="label">Количество полигонов</span>
      <span class="value" data-field="count">0</span>
    </div>
    <div class="item">
      <span class="label">Выбранный объект</span>
      <span class="value" data-field="selected">Ничего не выбрано</span>
    </div>
  </div>
`;

class AppInfoPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.countNode = this.shadowRoot.querySelector('[data-field="count"]');
    this.selectedNode = this.shadowRoot.querySelector('[data-field="selected"]');
  }

  updateState({ count, selectedName }) {
    this.countNode.textContent = String(count);
    this.selectedNode.textContent = selectedName || 'Ничего не выбрано';
  }
}

customElements.define('app-info-panel', AppInfoPanel);

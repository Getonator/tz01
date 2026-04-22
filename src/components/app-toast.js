const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      position: fixed;
      inset: auto 24px 24px auto;
      z-index: 1000;
      pointer-events: none;
    }

    .toast {
      min-width: 240px;
      max-width: min(420px, calc(100vw - 48px));
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.3);
      opacity: 0;
      transform: translateY(12px) scale(0.98);
      transition: opacity 0.24s ease, transform 0.24s ease;
      font-size: 0.95rem;
      line-height: 1.45;
    }

    .toast.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  </style>
  <div class="toast" role="status" aria-live="polite"></div>
`;

class AppToast extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.toastNode = this.shadowRoot.querySelector('.toast');
    this.timeoutId = null;
  }

  show(message, duration = 2400) {
    this.toastNode.textContent = message;
    this.toastNode.classList.add('visible');
    clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => {
      this.toastNode.classList.remove('visible');
    }, duration);
  }
}

customElements.define('app-toast', AppToast);

import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-input/ui-input.js';
import '../../../ui/ui-select/ui-select.js';
import '../../../ui/ui-button/ui-button.js';
import {
  getCriticalityLabel,
  normalizeConsumer,
  parseLocaleNumber,
} from '../../../../utils/consumer-utils.js';
import { CONSUMER_CATEGORIES } from '../../../../data/consumer-categories.js';
import styles from './consumer-modal.scss?inline';

const usageProfileOptions = [
  { value: 'always', label: 'Постійно 24/7' },
  { value: 'day', label: 'День' },
  { value: 'evening', label: 'Вечір' },
  { value: 'night', label: 'Ніч' },
  { value: 'office', label: 'Робочі години' },
];

const priorityOptions = [
  { value: 'high', label: getCriticalityLabel('high') },
  { value: 'medium', label: getCriticalityLabel('medium') },
  { value: 'low', label: getCriticalityLabel('low') },
];

class ConsumerModal extends BaseElement {
  constructor() {
    super();
    this._open = false;
    this._zones = [];
    this._consumer = null;
    this.formData = this.getDefaultFormData();
    this.errors = {};
  }

  styles() {
    return styles;
  }

  getDefaultFormData() {
    return {
      id: '',
      name: '',
      category: 'other',
      zoneId: this._zones[0]?.id || '',
      power: '',
      quantity: '1',
      hoursPerDay: '',
      surgePower: '',
      priority: 'medium',
      usageProfile: 'day',
      notes: '',
    };
  }

  hydrateFormData(consumer = null) {
    if (!consumer) {
      this.formData = this.getDefaultFormData();
      return;
    }

    this.formData = {
      id: consumer.id || '',
      name: consumer.name || '',
      category: consumer.category || 'other',
      zoneId: consumer.zoneId || this._zones[0]?.id || '',
      power: String(consumer.power ?? ''),
      quantity: String(consumer.quantity ?? '1'),
      hoursPerDay: String(consumer.hoursPerDay ?? ''),
      surgePower: String(consumer.surgePower ?? ''),
      priority: consumer.priority || 'medium',
      usageProfile: consumer.usageProfile || 'day',
      notes: consumer.notes || '',
    };
  }

  get open() {
    return this._open;
  }
  set open(value) {
    this._open = Boolean(value);
    if (!this._open) {
      this.errors = {};
    }
    if (this.isConnected) this.update();
  }

  get zones() {
    return this._zones;
  }
  set zones(value) {
    this._zones = Array.isArray(value) ? value : [];
    if (!this._zones.some((zone) => zone.id === this.formData.zoneId)) {
      this.formData = { ...this.formData, zoneId: this._zones[0]?.id || '' };
    }
    if (this.isConnected) this.update();
  }

  get consumer() {
    return this._consumer;
  }
  set consumer(value) {
    this._consumer = value || null;
    this.hydrateFormData(this._consumer);
    this.errors = {};
    if (this.isConnected) this.update();
  }

  get mode() {
    return this._consumer?.id ? 'edit' : 'create';
  }

  get zoneOptions() {
    if (!this.zones.length) return [{ value: '', label: 'Спочатку створіть зону' }];
    return this.zones.map((zone) => ({ value: zone.id, label: zone.name }));
  }

  validateField(name, data = this.formData) {
    const value = data[name];
    switch (name) {
      case 'name':
        return String(value || '').trim() ? '' : 'Вкажіть назву приладу.';
      case 'category':
        return String(value || '').trim() ? '' : 'Оберіть категорію.';
      case 'zoneId':
        return String(value || '').trim() ? '' : 'Оберіть зону.';
      case 'power': {
        const parsed = parseLocaleNumber(value);
        if (!Number.isFinite(parsed)) return 'Вкажіть потужність числом.';
        return parsed > 0 ? '' : 'Потужність має бути більшою за 0 W.';
      }
      case 'quantity': {
        const parsed = parseLocaleNumber(value);
        if (!Number.isFinite(parsed)) return 'Вкажіть кількість числом.';
        return Number.isInteger(parsed) && parsed >= 1
          ? ''
          : 'Кількість має бути цілим числом від 1.';
      }
      case 'hoursPerDay': {
        const parsed = parseLocaleNumber(value);
        if (!Number.isFinite(parsed)) return 'Вкажіть години роботи числом.';
        return parsed >= 0 && parsed <= 24 ? '' : 'Час роботи має бути в межах від 0 до 24 годин.';
      }
      case 'surgePower': {
        if (String(value || '').trim() === '') return '';
        const surge = parseLocaleNumber(value);
        const power = parseLocaleNumber(data.power);
        if (!Number.isFinite(surge)) return 'Вкажіть пускову потужність числом.';
        if (!Number.isFinite(power)) return 'Спочатку вкажіть коректну робочу потужність.';
        return surge >= power ? '' : 'Пускова потужність не може бути меншою за робочу.';
      }
      case 'priority':
        return String(value || '').trim() ? '' : 'Оберіть важливість приладу.';
      case 'usageProfile':
        return String(value || '').trim() ? '' : 'Оберіть профіль використання.';
      default:
        return '';
    }
  }

  validateAll() {
    const fieldNames = [
      'name',
      'category',
      'zoneId',
      'power',
      'quantity',
      'hoursPerDay',
      'priority',
      'usageProfile',
    ];
    const errors = fieldNames.reduce((acc, fieldName) => {
      const error = this.validateField(fieldName);
      if (error) acc[fieldName] = error;
      return acc;
    }, {});

    if (String(this.formData.surgePower || '').trim()) {
      const surgeError = this.validateField('surgePower');
      if (surgeError) errors.surgePower = surgeError;
    }

    return errors;
  }

  render() {
    if (!this.open) return '';
    const noZones = !this.zones.length;
    const heading = this.mode === 'edit' ? 'Редагувати прилад' : 'Додати прилад';

    return `
      <div class="consumer-modal__backdrop">
        <div class="consumer-modal__dialog" role="dialog" aria-modal="true" aria-label="${heading}">
          <div class="consumer-modal__head">
            <div>
              <p class="consumer-modal__eyebrow">Прилад</p>
              <h2>${heading}</h2>
            </div>
            <button class="consumer-modal__close" type="button" aria-label="Закрити">×</button>
          </div>

          <div class="consumer-modal__grid">
            <ui-input name="name" label="Назва приладу" placeholder="Наприклад, Газовий котел" value="${this.formData.name}" error="${this.errors.name || ''}"></ui-input>
            <ui-select name="category" label="Категорія" value="${this.formData.category}" error="${this.errors.category || ''}"></ui-select>
            <ui-select name="zoneId" label="Зона" value="${this.formData.zoneId}" error="${this.errors.zoneId || ''}" ${noZones ? 'disabled' : ''}></ui-select>
            <ui-input type="text" name="power" label="Робоча потужність, W" placeholder="Наприклад, 120" value="${this.formData.power}" error="${this.errors.power || ''}"></ui-input>
            <ui-input type="text" name="quantity" label="Кількість" placeholder="1" value="${this.formData.quantity}" error="${this.errors.quantity || ''}"></ui-input>
            <ui-input type="text" name="hoursPerDay" label="Скільки працює за добу" placeholder="Наприклад, 10,5" value="${this.formData.hoursPerDay}" error="${this.errors.hoursPerDay || ''}"></ui-input>
            <ui-input type="text" name="surgePower" label="Пускова потужність, W" placeholder="Наприклад, 600" value="${this.formData.surgePower}" error="${this.errors.surgePower || ''}"></ui-input>
            <ui-select name="priority" label="Наскільки це важливо" value="${this.formData.priority}" error="${this.errors.priority || ''}"></ui-select>
            <ui-select name="usageProfile" label="Коли працює прилад" value="${this.formData.usageProfile}" error="${this.errors.usageProfile || ''}"></ui-select>
            <ui-input type="textarea" rows="3" name="notes" label="Примітки" placeholder="Наприклад, працює циклічно або запускається нечасто" value="${this.formData.notes}"></ui-input>
          </div>

          <div class="consumer-modal__actions">
            <ui-button class="consumer-cancel-btn" variant="secondary">Скасувати</ui-button>
            <ui-button class="consumer-save-btn" ${noZones ? 'disabled' : ''}>${this.mode === 'edit' ? 'Зберегти зміни' : 'Додати у проєкт'}</ui-button>
          </div>
        </div>
      </div>
    `;
  }

  afterRender() {
    const categorySelect = this.shadowRoot.querySelector('ui-select[name="category"]');
    const zoneSelect = this.shadowRoot.querySelector('ui-select[name="zoneId"]');
    const prioritySelect = this.shadowRoot.querySelector('ui-select[name="priority"]');
    const usageSelect = this.shadowRoot.querySelector('ui-select[name="usageProfile"]');

    if (categorySelect) categorySelect.options = CONSUMER_CATEGORIES;
    if (zoneSelect) zoneSelect.options = this.zoneOptions;
    if (prioritySelect) prioritySelect.options = priorityOptions;
    if (usageSelect) usageSelect.options = usageProfileOptions;

    this.shadowRoot.removeEventListener('ui-input', this.handleField);
    this.shadowRoot.removeEventListener('ui-change', this.handleField);
    this.shadowRoot.addEventListener('ui-input', this.handleField);
    this.shadowRoot.addEventListener('ui-change', this.handleField);

    this.shadowRoot
      .querySelector('.consumer-modal__close')
      ?.addEventListener('click', this.handleClose);
    this.shadowRoot
      .querySelector('.consumer-cancel-btn')
      ?.addEventListener('ui-click', this.handleClose);
    this.shadowRoot
      .querySelector('.consumer-save-btn')
      ?.addEventListener('ui-click', this.handleSave);
    this.shadowRoot
      .querySelector('.consumer-modal__backdrop')
      ?.addEventListener('click', this.handleBackdropClick);
    document.addEventListener('keydown', this.handleEscape);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleEscape);
  }

  handleEscape = (event) => {
    if (event.key === 'Escape' && this.open) this.handleClose();
  };

  handleBackdropClick = (event) => {
    if (event.target.classList.contains('consumer-modal__backdrop')) this.handleClose();
  };

  handleClose = () => {
    this.errors = {};
    this.dispatchEvent(new CustomEvent('consumer-modal-close', { bubbles: true, composed: true }));
  };

  setFieldError(name, error = '') {
    const nextError = String(error || '');
    if (this.errors[name] === nextError) return;

    this.errors = { ...this.errors, [name]: nextError };
    const field = this.shadowRoot?.querySelector(`[name="${name}"]`);
    if (!field) return;

    if (nextError) field.setAttribute('error', nextError);
    else field.removeAttribute('error');
  }

  handleField = (event) => {
    const { name, value } = event.detail || {};
    if (!name) return;

    this.formData = { ...this.formData, [name]: value };
    this.setFieldError(name, this.validateField(name, this.formData));

    if (name === 'power' && (this.formData.surgePower || this.errors.surgePower)) {
      this.setFieldError('surgePower', this.validateField('surgePower', this.formData));
    }
  };

  handleSave = () => {
    const errors = this.validateAll();
    if (Object.keys(errors).length) {
      this.errors = errors;
      this.dispatchEvent(
        new CustomEvent('consumer-modal-invalid', {
          detail: { errors: Object.values(errors) },
          bubbles: true,
          composed: true,
        }),
      );
      this.update();
      return;
    }

    const consumer = normalizeConsumer(this.formData);
    this.dispatchEvent(
      new CustomEvent('consumer-save', {
        detail: { consumer, mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    );
    this.errors = {};
  };
}

customElements.define('consumer-modal', ConsumerModal);

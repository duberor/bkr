import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-input/ui-input.js';
import '../../../ui/ui-select/ui-select.js';
import '../../../ui/ui-button/ui-button.js';
import { normalizeConsumer, parseLocaleNumber } from '../../../../utils/consumer-utils.js';
import { CONSUMER_CATEGORIES } from '../../../../data/consumer-categories.js';
import styles from './consumer-form.scss?inline';

const usageProfileOptions = [
  { value: 'always', label: 'Постійно 24/7' },
  { value: 'day', label: 'День' },
  { value: 'evening', label: 'Вечір' },
  { value: 'night', label: 'Ніч' },
  { value: 'office', label: 'Робочі години' },
];

const priorityOptions = [
  { value: 'high', label: 'Високий' },
  { value: 'medium', label: 'Середній' },
  { value: 'low', label: 'Низький' },
];

class ConsumerForm extends BaseElement {
  constructor() {
    super();
    this._zones = [];
    this.formData = this.getDefaultFormData();
    this.errors = {};
  }

  styles() { return styles; }

  get zones() { return this._zones; }
  set zones(value) {
    this._zones = Array.isArray(value) ? value : [];
    if (!this._zones.some((zone) => zone.id === this.formData.zoneId)) {
      this.formData = { ...this.formData, zoneId: this._zones[0]?.id || '' };
    }
    if (this.isConnected) this.update();
  }

  getDefaultFormData() {
      return {
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
        return Number.isInteger(parsed) && parsed >= 1 ? '' : 'Кількість має бути цілим числом від 1.';
      }
      case 'hoursPerDay': {
        const parsed = parseLocaleNumber(value);
        if (!Number.isFinite(parsed)) return 'Вкажіть години роботи числом.';
        return parsed >= 0 && parsed <= 24 ? '' : 'Час роботи має бути в межах від 0 до 24 годин.';
      }
      case 'surgePower': {
        const surge = parseLocaleNumber(value);
        const power = parseLocaleNumber(data.power);
        if (!Number.isFinite(surge)) return 'Вкажіть пускову потужність числом.';
        if (!Number.isFinite(power)) return 'Спочатку вкажіть коректну робочу потужність.';
        return surge >= power ? '' : 'Пускова потужність не може бути меншою за робочу.';
      }
      case 'priority':
        return String(value || '').trim() ? '' : 'Оберіть пріоритет.';
      case 'usageProfile':
        return String(value || '').trim() ? '' : 'Оберіть профіль використання.';
      default:
        return '';
    }
  }

  validateAll() {
    const fieldNames = ['name', 'category', 'zoneId', 'power', 'quantity', 'hoursPerDay', 'surgePower', 'priority', 'usageProfile'];
    return fieldNames.reduce((acc, fieldName) => {
      const error = this.validateField(fieldName);
      if (error) acc[fieldName] = error;
      return acc;
    }, {});
  }

  render() {
    const noZones = !this.zones.length;

    return `
      <section class="consumer-form">
        <div class="consumer-form__head">
          <div>
            <p class="consumer-form__eyebrow">Прилад</p>
            <h2 class="consumer-form__title">Додати прилад</h2>
            <p class="consumer-form__lead">Якщо не знаєте точних цифр, почніть з приблизних значень з шильдика або техпаспорта. Потім їх можна уточнити.</p>
          </div>
        </div>

        <div class="consumer-form__grid">
          <ui-input name="name" label="Назва приладу" placeholder="Наприклад, Газовий котел" hint="Пишіть так, як вам буде зрозуміло у списку й у звіті." value="${this.formData.name}" error="${this.errors.name || ''}"></ui-input>
          <ui-select name="category" label="Категорія" hint="Категорія потрібна для структури списку та графіків." value="${this.formData.category}" error="${this.errors.category || ''}"></ui-select>
          <div class="consumer-form__zone-field">
            <ui-select name="zoneId" label="Зона" hint="Зона допоможе згрупувати прилади по кімнатах або контурах." value="${this.formData.zoneId}" error="${this.errors.zoneId || ''}" ${noZones ? 'disabled' : ''}></ui-select>
          </div>
          <ui-input type="text" name="power" label="Робоча потужність, W" placeholder="Наприклад, 120 або 1 000" hint="Вкажіть потужність, з якою прилад працює у звичайному режимі." value="${this.formData.power}" error="${this.errors.power || ''}"></ui-input>
          <ui-input type="text" name="quantity" label="Кількість" placeholder="1" hint="Скільки однакових приладів треба врахувати в розрахунку." value="${this.formData.quantity}" error="${this.errors.quantity || ''}"></ui-input>
          <ui-input type="text" name="hoursPerDay" label="Скільки працює за добу" placeholder="Наприклад, 10,5" hint="Орієнтовний час роботи приладу протягом звичайної доби." value="${this.formData.hoursPerDay}" error="${this.errors.hoursPerDay || ''}"></ui-input>
          <ui-input type="text" name="surgePower" label="Пускова потужність, W" placeholder="Наприклад, 600" hint="Для моторів, насосів і компресорів вкажіть стартовий пік. Якщо його немає, залиште як робочу потужність." value="${this.formData.surgePower}" error="${this.errors.surgePower || ''}"></ui-input>
          <ui-select name="priority" label="Пріоритет" hint="Високий пріоритет задавайте тому, що має працювати в першу чергу." value="${this.formData.priority}" error="${this.errors.priority || ''}"></ui-select>
          <ui-select name="usageProfile" label="Коли працює прилад" hint="Потрібно для побудови добового графіка навантаження." value="${this.formData.usageProfile}" error="${this.errors.usageProfile || ''}"></ui-select>
          <ui-input type="textarea" rows="3" name="notes" label="Примітки" placeholder="Наприклад, працює циклічно або запускається нечасто" hint="Поле не обов'язкове, але корисне для пояснень у проєкті." value="${this.formData.notes}"></ui-input>
        </div>
        <div class="consumer-form__actions">
          <ui-button class="consumer-form__submit" ${noZones ? 'disabled' : ''}>Додати у проєкт</ui-button>
        </div>
      </section>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelector('ui-select[name="category"]').options = CONSUMER_CATEGORIES;
    this.shadowRoot.querySelector('ui-select[name="zoneId"]').options = this.zoneOptions;
    this.shadowRoot.querySelector('ui-select[name="priority"]').options = priorityOptions;
    this.shadowRoot.querySelector('ui-select[name="usageProfile"]').options = usageProfileOptions;

    this.shadowRoot.removeEventListener('ui-input', this.handleField);
    this.shadowRoot.removeEventListener('ui-change', this.handleField);
    this.shadowRoot.addEventListener('ui-input', this.handleField);
    this.shadowRoot.addEventListener('ui-change', this.handleField);

    this.shadowRoot.querySelector('.consumer-form__submit')?.addEventListener('ui-click', this.handleSubmit);
  }

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

  handleSubmit = () => {
    const errors = this.validateAll();

    if (Object.keys(errors).length) {
      this.errors = errors;
      this.dispatchEvent(new CustomEvent('consumer-invalid', { detail: { errors: Object.values(errors) }, bubbles: true, composed: true }));
      this.update();
      return;
    }

    const consumer = normalizeConsumer(this.formData);
    this.errors = {};
    this.dispatchEvent(new CustomEvent('consumer-add', { detail: { consumer }, bubbles: true, composed: true }));
    this.formData = this.getDefaultFormData();
    this.update();
  };
}

customElements.define('consumer-form', ConsumerForm);

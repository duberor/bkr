import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import '../../ui/ui-tooltip/ui-tooltip.js';
import { appStore } from '../../../store/app-store.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import {
  formatAutonomy,
  formatBattery,
  formatBatteryTopology,
  formatEnergyWh,
  formatNumber,
  formatPower,
} from '../../../utils/format.js';
import { escapeAttr, escapeHtml } from '../../../utils/escape.js';
import {
  INVERTER_CATALOG,
  BATTERY_MODULE_CATALOG,
  CHARGER_CATALOG,
  DC_PROTECTION_CATALOG,
  OPTIONAL_ACCESSORY_CATALOG,
} from '../../../data/product-catalog.js';
import { canUseLiveProductSearch, searchProductsLive } from '../../../services/product-search.js';
import styles from './products-page.scss?inline';

const BATTERY_LABELS = {
  lifepo4: 'LiFePO4',
  agm: 'AGM',
  gel: 'GEL',
};

function formatMoney(value = 0) {
  return `${new Intl.NumberFormat('uk-UA').format(Number(value || 0))} грн`;
}

function emptyLiveBuckets() {
  return {
    inverter: [],
    battery: [],
    charger: [],
    protection: [],
  };
}

function uniqueByUrl(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const url = String(item?.url || '');
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function renderImageWithFallback({
  imageUrl = '',
  alt = '',
  imgClass = '',
  placeholderClass = '',
  placeholderText = 'Фото недоступне',
}) {
  const source = String(imageUrl || '').trim();
  const hasSource = Boolean(source);

  return `
    <div class="products-page__image-wrap ${hasSource ? '' : 'is-fallback'}" data-fallback-wrap>
      ${
        hasSource
          ? `<img class="${escapeAttr(imgClass)}" src="${escapeAttr(source)}" alt="${escapeAttr(alt)}" loading="lazy" data-image-fallback />`
          : ''
      }
      <div class="${escapeAttr(placeholderClass)}">${escapeHtml(placeholderText)}</div>
    </div>
  `;
}

class ProductsPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
    this.live = {
      supported: canUseLiveProductSearch(),
      loading: false,
      error: '',
      key: '',
      results: emptyLiveBuckets(),
    };
    this.liveAbortController = null;
  }

  connectedCallback() {
    this.unsubscribe = appStore.subscribe((state) => {
      this.state = state;
      this.update();
      this.scheduleLiveSearch();
    });
    super.connectedCallback();
    this.scheduleLiveSearch();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.liveAbortController?.abort();
  }

  styles() {
    return styles;
  }

  get calc() {
    return getSystemCalculation(this.state.consumers, this.state.systemSettings);
  }

  get hasLoad() {
    return this.state.consumers.length > 0;
  }

  get voltage() {
    return Number(this.calc.normalizedSettings?.batteryVoltage || 24);
  }

  get batteryType() {
    return this.calc.normalizedSettings?.batteryType || 'lifepo4';
  }

  get designDcCurrent() {
    const efficiency = Number(this.calc.normalizedSettings?.inverterEfficiency || 0.92);
    if (!this.voltage) return 0;
    return this.calc.designLoadPower / Math.max(this.voltage * efficiency, 1);
  }

  get surgeDcCurrent() {
    const efficiency = Number(this.calc.normalizedSettings?.inverterEfficiency || 0.92);
    if (!this.voltage) return 0;
    return this.calc.totalSurgePower / Math.max(this.voltage * efficiency, 1);
  }

  get requiredProtectionCurrent() {
    return Math.ceil(Math.max(this.designDcCurrent * 1.25, this.surgeDcCurrent * 1.1));
  }

  get requiredProtectionVoltage() {
    return Math.ceil(this.voltage * 1.25);
  }

  get recommendedInverters() {
    const voltage = this.voltage;
    const requiredPower = this.calc.recommendedInverterPower;
    const requiredSurge = this.calc.totalSurgePower;
    if (!requiredPower) return [];

    const strict = INVERTER_CATALOG.filter(
      (item) =>
        item.dcVoltage.includes(voltage) &&
        item.powerW >= requiredPower &&
        item.surgeW >= requiredSurge,
    );

    const relaxed = INVERTER_CATALOG.filter(
      (item) => item.dcVoltage.includes(voltage) && item.powerW >= requiredPower * 0.9,
    );

    const source = strict.length ? strict : relaxed;
    return source
      .map((item) => ({
        ...item,
        headroomW: item.powerW - requiredPower,
        surgeHeadroomW: item.surgeW - requiredSurge,
      }))
      .sort((a, b) => {
        const scoreA =
          Math.abs(a.headroomW) + Math.abs(a.surgeHeadroomW) * 0.4 + a.priceUah / 100000;
        const scoreB =
          Math.abs(b.headroomW) + Math.abs(b.surgeHeadroomW) * 0.4 + b.priceUah / 100000;
        return scoreA - scoreB;
      })
      .slice(0, 3);
  }

  get recommendedBatteryModules() {
    const requiredAh = this.calc.recommendedBatteryCapacityAh;
    if (!requiredAh) return [];

    const voltage = this.voltage;
    const efficiency = Number(this.calc.normalizedSettings?.inverterEfficiency || 0.92);
    const dod = Number(this.calc.depthOfDischarge || 0.8);
    const seriesCount = Math.max(1, Math.ceil(voltage / 12));
    const dailyConsumptionWh = Number(this.calc.dailyConsumptionWh || 0);

    return BATTERY_MODULE_CATALOG.filter(
      (module) => module.moduleVoltage === 12 && module.chemistry.includes(this.batteryType),
    )
      .map((module) => {
        const parallelCount = Math.max(1, Math.ceil(requiredAh / module.capacityAh));
        const totalModules = seriesCount * parallelCount;
        const bankCapacityAh = module.capacityAh * parallelCount;
        const storedWh = voltage * bankCapacityAh;
        const usableWh = storedWh * efficiency * dod;
        const autonomyHours = dailyConsumptionWh > 0 ? (usableWh * 24) / dailyConsumptionWh : 0;
        const continuousAutonomyHours =
          this.calc.designLoadPower > 0 ? usableWh / this.calc.designLoadPower : 0;
        const totalPrice = totalModules * module.priceUah;
        return {
          ...module,
          seriesCount,
          parallelCount,
          totalModules,
          bankCapacityAh,
          storedWh,
          usableWh,
          autonomyHours,
          continuousAutonomyHours,
          totalPrice,
          fitScore: Math.abs(bankCapacityAh - requiredAh),
        };
      })
      .sort((a, b) => a.fitScore - b.fitScore || a.totalPrice - b.totalPrice)
      .slice(0, 3);
  }

  get recommendedChargers() {
    const voltage = this.voltage;
    const requiredCurrent = this.calc.recommendedChargeCurrentA;
    if (!requiredCurrent) return [];

    const strict = CHARGER_CATALOG.filter(
      (item) =>
        item.outputVoltage.includes(voltage) &&
        item.chemistry.includes(this.batteryType) &&
        item.currentA >= requiredCurrent,
    );

    const relaxed = CHARGER_CATALOG.filter(
      (item) =>
        item.outputVoltage.includes(voltage) &&
        item.chemistry.includes(this.batteryType) &&
        item.currentA >= requiredCurrent * 0.7,
    );

    const source = strict.length ? strict : relaxed;
    return source
      .map((item) => ({
        ...item,
        marginA: item.currentA - requiredCurrent,
      }))
      .sort((a, b) => Math.abs(a.marginA) - Math.abs(b.marginA) || a.priceUah - b.priceUah)
      .slice(0, 3);
  }

  get recommendedProtection() {
    const strict = DC_PROTECTION_CATALOG.filter(
      (item) =>
        item.currentA >= this.requiredProtectionCurrent &&
        item.maxVdc >= this.requiredProtectionVoltage,
    );
    const relaxed = DC_PROTECTION_CATALOG.filter(
      (item) => item.currentA >= this.requiredProtectionCurrent,
    );

    const source = strict.length ? strict : relaxed;
    return source
      .map((item) => ({
        ...item,
        marginA: item.currentA - this.requiredProtectionCurrent,
      }))
      .sort((a, b) => Math.abs(a.marginA) - Math.abs(b.marginA) || a.priceUah - b.priceUah)
      .slice(0, 3);
  }

  get liveQueries() {
    if (!this.hasLoad) return null;

    const batteryLabel =
      BATTERY_LABELS[this.batteryType] || String(this.batteryType || '').toUpperCase();
    const batteryModuleAh = this.recommendedBatteryModules[0]?.capacityAh || 100;
    const inverterW = Math.max(500, Math.round(this.calc.recommendedInverterPower || 0));
    const chargeA = Math.max(10, Math.round(this.calc.recommendedChargeCurrentA || 0));

    if (!inverterW) return null;

    return {
      inverter: `інвертор ${inverterW}W ${this.voltage}V чиста синусоїда`,
      battery: `акумулятор ${batteryLabel} 12V ${batteryModuleAh}Ah`,
      charger: `зарядний пристрій ${this.voltage}V ${chargeA}A ${batteryLabel}`,
      protection: `DC автомат ${this.requiredProtectionCurrent}A ${this.requiredProtectionVoltage}V`,
    };
  }

  get hasLiveResults() {
    const results = this.live.results || emptyLiveBuckets();
    return Object.values(results).some((rows) => rows.length > 0);
  }

  scheduleLiveSearch(force = false) {
    if (!this.live.supported) return;

    const queries = this.liveQueries;
    if (!queries) {
      if (this.live.key || this.hasLiveResults || this.live.error) {
        this.live = {
          ...this.live,
          loading: false,
          error: '',
          key: '',
          results: emptyLiveBuckets(),
        };
        this.update();
      }
      return;
    }

    const key = JSON.stringify(queries);
    if (!force && key === this.live.key) return;

    this.fetchLiveSearchResults(queries, key);
  }

  async fetchLiveSearchResults(queries, key) {
    this.liveAbortController?.abort();
    const controller = new AbortController();
    this.liveAbortController = controller;

    this.live = {
      ...this.live,
      loading: true,
      error: '',
      key,
    };
    this.update();

    try {
      const entries = await Promise.all(
        Object.entries(queries).map(async ([bucket, query]) => {
          const rows = await searchProductsLive(query, {
            num: 5,
            signal: controller.signal,
          });
          return [bucket, uniqueByUrl(rows).slice(0, 5)];
        }),
      );

      if (controller.signal.aborted || this.liveAbortController !== controller) return;

      const results = emptyLiveBuckets();
      entries.forEach(([bucket, rows]) => {
        results[bucket] = rows;
      });

      this.live = {
        ...this.live,
        loading: false,
        error: '',
        results,
      };
      this.update();
    } catch (error) {
      if (controller.signal.aborted || this.liveAbortController !== controller) return;

      this.live = {
        ...this.live,
        loading: false,
        results: emptyLiveBuckets(),
        error: error?.message ? String(error.message) : 'Не вдалося оновити добірку товарів.',
      };
      this.update();
    }
  }

  renderProductIdentity(item, subtitle = '') {
    const name = `${item.brand || ''} ${item.model || item.name || ''}`.trim();
    const image = renderImageWithFallback({
      imageUrl: item.imageUrl,
      alt: name,
      imgClass: 'products-page__thumb',
      placeholderClass: 'products-page__thumb products-page__thumb--placeholder',
    });
    const link = item.url
      ? `<a class="products-page__link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">Відкрити товар</a>`
      : '';

    return `
      <div class="products-page__item-head">
        ${image}
        <div class="products-page__item-meta">
          <strong>${escapeHtml(name)}</strong>
          ${subtitle ? `<small>${subtitle}</small>` : ''}
          ${link}
        </div>
      </div>
    `;
  }

  renderInverterRows() {
    if (!this.recommendedInverters.length) {
      return '<tr><td colspan="4">Додайте прилади, щоб отримати рекомендації інвертора.</td></tr>';
    }
    return this.recommendedInverters
      .map(
        (item) => `
      <tr>
        <td>${this.renderProductIdentity(item, `${item.wave} · ККД до ${formatNumber(item.efficiency * 100, 0)}%`)}</td>
        <td>${formatPower(item.powerW)} / ${formatPower(item.surgeW)}</td>
        <td>${item.headroomW >= 0 ? '+' : ''}${formatPower(item.headroomW)} робоча<br/>${item.surgeHeadroomW >= 0 ? '+' : ''}${formatPower(item.surgeHeadroomW)} пускова</td>
        <td>${formatMoney(item.priceUah)}</td>
      </tr>
    `,
      )
      .join('');
  }

  renderBatteryRows() {
    if (!this.recommendedBatteryModules.length) {
      return '<tr><td colspan="5">Наразі немає даних для підбору батарейних модулів.</td></tr>';
    }
    return this.recommendedBatteryModules
      .map(
        (item) => `
      <tr>
        <td>${this.renderProductIdentity(item, `Ресурс: ~${formatNumber(item.cycleLife)} циклів`)}</td>
        <td>${item.totalModules} шт (${formatBatteryTopology(item.seriesCount, item.parallelCount)})</td>
        <td>${this.voltage} V · ${formatBattery(item.bankCapacityAh)}</td>
        <td>${formatEnergyWh(item.usableWh)} · ${formatAutonomy(item.autonomyHours)}</td>
        <td>${formatMoney(item.totalPrice)}</td>
      </tr>
    `,
      )
      .join('');
  }

  renderChargerRows() {
    if (!this.recommendedChargers.length) {
      return '<tr><td colspan="4">Для поточних параметрів не знайдено сумісний зарядний у каталозі.</td></tr>';
    }
    return this.recommendedChargers
      .map(
        (item) => `
      <tr>
        <td>${this.renderProductIdentity(item)}</td>
        <td>${item.outputVoltage.join('/')} V · ${formatNumber(item.currentA)} A</td>
        <td>${item.marginA >= 0 ? '+' : ''}${formatNumber(item.marginA)} A</td>
        <td>${formatMoney(item.priceUah)}</td>
      </tr>
    `,
      )
      .join('');
  }

  renderProtectionRows() {
    if (!this.recommendedProtection.length) {
      return '<tr><td colspan="4">Додайте або уточніть навантаження для підбору захисту по постійному струму.</td></tr>';
    }
    return this.recommendedProtection
      .map(
        (item) => `
      <tr>
        <td>${this.renderProductIdentity(item, item.type === 'breaker' ? 'Автомат по постійному струму' : 'Запобіжник')}</td>
        <td>${formatNumber(item.currentA)} A / ${formatNumber(item.maxVdc)} V DC</td>
        <td>${item.marginA >= 0 ? '+' : ''}${formatNumber(item.marginA)} A</td>
        <td>${formatMoney(item.priceUah)}</td>
      </tr>
    `,
      )
      .join('');
  }

  renderOptionalItems() {
    return OPTIONAL_ACCESSORY_CATALOG.map(
      (item) => `
      <div class="products-page__optional-item">
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.why)}</p>
      </div>
    `,
    ).join('');
  }

  renderLiveCategory(title, items = []) {
    if (!items.length) {
      return `
        <article class="products-page__live-card products-page__live-card--empty">
          <h4>${escapeHtml(title)}</h4>
          <p>Немає результатів для цієї категорії зараз.</p>
        </article>
      `;
    }

    const cards = items
      .map((item) => {
        const image = renderImageWithFallback({
          imageUrl: item.imageUrl,
          alt: item.title,
          imgClass: 'products-page__live-image',
          placeholderClass: 'products-page__live-image products-page__live-image--placeholder',
        });

        return `
        <article class="products-page__live-card">
          ${image}
          <div class="products-page__live-body">
            <h4>${escapeHtml(item.title)}</h4>
            ${item.source ? `<small>${escapeHtml(item.source)}</small>` : ''}
            ${item.snippet ? `<p>${escapeHtml(item.snippet)}</p>` : ''}
            <a class="products-page__link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">Перейти до товару</a>
          </div>
        </article>
      `;
      })
      .join('');

    return `
      <div class="products-page__live-group">
        <h3>${escapeHtml(title)}</h3>
        <div class="products-page__live-grid">${cards}</div>
      </div>
    `;
  }

  renderLiveSection() {
    if (!this.hasLoad) return '';

    if (!this.live.supported) {
      return `
        <ui-card padding="md">
          <section class="products-page__section">
            <div class="products-page__section-head">
              <div class="products-page__title-row">
                <h2>Варіанти з маркетплейсів</h2>
                <ui-tooltip label="Пояснення" text="Щоб увімкнути пошук у маркетплейсах, додайте VITE_GOOGLE_CSE_API_KEY і VITE_GOOGLE_CSE_CX у .env."></ui-tooltip>
              </div>
            </div>
            <ui-disclosure label="Подивитися товари з маркетплейсів">
              <div class="products-page__live-state">
                <span>Пошук товарів у маркетплейсах зараз недоступний.</span>
              </div>
            </ui-disclosure>
          </section>
        </ui-card>
      `;
    }

    const { inverter, battery, charger, protection } = this.live.results;

    return `
        <ui-card padding="md">
          <section class="products-page__section">
            <div class="products-page__section-head">
              <div class="products-page__title-row">
                <h2>Варіанти з маркетплейсів</h2>
              <ui-tooltip label="Пояснення" text="Пошук формує результати за поточними параметрами системи й дає прямі посилання на товари. Використовуйте його як додатковий шар, а не як основну рекомендацію."></ui-tooltip>
            </div>
          </div>

            <ui-disclosure label="Подивитися товари з маркетплейсів">
              <div class="products-page__live-topbar">
                <div class="products-page__live-state">
                  ${this.live.loading ? '<span>Оновлюю добірку товарів...</span>' : '<span>Добірку товарів оновлено.</span>'}
                  ${this.live.error ? `<small>${escapeHtml(this.live.error)}</small>` : ''}
                </div>
                <button type="button" class="products-page__refresh" data-live-refresh ${this.live.loading ? 'disabled' : ''}>Оновити результати</button>
              </div>

              ${this.renderLiveCategory('Інвертори', inverter)}
              ${this.renderLiveCategory('АКБ', battery)}
              ${this.renderLiveCategory('Зарядні пристрої', charger)}
              ${this.renderLiveCategory('Захист по постійному струму', protection)}
            </ui-disclosure>
          </section>
        </ui-card>
      `;
  }

  render() {
    const calc = this.calc;

    return `
      <section class="products-page">
        <div class="products-page__hero">
          <div>
            <p class="page-eyebrow">Обладнання</p>
            <h1>Що потрібно купити для цієї системи</h1>
            <p>Спочатку показуємо сумісне обладнання з локального каталогу, а нижче, за потреби, можна подивитися товари з маркетплейсів.</p>
          </div>
          <ui-card padding="md">
            <div class="products-page__snapshot">
              <span>Коротко про рішення</span>
              <strong>${formatPower(calc.recommendedInverterPower)} · ${formatBattery(calc.recommendedBatteryCapacityAh)}</strong>
              <ui-disclosure label="Ключові параметри системи">
                <small>${this.voltage} V ${BATTERY_LABELS[this.batteryType] || String(this.batteryType).toUpperCase()} · рекомендований зарядний струм ${formatNumber(calc.recommendedChargeCurrentA)} A</small>
              </ui-disclosure>
            </div>
          </ui-card>
        </div>

        <ui-disclosure label="Як підібрано обладнання">
          <div class="products-page__chips">
            <span>Навантаження, під яке підібрано систему: <strong>${formatPower(calc.designLoadPower)}</strong></span>
            <span>Пусковий пік: <strong>${formatPower(calc.totalSurgePower)}</strong></span>
            <span>Енергія з запасом: <strong>${formatEnergyWh(calc.totalEnergyWh)}</strong></span>
            <span>Струм з боку АКБ: <strong>${formatNumber(this.designDcCurrent, 0)} A</strong></span>
          </div>
        </ui-disclosure>

        ${
          this.hasLoad
            ? ''
            : `
          <div class="products-page__empty">
            <span>Щоб побачити конкретні товари, додайте хоча б один прилад у розділі «Прилади».</span>
            <a class="products-page__empty-link" href="#/consumers">Перейти до приладів</a>
          </div>
        `
        }

        <ui-card padding="md">
          <section class="products-page__section">
            <div class="products-page__section-head">
              <div class="products-page__title-row">
                <h2>Сумісне обладнання</h2>
                <ui-tooltip label="Пояснення" text="Це основна рекомендація по обладнанню: локальна база перевіряє потужність, напругу, тип АКБ і потрібні струми."></ui-tooltip>
              </div>
            </div>

            <div class="products-page__block">
              <h3>1. Інвертор для системи</h3>
              <div class="products-page__table-wrap">
                <table class="products-page__table">
                  <thead>
                    <tr>
                      <th>Модель</th>
                      <th>Параметри</th>
                      <th>Запас до потрібної потужності</th>
                      <th>Орієнтовна ціна</th>
                    </tr>
                  </thead>
                  <tbody>${this.renderInverterRows()}</tbody>
                </table>
              </div>
            </div>

            <div class="products-page__block">
              <h3>2. Модулі АКБ</h3>
              <div class="products-page__table-wrap">
                <table class="products-page__table">
                  <thead>
                    <tr>
                      <th>Модуль</th>
                      <th>Скільки потрібно</th>
                      <th>Готовий комплект</th>
                      <th>Доступна енергія / час роботи</th>
                      <th>Орієнтовний бюджет</th>
                    </tr>
                  </thead>
                  <tbody>${this.renderBatteryRows()}</tbody>
                </table>
              </div>
            </div>

            <div class="products-page__block">
              <h3>3. Зарядний пристрій</h3>
              <div class="products-page__table-wrap">
                <table class="products-page__table">
                  <thead>
                    <tr>
                      <th>Модель</th>
                      <th>Вихід</th>
                      <th>Запас по струму</th>
                      <th>Орієнтовна ціна</th>
                    </tr>
                  </thead>
                  <tbody>${this.renderChargerRows()}</tbody>
                </table>
              </div>
            </div>

            <div class="products-page__block">
              <h3>4. Захист по постійному струму</h3>
              <div class="products-page__table-wrap">
                <table class="products-page__table">
                  <thead>
                    <tr>
                      <th>Позиція</th>
                      <th>Номінал</th>
                      <th>Запас по струму</th>
                      <th>Орієнтовна ціна</th>
                    </tr>
                  </thead>
                  <tbody>${this.renderProtectionRows()}</tbody>
                </table>
              </div>
            </div>
          </section>
        </ui-card>

        ${this.renderLiveSection()}

        <ui-card padding="md">
          <section class="products-page__section">
            <div class="products-page__section-head">
              <div class="products-page__title-row">
                <h2>Що ще варто додати до комплекту</h2>
                <ui-tooltip label="Пояснення" text="Додаткові позиції, які покращують надійність, контроль і зручність експлуатації."></ui-tooltip>
              </div>
            </div>
            <ui-disclosure label="Подивитися додаткові позиції">
              <div class="products-page__optional-grid">${this.renderOptionalItems()}</div>
            </ui-disclosure>
          </section>
        </ui-card>
      </section>
    `;
  }

  afterRender() {
    const refreshButton = this.shadowRoot.querySelector('[data-live-refresh]');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.scheduleLiveSearch(true));
    }

    this.shadowRoot.querySelectorAll('img[data-image-fallback]').forEach((img) => {
      const wrap = img.closest('[data-fallback-wrap]');
      if (!wrap) return;

      const ensureFallback = () => {
        wrap.classList.add('is-fallback');
      };

      img.addEventListener('error', ensureFallback, { once: true });

      if (img.complete && img.naturalWidth === 0) {
        ensureFallback();
      }
    });
  }
}

customElements.define('products-page', ProductsPage);

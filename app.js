'use strict';

const { weeks, guideHtml } = window.RECIPE_DATA;
const get = (id) => document.getElementById(id);
const storageKey = 'wuwei-recipes-selection-v1';
const weekdays = '一二三四五六日';

function make(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

let weekIndex = 0;
let dayIndex = 0;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && Number.isInteger(saved.week) && weeks[saved.week]?.days[saved.day]) {
    weekIndex = saved.week;
    dayIndex = saved.day;
  }
} catch {
  // Browsing works in contexts where local storage is unavailable.
}

const weekButtons = weeks.map((week, index) => {
  const button = make('button', week.name);
  button.type = 'button';
  button.addEventListener('click', () => selectDay(index, dayIndex));
  return button;
});
get('week-tabs').append(...weekButtons);

const dayButtons = [...weekdays].map((weekday, index) => {
  const button = make('button');
  button.type = 'button';
  button.setAttribute('aria-label', '星期' + weekday);
  button.append(make('span', '星期' + weekday, 'wide'), make('span', weekday, 'short'));
  button.addEventListener('click', () => selectDay(weekIndex, index));
  return button;
});
get('day-tabs').append(...dayButtons);
const overview = get('overview');
const overviewButtons = [...weekdays].map((weekday, index) => {
  const button = make('button');
  button.type = 'button';
  button.append(make('span', '星期' + weekday, 'overview-day'), make('span', '', 'overview-names'));
  button.addEventListener('click', () => selectDay(weekIndex, index));
  overview.append(button);
  return button;
});

function ingredientLine(label, text) {
  const line = make('span', undefined, 'ingredient-line');
  line.append(make('strong', label), make('span', text));
  return line;
}

function recipeCard(recipe, label = recipe.steps.length + ' 步') {
  const details = make('details', undefined, 'recipe');
  const summary = make('summary');
  const heading = make('span', undefined, 'recipe-heading');
  heading.append(
    make('span', recipe.name, 'recipe-title'),
    make('span', label, 'recipe-meta'),
    ingredientLine('主料', recipe.mainIngredients),
    ingredientLine('配料', recipe.seasonings),
  );
  summary.append(heading);
  const instructions = make('ol', undefined, 'steps');
  instructions.append(...recipe.steps.map((step) => make('li', step)));
  const body = make('div', undefined, 'recipe-body');
  body.append(
    make('h3', '做法'),
    instructions,
  );
  details.append(summary, body);
  return details;
}

function renderDay() {
  const week = weeks[weekIndex];
  const day = week.days[dayIndex];
  weekButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === weekIndex)));
  dayButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === dayIndex)));
  overviewButtons.forEach((button, index) => {
    button.setAttribute('aria-current', String(index === dayIndex));
    button.lastElementChild.textContent = week.days[index].recipes.map((recipe) => recipe.name).join('、');
  });
  get('day-week').textContent = week.name;
  get('day-title').textContent = day.name;
  get('day-meta').textContent = day.recipes.length + ' 道菜 · 约 ' + day.duration;
  const order = get('cooking-order');
  order.hidden = !day.order;
  if (day.order) order.replaceChildren(make('strong', '下锅顺序'), document.createTextNode(day.order));
  get('recipes').replaceChildren(...day.recipes.map((recipe) => recipeCard(recipe)));
}

function selectDay(week, day) {
  if (week === weekIndex && day === dayIndex) return;
  weekIndex = week;
  dayIndex = day;
  renderDay();
  try {
    localStorage.setItem(storageKey, JSON.stringify({ week, day }));
  } catch {
    // Selection remains usable for the current session.
  }
}
renderDay();

const catalogue = weeks.flatMap((week) => week.days.flatMap((day) =>
  day.recipes.map((recipe) => ({ recipe, label: week.name + ' · ' + day.name.slice(2) }))));
const search = get('search');
const clearSearch = get('clear-search');

function updateResults() {
  const query = search.value.trim().toLowerCase();
  const searching = Boolean(query);
  get('menu').hidden = searching;
  get('results').hidden = !searching;
  clearSearch.hidden = !search.value.length;
  if (!searching) return;
  const words = query.split(/\s+/);
  const matches = catalogue.filter(({ recipe }) => {
    const searchable = [recipe.name, recipe.mainIngredients, recipe.seasonings].join(' ').toLowerCase();
    return words.every((word) => searchable.includes(word));
  });
  get('result-count').textContent = matches.length
    ? '找到 ' + matches.length + ' 道菜'
    : '没有找到这道菜。试试只输入菜名的一部分或换一个食材。';
  get('result-list').replaceChildren(...matches.map(({ recipe, label }) => recipeCard(recipe, label)));
}

search.addEventListener('input', (event) => {
  if (!event.isComposing) updateResults();
});
search.addEventListener('compositionend', updateResults);
get('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  updateResults();
  search.blur();
});
clearSearch.addEventListener('click', () => {
  search.value = '';
  updateResults();
  search.focus();
});

get('guide-content').innerHTML = guideHtml;
get('guide-button').addEventListener('click', () => get('guide-dialog').showModal());
get('install-button').addEventListener('click', () => get('install-dialog').showModal());

async function prepareOffline() {
  const badge = get('offline-status');
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    if (location.protocol === 'file:') {
      badge.textContent = '离线文件';
      get('install-title').textContent = '离线文件';
      get('install-dialog').querySelector('.install-steps').hidden = true;
      get('install-note').textContent = '此文件含有完整菜谱，可以在支持运行网页脚本的浏览器里断网查看。';
    } else {
      badge.textContent = '局域网预览';
      get('install-title').textContent = '局域网预览';
      get('install-dialog').querySelector('.install-steps').hidden = true;
      get('install-note').textContent = '现在可以浏览完整菜谱。要在 iPhone 上离线使用，请在 Mac 的启动器里选择 HTTPS 离线安装。';
    }
    return;
  }

  let timer;
  try {
    badge.textContent = '正在准备离线';
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    } else if (navigator.onLine) {
      registration.update().catch(() => {});
    }
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Cache preparation timed out')), 15000);
      }),
    ]);
    badge.textContent = '可离线使用';
    get('install-button').dataset.ready = 'true';
  } catch {
    badge.textContent = '离线未就绪';
    get('install-note').textContent = '离线准备未完成。联网重新打开本页后再试。';
  } finally {
    clearTimeout(timer);
  }
}

prepareOffline();

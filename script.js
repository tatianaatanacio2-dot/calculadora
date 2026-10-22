const result = document.querySelector('#result');
const expressionDisplay = document.querySelector('#expression');
const angleMode = document.querySelector('#angle-mode');
const memoryIndicator = document.querySelector('#memory-indicator');
const historyPanel = document.querySelector('#history-panel');
const historyList = document.querySelector('#history-list');
let expression = '';
let lastAnswer = 0;
let memory = null;
let degrees = true;
let justEvaluated = false;
let history = loadHistory();

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('berry-calculator-history') || '[]').slice(0, 12); }
  catch { return []; }
}
function saveHistory() {
  try { localStorage.setItem('berry-calculator-history', JSON.stringify(history.slice(0, 12))); } catch { /* Storage may be unavailable. */ }
}
function pretty(value) {
  if (!Number.isFinite(value)) return 'Error';
  if (Object.is(value, -0)) value = 0;
  return new Intl.NumberFormat('es-CO', { maximumSignificantDigits: 11 }).format(value);
}
function update() {
  expressionDisplay.textContent = expression ? prettyExpression(expression) : '0';
  if (expression) {
    try { result.textContent = pretty(evaluate(expression)); }
    catch { result.textContent = justEvaluated ? pretty(lastAnswer) : '…'; }
  } else result.textContent = '0';
  memoryIndicator.textContent = memory === null ? '' : 'M';
}
function prettyExpression(value) {
  return value.replaceAll('*', '×').replaceAll('/', '÷').replaceAll('-', '−');
}
function factorial(n) {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error('Dominio');
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}
function tokenize(source) {
  const tokens = [];
  const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?|([a-zA-Z]+|π)|(.))/gy;
  let cursor = 0;
  while (cursor < source.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) throw new Error('Expresión inválida');
    cursor = pattern.lastIndex;
    if (match[1] !== undefined) tokens.push({ type: 'number', value: Number(match[1] + (match[2] ? `e${match[2]}` : '')) });
    else if (match[3]) tokens.push({ type: 'name', value: match[3].toLowerCase() });
    else if (match[4]) tokens.push({ type: 'symbol', value: match[4] });
  }
  return tokens;
}
function evaluate(source) {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const accept = (value) => peek()?.value === value && (take(), true);
  const expect = (value) => { if (!accept(value)) throw new Error('Expresión incompleta'); };
  function primary() {
    if (accept('+')) return primary();
    if (accept('-')) return -primary();
    if (accept('(')) { const n = sum(); expect(')'); return n; }
    const token = take();
    if (!token) throw new Error('Falta un valor');
    if (token.type === 'number') return token.value;
    if (token.type === 'name') {
      if (token.value === 'π' || token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;
      if (token.value === 'ans') return lastAnswer;
      const value = primary();
      const toRad = (n) => degrees ? n * Math.PI / 180 : n;
      switch (token.value) {
        case 'sin': return Math.sin(toRad(value));
        case 'cos': return Math.cos(toRad(value));
        case 'tan': if (Math.abs(Math.cos(toRad(value))) < 1e-12) throw new Error('Indefinido'); return Math.tan(toRad(value));
        case 'asin': return (degrees ? 180 / Math.PI : 1) * Math.asin(value);
        case 'acos': return (degrees ? 180 / Math.PI : 1) * Math.acos(value);
        case 'atan': return (degrees ? 180 / Math.PI : 1) * Math.atan(value);
        case 'sqrt': return Math.sqrt(value);
        case 'ln': return Math.log(value);
        case 'log': return Math.log10(value);
        case 'abs': return Math.abs(value);
        default: throw new Error('Función desconocida');
      }
    }
    throw new Error('Expresión inválida');
  }
  function postfix() {
    let value = primary();
    while (true) {
      if (accept('!')) value = factorial(value);
      else if (accept('%')) value /= 100;
      else break;
    }
    return value;
  }
  function power() {
    const base = postfix();
    if (accept('^')) return base ** unary();
    return base;
  }
  function unary() {
    if (accept('+')) return unary();
    if (accept('-')) return -unary();
    return power();
  }
  function product() {
    let value = unary();
    while (peek() && ['*', '/', '×', '÷'].includes(peek().value)) {
      const op = take().value;
      const next = unary();
      value = op === '*' || op === '×' ? value * next : value / next;
    }
    return value;
  }
  function sum() {
    let value = product();
    while (peek() && ['+', '-'].includes(peek().value)) {
      const op = take().value;
      const next = product();
      value = op === '+' ? value + next : value - next;
    }
    return value;
  }
  const answer = sum();
  if (pos !== tokens.length || !Number.isFinite(answer)) throw new Error('Resultado fuera de rango');
  return answer;
}
function append(value) {
  if (justEvaluated && /^(?:[0-9.]|π|\()/.test(value)) expression = '';
  justEvaluated = false;
  expression += value;
  update();
}
function applyFunction(name) {
  if (justEvaluated) expression = `${name}(${expression})`;
  else expression += `${name}(`;
  justEvaluated = false;
  update();
}
function calculate() {
  if (!expression.trim()) return;
  try {
    const answer = evaluate(expression);
    const displayExpression = prettyExpression(expression);
    lastAnswer = answer;
    history.unshift({ expression: displayExpression, answer: pretty(answer) });
    history = history.slice(0, 12);
    saveHistory(); renderHistory();
    expression = String(Number(answer.toPrecision(12)));
    justEvaluated = true;
    update();
  } catch {
    result.textContent = 'Error';
  }
}
function setExpression(value) { expression = value; justEvaluated = false; update(); }
function handleAction(action) {
  switch (action) {
    case 'clear': setExpression(''); break;
    case 'delete': expression = expression.slice(0, -1); justEvaluated = false; update(); break;
    case 'equals': calculate(); break;
    case 'sign': expression = expression ? `-(${expression})` : '-'; justEvaluated = false; update(); break;
    case 'toggle-angle': degrees = !degrees; angleMode.innerHTML = `${degrees ? 'DEG' : 'RAD'} <span>⌄</span>`; angleMode.setAttribute('aria-label', `Cambiar a ${degrees ? 'radianes' : 'grados'}`); update(); break;
    case 'memory-clear': memory = null; update(); break;
    case 'memory-store': try { memory = evaluate(expression || String(lastAnswer)); update(); } catch { result.textContent = 'Error'; } break;
    case 'memory-add': try { memory = (memory ?? 0) + evaluate(expression || String(lastAnswer)); update(); } catch { result.textContent = 'Error'; } break;
    case 'memory-subtract': try { memory = (memory ?? 0) - evaluate(expression || String(lastAnswer)); update(); } catch { result.textContent = 'Error'; } break;
    case 'memory-recall': if (memory !== null) append(String(memory)); break;
  }
}
function renderHistory() {
  historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p'); empty.className = 'empty-history'; empty.textContent = 'Tus cálculos aparecerán aquí ✨'; historyList.append(empty); return;
  }
  history.forEach((item) => {
    const button = document.createElement('button'); button.className = 'history-item'; button.type = 'button';
    const expr = document.createElement('span'); expr.textContent = item.expression;
    const answer = document.createElement('strong'); answer.textContent = item.answer;
    button.append(expr, answer);
    button.addEventListener('click', () => { setExpression(String(Number(item.answer.replaceAll('.', '').replace(',', '.')))); historyPanel.hidden = true; });
    historyList.append(button);
  });
}
document.querySelector('.keypad').addEventListener('click', (event) => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.action) handleAction(button.dataset.action);
  else if (button.dataset.function) applyFunction(button.dataset.function);
  else if (button.dataset.value) append(button.dataset.value);
});
document.querySelector('.memory-row').addEventListener('click', (event) => {
  const button = event.target.closest('button'); if (button) handleAction(button.dataset.action);
});
angleMode.addEventListener('click', () => handleAction('toggle-angle'));
document.querySelector('#history-toggle').addEventListener('click', () => { historyPanel.hidden = !historyPanel.hidden; renderHistory(); });
document.querySelector('#clear-history').addEventListener('click', () => { history = []; saveHistory(); renderHistory(); });
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^\d$/.test(event.key)) append(event.key);
  else if (event.key === '.' || event.key === ',') append('.');
  else if (event.key === '+') append('+');
  else if (event.key === '-') append('-');
  else if (event.key === '*') append('*');
  else if (event.key === '^') append('^');
  else if (event.key === '/') { event.preventDefault(); append('/'); }
  else if (event.key === '(' || event.key === ')') append(event.key);
  else if (event.key === '%') append('%');
  else if (event.key === '!') append('!');
  else if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
  else if (event.key === 'Backspace') handleAction('delete');
  else if (event.key === 'Escape') { if (!historyPanel.hidden) historyPanel.hidden = true; else handleAction('clear'); }
});
renderHistory(); update();





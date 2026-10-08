# Перевірки гри

Потрібні Node.js, Playwright та Chromium/Chrome. Ніякого сервера для самої гри не потрібно: тест запускає тимчасовий локальний сервер.

```powershell
# Якщо Playwright доступний у стандартному node_modules:
node tests/foundations.cjs
node tests/world.cjs
node tests/preparation.cjs
node tests/combat.cjs
node tests/journey.cjs

# Або вказати встановлені залежності та браузер:
$env:DNT_NODE_MODULES='C:/path/to/node_modules'
$env:DNT_BROWSER='C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/foundations.cjs
```

Сценарії перевіряють справжній index.html, його import map і ланцюг модулів. Використовують окремий браузерний профіль: реальні користувацькі сейви не зачіпають. Ненульовий exit code означає невдалу перевірку.

`world` перевіряє дослідження, день/ніч, всі шість характеристик, стан потреб і розділення запасів Степана та Євпапія. `preparation` — першу прокачку, альтернативи без грошей, разові припаси, повний рюкзак і проходження нового епізоду через кнопки гри. `combat` — відмінність ціни бою через підготовку й довіру, доступні дії при втомі та завантаження під час сюжетного нокауту.

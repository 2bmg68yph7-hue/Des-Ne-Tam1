# Перевірки гри

Потрібні Node.js, Playwright та Chromium/Chrome. Ніякого сервера для самої гри не потрібно: тест запускає тимчасовий локальний сервер.

```powershell
# Якщо Playwright доступний у стандартному node_modules:
node tests/foundations.cjs

# Або вказати встановлені залежності та браузер:
$env:DNT_NODE_MODULES='C:/path/to/node_modules'
$env:DNT_BROWSER='C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/foundations.cjs
```

Сценарії перевіряють справжній index.html, його import map і ланцюг модулів. Використовують окремий браузерний профіль: реальні користувацькі сейви не зачіпають. Ненульовий exit code означає невдалу перевірку.

# Metrics Dashboard — Implementation Plan (Frontend)

Frontend-часть единого плана [`METRICS._implementation-plan.md`](../../METRICS._implementation-plan.md) в корне проекта — туда читать общую архитектуру и контракты. Здесь — конкретно по коду `megaapp-front`.

## Как сейчас

- `src/app/services/network.service.ts` — WebSocket-клиент: подключение к `/api/ws` с токеном в URL, reconnect с backoff, входящие сообщения текут через `wsMessages$: Subject<IncomingWsMessage>`.
- `src/app/services/food/food-diary.service.ts` (`subscribeToRealtimeUpdates`, ~строка 928) — эталонный паттерн подписки: `switch` по `WebSocketMessageType`, type-guard на payload, отдельный handler-метод на каждый тип. `SYNC_STATUS` (`userDataLastModifiedTs`) — уже существующий курсорный механизм, на него и ориентироваться для метрик.
- Графики: `chart.js` v4.4.1, готовые конфиги в `src/app/shared/chart-config.ts` (weight/kcals/balance/income/expense), эталонный компонент-потребитель — `src/app/components/money/balances-chart/balances-chart.ts`.
- Локальный кэш: `src/app/services/local-storage.service.ts` + `cache.ts` (`buildCacheKey` с версией схемы, `purgeStaleCacheVersions`), `food-base.service.ts` оборачивает это в `saveToLocalStorage`/`loadFromLocalStorage`. Это и есть готовая инфраструктура для скользящего окна, отдельный механизм кэширования не нужен.
- Админ: `UserSettings.isUserAdmin?: boolean` (`types.ts:239`) — поле есть в типах с TODO-комментарием, но не приходит реально с бэка (бэк его не отдаёт, см. backend-план) и не используется ни в одном guard/`@if`. По факту — заглушка без эффекта.
- `AuthService` (`auth.service.ts`) — единственное место, владеющее identity/session: `sessionState$$`/`isAuthenticated$$` сигналы, токены в `localStorage`. `bootstrap()` (вызывается через `ensureBootstrapped()` на старте приложения, до отрисовки основного UI) дёргает `GET /api/auth/verify`, но **полностью игнорирует тело ответа** — ждёт только успешный статус. `login()` читает тело `AuthResponse` (`accessToken`/`refreshToken`), `refreshToken()` аналогично. Бэк на `/api/auth/verify` уже отдаёт `{authenticated, userId, username}` в JSON (`internal/auth/http.go`), просто фронт это не читает.

## Как должно быть

Два независимых канала с разным жизненным циклом (см. backend-план, Этап 2) — фронт зеркалит это двумя независимыми сервисами, не одним:

- **Health (всегда активен для админа, лёгкий)**:
  - Новый входящий тип `WebSocketMessageType.METRICS_HEALTH` в `types.ts`.
  - `metrics-health.service.ts`: подписка на `networkService.wsMessages$` сразу при создании сервиса (по факту — на весь сеанс, как только пользователь залогинен как админ), хранение последнего статуса (ok/warn/error) в сигнале. Никакой подписки/отписки не требует — сервер сам решает слать или нет, основываясь на `isAdmin`.
  - Компонент-виджет в сайдбаре (зелёная/жёлтая/красная точка), читает сигнал из `metrics-health.service.ts`, виден везде, не зависит от текущей страницы.
- **Detail (по подписке на странице дашборда, тяжёлый)**:
  - Новые типы: входящий `METRICS_UPDATE`, исходящие `METRICS_SUBSCRIBE` (несёт курсор — timestamp последнего полученного bucket) / `METRICS_UNSUBSCRIBE`.
  - `metrics.service.ts` по образцу `food-diary.service.ts`: обработка `METRICS_UPDATE`, хранение state в сигнале.
  - Подписка отправляется через существующий `networkService.sendMessage(...)` при входе на страницу дашборда (`ngOnInit`/инициализация компонента) и отзывается (`METRICS_UNSUBSCRIBE`) при выходе со страницы (`ngOnDestroy`).
  - Переподписка при реконнекте: подписаться на переход `networkService.isConnected$$` в `true` (через `effect`/`toObservable`) и, если страница дашборда всё ещё открыта, повторно отправить `METRICS_SUBSCRIBE` с тем же курсором — отдельный таймер "подтверди интерес" не нужен (см. backend-план: эта проверка живости уже целиком на стороне `ws.Hub`).
  - Кэш — скользящее окно 24–48ч одним JSON-блобом через уже существующий `LocalStorageService`/`cache.ts` (та же версионируемая `buildCacheKey`), полная перезапись при каждом обновлении. Глубже история — обычный HTTP-запрос диапазона.
  - Графики — новые записи в `chart-config.ts` по аналогии с `balance`/`income`, новый компонент-дашборд по образцу `balances-chart.ts`.
- **Доступ известен заранее, ещё до открытия страницы метрик** — без новой инфраструктуры, на базе уже существующего `AuthService`:
  - Новый сигнал `isAdmin$$` прямо на `AuthService`, рядом с `sessionState$$`/`isAuthenticated$$` — отдельный сервис под одно поле не нужен.
  - `bootstrap()` начинает читать тело ответа `/api/auth/verify` (сейчас оно игнорируется) и выставлять `isAdmin$$` из поля `isAdmin`. Раз `ensureBootstrapped()` уже awaitится на старте приложения до рендера основного UI — `isAdmin$$` гарантированно известен раньше, чем отрисуется хоть один компонент, в том числе кнопка метрик. Это и закрывает требование "знать заранее, до всяких запросов".
  - `login()`/`refreshToken()` — `AuthResponse` (`types.ts`) получает новое поле `isAdmin: boolean`, оба места тоже проставляют `isAdmin$$` сразу по ответу, не дожидаясь отдельного `verify`.
  - `terminateSession()` сбрасывает `isAdmin$$` в `false` вместе с остальным сессионным state.
  - Использование — `@if (authService.isAdmin$$())` в сайдбар-виджете и в пункте меню/роуте дашборда. Без отдельной route-guard инфраструктуры, текущий масштаб задачи (один булевый флаг) её не требует.
- **Сознательно не делаем через cookies (в т.ч. httpOnly).** Любой флаг, который JS использует для решения "что рисовать", по определению читаем тем же JS — значит, спуфится в любом хранилище (переменная/сигнал/localStorage/обычная кука) одинаково легко через консоль браузера, это не специфика конкретного хранилища. `httpOnly`-кука нечитаема из JS вообще, а значит не может использоваться для рендер-решения — противоречие. Защита от спуфинга `isUserAdmin` на фронте и не нужна: реальная защита данных — на бэке (рассылка по known admin userID, см. выше), спуфинг флага на фронте даёт максимум пустой дашборд в своём же аккаунте, чужих данных не открывает. Это стандартный паттерн (GitHub/GitLab/AWS console): флаг с бэка → `@if` для UI, проверка прав — на каждом запросе на сервере.

## Отклонения от плана, найденные в процессе реализации

- **Route guard инфраструктура уже существует** (`auth.guard.ts`, `is-chapter-selected.guard.ts`) — раннее "без отдельной route-guard инфраструктуры" было неверно: это уже идиоматичный паттерн в проекте (`CanActivateFn`), не лишняя сложность. Добавлен `admin-only.guard.ts` по тому же образцу, маршрут `/metrics` гейтится через `[authGuard, settingsReadyGuard, adminOnlyGuard]`.
- Кнопка "Метрики" добавлена в `NavigationService.buttons` (новое поле `adminOnly?: boolean`, отфильтровывается в `prepButtons` по `authService.isAdmin$$()`) — обычный пункт меню, а не отдельная плитка.
- Health-виджет вставлен только в десктопный сайдбар (`navigation.html`, рядом с кнопкой свёртывания), не в мобильное меню — мобильный вариант не реализован в этой итерации, чисто по нехватке отдельного подходящего места в текущей мобильной раскладке.

## To-Do

### Этап 2: Доставка на фронт — ✅ готово
- ✅ `isAdmin: boolean` в `AuthResponse`/`VerifyResponse` (`types.ts`), `isAdmin$$` сигнал на `AuthService`.
- ✅ `bootstrap()` читает тело `/api/auth/verify` и проставляет `isAdmin$$`; `login()`/`refreshToken()` — аналогично; `terminateSession()` сбрасывает в `false`.
- ✅ `METRICS_HEALTH`, `METRICS_UPDATE` (входящие) и `METRICS_SUBSCRIBE`/`METRICS_UNSUBSCRIBE` (исходящие) в `WebSocketMessageType` + типы payload (`MetricPoint`, `MetricsHealthStatus`).
- ✅ `metrics-health.service.ts` + `metrics-health-dot` компонент в сайдбаре.
- ✅ `metrics.service.ts`: `subscribe()`/`unsubscribe()`, обработка `METRICS_UPDATE`, переподписка на реконнект через `effect` на `isConnected$$`.
- ✅ Кэш скользящего окна через `LocalStorageService.getUserScoped`/`setUserScoped` (ключ `metrics_detail`, добавлен в `USER_SCOPED_CACHE_BASE_KEYS`).
- ✅ `metrics-dashboard` компонент (маршрут `/metrics`) + `METRICS_CHART_CONFIG`/`METRICS_SERIES_PALETTE` в `chart-config.ts`, рендер по образцу `balances-chart.ts` (chart.js line chart, один датасет на метрику).
- ✅ `adminOnlyGuard` на маршруте, `adminOnly`-фильтр в `NavigationService`, `@if (authService.isAdmin$$())` для виджета в сайдбаре.
- ✅ Проверено: `tsc --noEmit`, `ng build --configuration dev` (lazy chunk `metrics-dashboard` собирается отдельно), `prettier --check` — чисто. **Не проверено вручную в браузере** (нет запущенного бэка с реальными админ-данными в этой сессии) — перед использованием стоит открыть `/metrics` живым админом и убедиться, что график рисуется и health-точка обновляется.

Этап 1 (бэк-сборщик) и Этап 3 (внешний приём) — без участия фронта, см. backend-план.

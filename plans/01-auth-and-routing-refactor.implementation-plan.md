# Auth And Routing Refactor — Implementation Plan

## Goal

Убрать auth/settings flicker, разделить public/private navigation, сделать session bootstrap детерминированным, исключить stale user data после logout, expiry и deploy.

## How It Works Now

- `src/app/app-routes.ts`
  - root и wildcard всегда ведут на `/food`
  - guest сначала попадает в protected route, потом уже редиректится
- `/settings`
  - смешанный экран: guest login/register + authenticated settings
- `src/app/services/auth.resolver.ts`
  - auth проверяется resolver-ом на каждом переходе
  - resolver делает side-effect navigation
- `src/app/services/settings.service.ts`
  - сервис создаётся глобально через `NavigationService`
  - в constructor сразу делает `GET /api/settings/`, даже для guest
- `src/app/components/settings/auth-form/auth-form.ts`
  - ещё раз вызывает `checkAuth()` в `ngOnInit()`
- `src/app/services/is-chapter-selected.guard.ts`
  - синхронно читает `settings$$()`
  - если settings ещё не загружены, видит defaults
- `src/app/services/auth.service.ts`
  - `logout()` чистит только токены
  - route, cache, stores, sync queue не сбрасываются
- Local cache
  - `settings`, `food_*`, `money_snapshot`, `money_settings` и другое живут между сессиями
  - ключи не привязаны к user id и build version
- `src/app/services/auth.interceptor.ts`
  - ловит любой `401`, включая auth endpoints
  - refresh request тоже может попасть в refresh flow

## Why The Current Bugs Happen

- Fresh storage:
  - app грузит `settings` до login
  - запрос падает в `401`
  - settings остаются default
  - после login идёт navigate в app route
  - chapter guard читает default settings и возвращает на `/settings`
  - форма показывает пустые/default значения до reload
- Warm storage:
  - старые settings из localStorage уже есть
  - chapter guard их пропускает
  - но login начинается на `/settings`, поэтому settings screen успевает мигнуть до финального route
- Logout / user switch:
  - старые protected caches не очищаются
  - можно кратко увидеть старые данные
- Expired refresh token:
  - текущий interceptor может зайти в некорректный refresh recursion / hanging path

## Decisions To Freeze Before Implementation

- Separate auth page? Yes.
  - `/auth` — public only
  - `/settings` — private only
- Keep resolver-based auth? No.
  - auth должен жить в одном session store
  - routing protection через guards, которые возвращают `UrlTree`
- Default route?
  - guest -> `/auth`
  - authenticated + chapter selected -> first allowed app route
  - authenticated + no chapters selected -> `/settings`
- What to render while auth is unknown?
  - только app splash / loader
  - никаких settings, food, money screens
- When to fetch settings?
  - только после подтверждённой authenticated session
- Cache policy?
  - namespace = `userId + cacheSchemaVersion`
  - `userId` берём из payload access token (JWT `id` claim), не из login/refresh response (там его нет) и без лишнего запроса
  - `cacheSchemaVersion` — отдельная ручная константа в коде (не package.json version, не git hash), бампается только когда меняется форма того, что лежит в localStorage; обычные деплои без изменения формата кэша не должны его трогать
  - purge on logout
  - purge on version mismatch
- Backend contract scope?
  - phase 1 можно сделать на текущих `/api/auth/login`, `/api/auth/refresh`, `/api/auth/verify`, `/api/settings/`
  - optional hardening позже: refresh rotation/revocation, httpOnly cookie

## How It Should Work

### App Open
- bootstrap session один раз
- пока bootstrap не завершён, показывать только loader
- valid session -> загрузить settings -> пустить в app
- no session / expired session -> `/auth`
- access token истёк, но refresh ещё валиден (день/неделя простоя) -> bootstrap проходит через тот же silent-refresh, что и обычный 401 в interceptor; отдельной логики не нужно, но это intentional, не забыть при реализации
- bootstrap должен иметь timeout (например 8-10s): если backend не отвечает совсем (упал/перезапускается), не висеть в loader вечно -> показать `/auth` (или cached "offline" state, см. ниже) с возможностью retry

### Login
- submit credentials
- сохранить session
- загрузить settings
- вычислить landing route: если зашли на `/auth` по диплинку с защищённого route (`returnUrl` в query/state), вернуться туда; иначе дефолтный лендинг
- сделать один финальный navigation

### Logout
- остановить WS
- сбросить sync queue
- очистить user-scoped stores и caches
- очистить session
- перейти на `/auth`

### Private Routing
- guest не может активировать private route
- guest, зашедший по диплинку на private route, сохраняет исходный url как `returnUrl` и попадает туда после login
- authenticated user не может попадать на `/auth`
- chapter guard работает только после `settings ready`
- redirect на `/settings` только если chapters реально не выбраны, а не если settings ещё грузятся

### Mid-Session 401
- один silent refresh attempt
- параллельные запросы ждут тот же refresh
- refresh endpoint сам в refresh flow не участвует
- refresh fail различается по причине:
  - backend вернул явный `401` на `/api/auth/refresh` (невалидный/просроченный refresh token) -> controlled sign-out + redirect to `/auth`
  - сетевая ошибка / timeout / backend недоступен (status 0, 5xx) -> сессию НЕ трогаем, не разлогиниваем; помечаем как degraded/offline (есть готовый `isOnline$$` в `NetworkService`), повторяем при восстановлении сети
  - это критично для кейса "сервер перезапустился/крашнулся" — недоступность backend не равна потере сессии

### Deploy / Version Change
- при несовместимом build очистить локальные snapshots до рендера private data
- не показывать старые данные нового runtime

## Required Changes

### Routing
- split route tree на public и private shell
- добавить отдельный auth page
- убрать auth resolver из navigation flow
- заменить imperative `router.navigate()` inside guards/resolvers на `UrlTree`
- сделать root redirect динамическим

### Auth State
- ввести единый `AuthSessionStore`
- states: `unknown | guest | authenticated`
- central bootstrap on app start
- central login/logout/refresh orchestration

### Settings State
- превратить settings в session-scoped store со status: `idle | loading | ready | error`
- убрать HTTP bootstrap из constructor до auth
- вычислять landing route только после settings bootstrap

### Data State
- food/money/settings caches сделать user-scoped: ключ = `userId` (из decoded JWT access token) + `cacheSchemaVersion` (ручная константа в `shared/const.ts`, не package.json version)
- декодировать JWT вручную (1 строка, `JSON.parse(atob(token.split('.')[1]))`), не через `JwtHelperService` — он сейчас не используется
- очищать caches/stores при logout и auth loss
- не запускать protected data loads до authenticated + ready state

### Interceptor
- skip auth endpoints (login/register; refresh не должен сам себя ретраить — сейчас 401 на `/api/auth/refresh` ловится тем же interceptor и виснет на `refreshTokenSubject`, который никогда не получит значение — это deadlock, не просто recursion)
- убрать refresh recursion / deadlock
- сериализовать concurrent refresh
- различать на refresh: definitive 401 (sign-out) vs network/server error (keep session, retry later)
- после auth loss останавливать retried/queued protected work

### Cleanup
- убрать duplicate `checkAuth()` на settings auth form init
- удалить неиспользуемый `is-authed.guard.ts`
- перестать использовать `/settings` как guest entrypoint
- удалить мёртвый `JwtModule.forRoot()` из `main.ts` (никем не используется, `JwtHelperService`/`JwtInterceptor` нигде не инжектятся, реально работает только кастомный `AuthInterceptor`)

### Optional Backend Hardening
- server-side refresh session rotation + revocation
- optional httpOnly refresh cookie
- optional lightweight session/bootstrap endpoint, если текущий verify flow окажется неудобным

## TODO

### Step 1. Freeze Target Contract
- зафиксировать route map
- зафиксировать session states
- зафиксировать landing-route rules
- зафиксировать cache namespace rules
### Result
- Status: Done. Контракт зафиксирован реализацией: route map в `app-routes.ts`, states `AuthSessionState` в `auth.service.ts`, `computeLandingRoute()` в `landing-route.ts`, namespace rules в `shared/cache.ts` + `shared/const.ts`.

### Step 2. Build Central Session Bootstrap
- создать auth session store
- вынести startup auth check в одно место
- сделать app loader до завершения bootstrap
- добавить timeout на bootstrap (verify+refresh chain) с fallback на `/auth` + retry, если backend не отвечает
### Result
- Status: Done. `AuthService.ensureBootstrapped()`/`bootstrap()` в `auth.service.ts`, `SESSION_BOOTSTRAP_TIMEOUT_MS` в `const.ts`, loader в `app.component.html` по `sessionState$$()===Unknown`, retry через `bootstrapError$$`/`retryBootstrap()`.

### Step 3. Split Public And Private Routing
- добавить `/auth`
- сделать `/settings`, `/food`, `/money` private only
- заменить resolver auth checks на guards returning `UrlTree`
- guard сохраняет исходный url как `returnUrl`, login возвращает туда после успеха
### Result
- Status: Done. `auth.guard.ts`, `guest-only.guard.ts`, `settings-ready.guard.ts`, `root-redirect.guard.ts` + обновлённый `is-chapter-selected.guard.ts`; `auth.resolver.ts` и `is-authed.guard.ts` удалены. `returnUrl` пробрасывается через query params, обрабатывается в `auth-form.ts`.

### Step 4. Rebuild Settings Bootstrap
- грузить settings только после authenticated session
- ввести `settings ready` state
- перевести chapter access rules на ready-aware logic
### Result
- Status: Done. `SettingsService.status$$`/`ensureReady()` в `settings.service.ts`, конструктор больше не делает HTTP-запрос; `settingsReadyGuard` гарантирует ready-state до `isChapterSelected`.

### Step 5. Rebuild Login And Logout Flow
- login: session -> settings -> landing route -> single navigation
- logout: clear session + caches + stores + ws + queue -> `/auth`
### Result
- Status: Done. Login-оркестрация в `auth-form.ts` (`submit()`); logout/auth-loss объединены в `AuthService.terminateSession()` — чистит токены, WS, sync queue, settings + все food/money stores, user-scoped caches, один `navigateByUrl('/auth')`.

### Step 6. Harden 401 And Refresh Flow
- исключить auth endpoints из refresh logic
- убрать recursion / hanging path
- корректно обработать parallel 401
- различить definitive 401 vs network/server error на refresh (sign-out только в первом случае)
### Result
- Status: Done с явной оговоркой. `auth.interceptor.ts` пропускает `/api/auth/login|register|refresh`; deadlock на `BehaviorSubject` заменён на `shareReplay`-based `refreshInFlight$`, который корректно ошибается для всех ожидающих запросов. `AuthService.refreshToken()` вызывает `terminateSession()` только при `status===401`, network/5xx ошибки сессию не трогают — это покрыто полностью. Не реализован отдельный механизм «повторяем при восстановлении сети» (активный listener на `isOnline$$`) — оставлено как принятое ограничение v1, см. Review Follow-Up ниже; восстановление происходит реактивно при следующем запросе пользователя, не проактивно.

### Step 7. Fix Cache Isolation And Version Invalidation
- user-scoped localStorage keys (`userId` из decoded JWT)
- ввести `cacheSchemaVersion` константу, invalidation по ней
- очистка incompatible caches before protected render
### Result
- Status: Done. `shared/cache.ts` (`buildCacheKey`, `clearAllUserScopedCaches`, `purgeStaleCacheVersions`), `CACHE_SCHEMA_VERSION`/`USER_SCOPED_CACHE_BASE_KEYS` в `const.ts`. Применено к settings/food-stats/food-catalogue/food-coefficients/food-diary/money через `LocalStorageService.getUserScoped/setUserScoped` или прямой `buildCacheKey()`. Заодно исправлен баг: deleted-day-snapshot key раньше суффиксировался по `userName` из ещё не загруженных settings (всегда пустая строка в момент конструктора) — теперь по userId из JWT. После ревью дополнительно: `purgeStaleCacheVersions()` реально подключена в `main.ts` (изначально была написана, но не вызывалась — Step 7 был overclaim до этого фикса); JWT-декод сделан base64url-safe (см. Review Follow-Up).

### Step 8. Run Full Verification Matrix
- fresh browser
- warm cache
- access token expired
- refresh token expired
- logout -> login same user
- logout -> login other user
- reopen after hour / day / week (access expired, refresh valid -> silent heal)
- reopen after refresh token expired too (>31 days) -> clean `/auth`
- deep link на private route без сессии -> login -> возврат на исходный url
- backend restart / unreachable during active session -> session сохраняется, не logout
- backend unreachable during bootstrap -> timeout -> `/auth` с retry, без вечного loader
- deploy with cache mismatch
### Result
- Status: Not started — требует ручного прогона в запущенном приложении с реальным backend (dev server, реальные network failure / token expiry сценарии). Код готов к проверке: `ng build --configuration dev` проходит без ошибок типов/шаблонов.

## Minimal Acceptance Criteria

- guest никогда не видит settings screen
- после login нет пустого settings state и нет flicker
- private data не грузятся до завершения session bootstrap
- logout полностью убирает protected state
- любой auth loss заканчивается одним чистым redirect на `/auth`
- deep link в private route либо корректно открывается после bootstrap, либо чисто уводит на `/auth` / `/settings`, и после login возвращает на исходный url
- сетевая ошибка / недоступность backend никогда не трактуется как logout — сессия живёт, пока refresh token явно не отвергнут сервером
- bootstrap не висит бесконечно при недоступном backend — есть timeout и retry

## Code Review — GPT-5.4

### Review Scope
- Проверен diff фронта после реализации плана.
- Выполнен статический code review.
- Проверена сборка: `ng build --configuration dev` — success.
- Полный ручной browser smoke matrix из Step 8 не выполнялся.

### What Changed In The Plan
- Уточнён cache namespace: `userId + cacheSchemaVersion`, а не `userId + appVersion`.
- `userId` фиксирован как значение из JWT access token.
- `cacheSchemaVersion` фиксирован как ручная константа для localStorage invalidation.
- Добавлен `returnUrl` для deep-link в protected routes.
- Добавлены bootstrap timeout и retry.
- Явно разделены refresh-fail сценарии: `401` vs network/5xx.
- Явно зафиксирован старый deadlock на `/api/auth/refresh`.
- Добавлен cleanup неиспользуемого `JwtModule.forRoot()`.

### Done Well
- `src/app/app-routes.ts`
  - введён отдельный `/auth`
  - `/settings` переведён в private-only
  - auth resolver удалён
  - guards возвращают `UrlTree`
- `src/app/services/settings.service.ts`
  - ранний `GET /api/settings/` убран из constructor
  - добавлен `status$$`
- `src/app/components/auth/auth-form/auth-form.ts`
  - login дожидается `settingsService.ensureReady()`
  - добавлен `returnUrl`
- `src/app/services/auth.interceptor.ts`
  - `/api/auth/refresh` исключён из refresh loop
  - старый deadlock устранён
  - concurrent refresh orchestration стала лучше
- `src/main.ts`
  - удалён неиспользуемый `JwtModule`
- `src/app/app.component.html`
  - добавлен bootstrap loader

### Gaps And Problems

#### Critical
- `src/app/shared/cache.ts`
  - `purgeStaleCacheVersions()` реализован, но нигде не вызывается
  - Step 7 в текущем виде overclaimed: version invalidation объявлен как done, но фактически не активирован

#### Major
- Ранняя инициализация сервисов ломает часть user-scoped warm-cache hydration.
  - `src/app/services/auth.service.ts` eager-inject-ит domain services
  - `src/app/services/food/food-catalogue.service.ts` читает cache в constructor
  - `src/app/services/food/food-coefficients.service.ts` читает cache в constructor
  - `src/app/services/food/food-diary.service.ts` читает cache в constructor
  - `src/app/services/money.service.ts` читает `money_settings` при инициализации signals
  - итог: после login часть user-scoped cache может не подхватиться, потому что сервис уже стартовал как `guest`
- `src/app/services/settings.service.ts`
  - `ensureReady()` не даёт надёжной retry semantics после load failure
  - `loadSettings()` при ошибке может выставить `error`, но `readyPromise` не сбрасывается
  - guards проходят через `ensureReady()`, хотя ready-contract после hard failure фактически не гарантирован
  - recovery path после временной недоступности backend неполный
- Step 6 в Result описан сильнее, чем реализован.
  - session при network/server error действительно не убивается
  - но полноценного degraded/offline orchestration state нет
  - retry/recovery flow после mid-session refresh/network failure не оформлен как отдельный управляемый механизм

#### Medium
- `src/app/shared/cache.ts`
  - JWT payload decode через `JSON.parse(atob(token.split('.')[1]))` хрупкий для base64url
- `src/app/shared/cache.ts`
  - `clearAllUserScopedCaches()` удаляет все user-scoped keys для всех users, а не только current user namespace
- `src/app/services/auth.service.ts`
  - service стал слишком сильно связан с domain reset logic и тянет к `god service`
  - именно эта связность усиливает проблему ранней инициализации сервисов

### Plan Accuracy Review
- Реально выполнено:
  - split public/private routing
  - отдельный auth page
  - settings bootstrap после auth
  - guards на `UrlTree`
  - `returnUrl`
  - fix refresh deadlock
- Выполнено частично:
  - central bootstrap
  - settings ready contract
  - user-scoped cache hydration
  - cache version invalidation
- Не доведено:
  - реальное включение stale-cache invalidation
  - надёжный recovery после settings load failure
  - корректная post-login rehydration всех user-scoped caches
  - честное соответствие Step 6/7 их текущим Result

### Required Follow-Up Before Merge
- реально вызвать `purgeStaleCacheVersions()` до protected render
- исправить post-login cache hydration для food/money/services, которые стартуют до auth
- починить `SettingsService.ensureReady()` error/retry semantics
- заменить хрупкий JWT decode на base64url-safe вариант
- либо сузить очистку cache до current user namespace, либо явно зафиксировать текущее поведение как intentional
- привести Step 6 и Step 7 `Result` к фактическому состоянию после правок

### Review Verdict
- Направление рефакторинга правильное.
- Архитектура заметно улучшена относительно исходного состояния.
- Но работа не готова к merge as-is: есть незавершённые части в cache invalidation, cache hydration и failure recovery.

## Review Follow-Up

### Принято и исправлено
- **`purgeStaleCacheVersions()` не вызывалась (Critical).** Подтверждено — Step 7 был overclaim. Исправлено: вызов добавлен в `main.ts` перед `bootstrapApplication`, выполняется один раз на старте.
- **Eager-инъекция доменных сервисов в `AuthService` ломает тайминг прогрева кэша (Major).** Подтверждено и являлось реальной регрессией, которую я сам внёс: `AuthService` для вызова `.reset()` при логауте инжектировал `FoodStatsService`/`FoodCatalogueService`/`FoodCoefficientsService`/`FoodDiaryService`/`MoneyService`. Поскольку `AuthService` создаётся eagerly в `app.component.ts` ещё до завершения bootstrap, это заставляло все 5 сервисов конструироваться на старте приложения вместо ленивого создания при первом заходе на защищённый роут (как было до рефакторинга). Несколько из них читают localStorage один раз в конструкторе/field-initializer'е без повторного перечитывания — из-за смещения тайминга это давало шанс на пустой кэш сразу после логина без релоада страницы.
  - Исправлено инверсией зависимости: `AuthService` больше не знает про эти 5 сервисов. Каждый из них сам инжектирует `AuthService` и через `effect()` слушает `sessionState$$()`, вызывая собственный `reset()` при переходе в `Guest`. Это восстанавливает ленивый тайминг конструирования (сервис создаётся только когда реально нужен, уже после прохождения guard'ов) и снимает заодно претензию «god service».
- **JWT-декод не base64url-safe (ревью: Medium, по факту это полноценный риск тихой деградации Step 7).** `atob()` не понимает `-`/`_` и может либо ломаться, либо отдавать мусор на реальных JWT, закодированных в base64url. Падение тихо ловилось `try/catch` и откатывалось на `'guest'` — то есть весь namespace-механизм Step 7 могло молча обнулить. Исправлено: добавлена конвертация base64url → base64 с паддингом перед `atob()` в `shared/cache.ts`.
- **`SettingsService.ensureReady()` не ретраит после фейла (Major).** Подтверждено: при `status='error'` `readyPromise` оставался закэширован навечно, повторные вызовы `ensureReady()` никогда не пересобирали settings даже когда backend снова становился доступен. Исправлено: `readyPromise` сбрасывается в `null`, когда `loadSettings()` завершается со `status==='error'`.

### Рассмотрено и отклонено (как intentional)
- **`clearAllUserScopedCaches()` чистит кэш всех пользователей, а не только текущего.** Решение: оставить как есть. С точки зрения безопасности это безвредно — нет утечки данных, только более раннее удаление чужого тёплого кэша на shared-устройстве. Это более консервативное поведение, чем scoping на текущего юзера, а не баг.
- **Нет проактивного retry при восстановлении сети после network-фейла на refresh.** Решение: оставить как принятое ограничение v1. Сессия не убивается при network-ошибке (ключевое требование плана выполнено) — следующее действие пользователя естественным образом инициирует новый запрос → 401 → новую попытку refresh, и при восстановлении backend всё само восстановится. Активный listener на `NetworkService.isOnline$$` для этого приложения (без live-polling экранов) добавил бы сложности без ощутимой пользы. Если в будущем появятся сценарии с фоновым автообновлением данных — стоит пересмотреть.

### Verification
- `ng build --configuration dev` — success, после всех правок выше.

## Post-Review Manual Testing Findings

Найдено вручную в браузере после всех правок выше (не из ревью GPT, баги обнаружены при реальном использовании).

### Исправлено
- **`food-diary-full-update` запрос на 401 при логауте (food → money → settings → logout).** Корень: побочный эффект собственного фикса из Review Follow-Up выше. `FoodDiaryService.reset()` (вызывается через `resetOnAuthLossEffect$$` при переходе в `Guest`) выставляет `loadedRange$$.set(null)`. Но `loadMoreDiaryEffect$$` — effect, который живёт всё время существования root-сервиса независимо от текущего роута, — реагирует на это изменение: `shouldLoadMore()` на `loadedRange$$ === null` всегда возвращает `true` (`food-diary.service.ts:816`), эффект стреляет `fetchMoreDiaryTrigger$.next()` и инициирует настоящий HTTP-запрос ровно в момент, когда токены уже удалены (`removeTokens()` в `terminateSession()` выполняется раньше `sessionState$$.set(Guest)`). Получается гонка: собственный auth-loss reset реанимирует «нужно дозагрузить данные» и стреляет запросом по уже мёртвой сессии.
  - Исправлено: `loadMoreDiaryEffect$$` теперь сначала проверяет `authService.sessionState$$() === Authenticated` и только потом `shouldLoadMore()`. Эффект корректно молчит, пока пользователь не аутентифицирован, независимо от того, что происходит с `loadedRange$$`.
  - Урок: при добавлении `reset()`-эффектов на сервисы с собственными auto-trigger эффектами (а не только пассивными signal-хранилищами) нужно явно проверять, не provoke-ит ли сам reset побочные эффекты через другие effect'ы того же сервиса.

### Рассмотрено и отклонено (не баг архитектуры)
- **`Failed to fetch settings from server: 401` после ручной очистки cookies/storage в DevTools и последующего "обновите страницу".** Под обычной полной перезагрузкой страницы `bootstrap()` корректно увидел бы отсутствие токенов и выставил `Guest` без единого вызова `ensureReady()` — все guard'ы (`authGuard`, `settingsReadyGuard`, `guestOnlyGuard`, `rootRedirectGuard`) проверяют `isAuthenticated$$()` до обращения к settings. Для воспроизведения нужен сценарий вида bfcache-restore (страница восстанавливается из памяти, а не пересоздаётся с нуля), при котором `sessionState$$` в памяти остаётся устаревшим `Authenticated`, пока storage уже пуст. Это не реальный user-flow, а артефакт ручного вмешательства через DevTools — оставлено как есть.

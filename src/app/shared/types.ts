//                                                                           APP

//                                                                          AUTH

export interface UserCreds {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isAdmin: boolean;
}

export interface VerifyResponse {
  authenticated: boolean;
  userId: number;
  username: string;
  isAdmin: boolean;
}

//                                                                            WS

export enum WebSocketMessageType {
  PING = 'PING',
  SYNC_STATUS = 'SYNC_STATUS',
  DIARY_ENTRY_CREATED = 'DIARY_ENTRY_CREATED',
  DIARY_ENTRY_UPDATED = 'DIARY_ENTRY_UPDATED',
  DIARY_ENTRY_DELETED = 'DIARY_ENTRY_DELETED',
  DIARY_DAY_DELETED = 'DIARY_DAY_DELETED',
  BODY_WEIGHT_UPDATED = 'BODY_WEIGHT_UPDATED',
  START_VOICE_RECORDING = 'START_VOICE_RECORDING',
  AUDIO_CHUNK = 'AUDIO_CHUNK',
  STOP_VOICE_RECORDING = 'STOP_VOICE_RECORDING',
  SEARCH_QUERY = 'SEARCH_QUERY',
  SEARCH_RESULTS = 'SEARCH_RESULTS',
  CATALOGUE_ENTRY_SAVED = 'CATALOGUE_ENTRY_SAVED',
  CATALOGUE_IMAGE_GENERATED = 'CATALOGUE_IMAGE_GENERATED',
  METRICS_HEALTH = 'METRICS_HEALTH',
  METRICS_LATEST = 'METRICS_LATEST',
  METRICS_UPDATE = 'METRICS_UPDATE',
  METRICS_SUBSCRIBE = 'METRICS_SUBSCRIBE',
  METRICS_UNSUBSCRIBE = 'METRICS_UNSUBSCRIBE',
}

export interface PingWsMessage {
  type: WebSocketMessageType.PING;
}

export interface UserDataLastModifiedTs {
  userDataLastModifiedTs: number;
}

export interface SyncStatusWsMessage {
  type: WebSocketMessageType.SYNC_STATUS;
  payload: UserDataLastModifiedTs;
}

export interface DiaryEntryToCreate extends DiaryEntry {}

export interface DiaryEntryCreatedWsMessage {
  type: WebSocketMessageType.DIARY_ENTRY_CREATED;
  payload: DiaryEntryToCreate;
}

export interface DiaryEntryToUpdate {
  id: number;
  newFoodWeight: number;
  newHistoryEntry: HistoryEntry;
}

export interface DiaryEntryUpdatedWsMessage {
  type: WebSocketMessageType.DIARY_ENTRY_UPDATED;
  payload: DiaryEntryToUpdate;
}

export interface DiaryEntryToDelete {
  deletedDiaryEntryId: number;
}

export interface DiaryEntryDeletedWsMessage {
  type: WebSocketMessageType.DIARY_ENTRY_DELETED;
  payload: DiaryEntryToDelete;
}

export interface DiaryDayToDelete {
  dateISO: string;
}

export interface DiaryEntryToRestore {
  foodCatalogueId: number;
  foodWeight: number;
  history: HistoryEntry[];
}

export interface DiaryDayRestoreRequest {
  entries: DiaryEntryToRestore[];
}

export interface DeletedDiaryDaySnapshot {
  dateISO: string;
  entries: DiaryEntry[];
}

export interface DiaryDayDeletedWsMessage {
  type: WebSocketMessageType.DIARY_DAY_DELETED;
  payload: DiaryDayToDelete;
}

export interface BodyWeightToUpdate {
  dateISO: string;
  newBodyWeight: number;
}

export interface BodyWeightUpdatedWsMessage {
  type: WebSocketMessageType.BODY_WEIGHT_UPDATED;
  payload: BodyWeightToUpdate;
}

export interface StartVoiceRecordingWsMessage {
  type: WebSocketMessageType.START_VOICE_RECORDING;
}

export interface AudioChunkWsMessage {
  type: WebSocketMessageType.AUDIO_CHUNK;
  data: string;
  sequence: number;
}

export interface StopVoiceRecordingWsMessage {
  type: WebSocketMessageType.STOP_VOICE_RECORDING;
}

export interface SearchQueryWsMessage {
  type: WebSocketMessageType.SEARCH_QUERY;
  query: string;
  sequenceNumber: number;
}

export interface SearchResultsWsMessage {
  type: WebSocketMessageType.SEARCH_RESULTS;
  payload: {
    query: string;
    catalogueIds: number[];
    timestamp: number;
    sequenceNumber: number;
  };
}

export interface CatalogueEntrySavedWsMessage {
  type: WebSocketMessageType.CATALOGUE_ENTRY_SAVED;
  payload: CatalogueEntry;
}

export interface CatalogueImageGeneratedWsMessage {
  type: WebSocketMessageType.CATALOGUE_IMAGE_GENERATED;
  payload: {
    catalogueId: number;
    imageVersion: number;
  };
}

export type MetricsHealthSeverity = 'ok' | 'warn' | 'error';

export interface ServiceHealth {
  service: string;
  severity: MetricsHealthSeverity;
}

export interface MetricsHealthStatus {
  services: ServiceHealth[];
}

export interface MetricsHealthWsMessage {
  type: WebSocketMessageType.METRICS_HEALTH;
  payload: MetricsHealthStatus;
}

export interface ServiceLatest {
  service: string;
  lastBucket: number;
  metrics: Record<string, number>;
}

export interface MetricsLatestSnapshot {
  services: ServiceLatest[];
}

export interface MetricsLatestWsMessage {
  type: WebSocketMessageType.METRICS_LATEST;
  payload: MetricsLatestSnapshot;
}

export interface MetricPoint {
  service: string;
  name: string;
  bucket: number;
  value: number;
}

export interface MetricsUpdateWsMessage {
  type: WebSocketMessageType.METRICS_UPDATE;
  payload: { points: MetricPoint[] };
}

export interface MetricsSubscribeWsMessage {
  type: WebSocketMessageType.METRICS_SUBSCRIBE;
  cursor: number;
}

export interface MetricsUnsubscribeWsMessage {
  type: WebSocketMessageType.METRICS_UNSUBSCRIBE;
}

export type IncomingWsMessage =
  | PingWsMessage
  | SyncStatusWsMessage
  | DiaryEntryCreatedWsMessage
  | DiaryEntryUpdatedWsMessage
  | DiaryEntryDeletedWsMessage
  | DiaryDayDeletedWsMessage
  | BodyWeightUpdatedWsMessage
  | MetricsHealthWsMessage
  | MetricsLatestWsMessage
  | MetricsUpdateWsMessage
  | SearchResultsWsMessage
  | CatalogueEntrySavedWsMessage
  | CatalogueImageGeneratedWsMessage;

export type OutgoingWsMessage =
  | StartVoiceRecordingWsMessage
  | AudioChunkWsMessage
  | StopVoiceRecordingWsMessage
  | SearchQueryWsMessage
  | MetricsSubscribeWsMessage
  | MetricsUnsubscribeWsMessage;

//                                                                        SERVER

export interface ServerResponseBasic {
  result: boolean;
}

export interface ServerResponseWithData<T> extends ServerResponseBasic {
  data: T;
}

export interface ServerResponseWithMessage extends ServerResponseBasic {
  message?: string;
}

export interface ServerResponseWithDiaryId extends ServerResponseBasic {
  diaryId: number;
}

export interface ServerResponseWithDiaryEntries extends ServerResponseBasic {
  diaryEntries: DiaryEntry[];
}

export interface ServerResponseWithCatalogueEntry extends ServerResponseBasic {
  id?: number;
  name?: string;
  kcals?: number;
}

export interface ProductPreviewData {
  generalizedName: string;
  kcals: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  description: string;
  confidence: number;
}

export interface ServerResponseProductPreview extends ServerResponseBasic {
  data: ProductPreviewData;
}

export interface ProductSaveRequest {
  id?: number;
  name: string;
  kcals: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  description: string;
}

export interface ServerResponseProductSave extends ServerResponseBasic {
  data: {
    catalogueEntry: CatalogueEntry;
  };
  error?: string;
}

//                                                                      SETTINGS

export interface UserSettings {
  selectedChapterFood: boolean;
  selectedChapterMoney: boolean;
  darkTheme: boolean;
  liteVersion: boolean;
  height: number | null;
  userName: string;
  isUserAdmin?: boolean; // TODO[068]: Think of a better way to work with admin privileges
}

export enum KeyOfUserSettings {
  selectedChapterFood = 'selectedChapterFood',
  selectedChapterMoney = 'selectedChapterMoney',
  darkTheme = 'darkTheme',
  liteVersion = 'liteVersion',
  height = 'height',
  userName = 'userName',
  isUserAdmin = 'isUserAdmin',
}

export type SettingsChapterNames = 'selectedChapterFood' | 'selectedChapterMoney' | '';

export type LocalStorageSettings = UserSettings | null;

//                                                                       NAVBARS

//                                                                          FOOD

export interface DiaryEntry {
  id: number;
  dateISO: string;
  foodCatalogueId: number;
  foodWeight: number;
  history: HistoryEntry[];
}

export interface Diary {
  [dateISO: string]: {
    ['food']: {
      [id: number]: DiaryEntry;
    };
    ['bodyWeight']: number | null; // TODO[116]: Extract to a separate interface/signal
    ['nutrients']: {
      // TODO[116]: This too? 🤔
      targetKcals: number;
      targetProtein: number;
      targetFat: number;
      targetCarbs: number;
      targetFiber: number;
      consumedKcals: number;
      consumedProtein: number;
      consumedFat: number;
      consumedCarbs: number;
      consumedFiber: number;
    };
  };
}

export interface DiaryEntryWithFullData extends DiaryEntry {
  foodName: string;
  foodKcals: number;
  foodPercent: string;
  foodKcalPercentageOfDaysNorm: number;
}

export interface DayTotals {
  kcalsConsumed: number;
  kcalsPercent: number;
  bodyWeight: number | null;
  targetKcals: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  targetFiber: number;
  consumedProtein: number;
  consumedFat: number;
  consumedCarbs: number;
  consumedFiber: number;
}

export interface UnifiedDiary {
  [dateISO: string]: {
    food: DiaryEntryWithFullData[];
    totals: DayTotals;
  };
}

export enum HistoryEntryAction {
  INIT = 'init',
  SET = 'set',
  ADD = 'add',
  SUBTRACT = 'subtract',
}

export interface HistoryEntry {
  action: HistoryEntryAction;
  value: number;
}

export type CatalogueId = number;

export interface CatalogueEntry {
  id: number;
  name: string;
  legacyName?: string;
  kcals: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  description: string;
  imageVersion?: number;
  canDelete?: boolean;
}

export interface Catalogue {
  [id: number]: CatalogueEntry;
}

export interface Coefficients {
  [id: number]: number;
}

export interface NutrientDelta {
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export interface BodyWeightInterface {
  bodyWeight: string;
  dateISO: string;
}

//                                                                         STATS

export interface Stats {
  [id: string]: [number, number, number, number, boolean?];
}

export interface StatsChartData {
  dates: string[];
  weights: number[];
  weightsAvg: number[];
  kcalsFactual: number[];
  kcalsVirtual: number[];
  kcalsTarget: number[];
}

//                                                                         MONEY

export enum SymbolPosition {
  BEFORE = 'before',
  AFTER = 'after',
}

export interface Currency {
  id?: number;
  title: string;
  ticker: string;
  symbol: string;
  symbolPosEnum: SymbolPosition;
  whitespace: boolean;
}

export enum CategoryType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export interface Category {
  id?: number;
  name: string;
  parentId?: number | null;
  categoryType: CategoryType;
}

export enum AccountKind {
  CASH = 'cash',
  CARD = 'card',
  CHECKING = 'checking',
  DEPOSIT = 'deposit',
  BROKERAGE = 'brokerage',
  CRYPTO = 'crypto',
}

export interface Organization {
  id?: number;
  title: string;
  logoBase64?: string | null;
}

export interface Account {
  id?: number;
  title: string;
  currencyId: number;
  isInvest: boolean;
  isArchived: boolean;
  kind: AccountKind;
  organizationId?: number | null;
}

export enum AssetType {
  STOCK = 'stock',
  BOND = 'bond',
  CRYPTO = 'crypto',
}

export interface Asset {
  id?: number;
  title: string;
  ticker: string;
  type: AssetType;
  accountIds: number[];
  suspendedSince?: string | null;
  suspendedUntil?: string | null;
}

export enum TransactionKind {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  INVEST_BUY = 'invest_buy',
  INVEST_SELL = 'invest_sell',
  INVEST_DIVIDEND = 'invest_dividend',
}

export interface InvestAssetTrade {
  id: number;
  dateISO: string;
  accountId: number;
  amount: number;
  kind: TransactionKind.INVEST_BUY | TransactionKind.INVEST_SELL;
  notes?: string | null;
  detailsJSON?: any;
  assetId?: number | null;
  assetTitle?: string | null;
  assetTicker?: string | null;
  assetType?: AssetType | null;
}

export interface Transaction {
  id?: number;
  dateISO: string;
  accountId: number;
  amount: number;
  categoryId?: number | null;
  kind: TransactionKind;
  isGift: boolean;
  notes?: string;
  detailsJSON?: any;
  twinId?: number | null;
}

export interface MoneyRateHistory {
  id?: number;
  dateISO: string;
  ratesJson: Record<string, number> | string;
}

export interface BalanceChartAccountSeries {
  accountId: number;
  accountTitle: string;
  values: number[];
  suspendedValues: number[];
  isSuspended: boolean;
}

export interface BalanceChartData {
  dates: string[];
  totals: number[];
  accountSeries: BalanceChartAccountSeries[];
}

export interface IncomeChartCategorySeries {
  categoryId: number | null;
  categoryName: string;
  values: number[];
}

export interface DividendRow {
  dateISO: string;
  amount: number;
}

export interface PositionLotRow {
  status: 'closed' | 'open';
  assetType: AssetType | null;
  buyDateISO: string;
  sellDateISO: string | null;
  pnl: number | null;
  openMonths: string[];
}

export interface IncomeChartData {
  months: string[];
  categorySeries: IncomeChartCategorySeries[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
}

export interface ExpenseRow {
  period: string;
  categoryAmounts: Record<number, number>;
  total: number;
  uncategorizedAmount: number;
}

export interface ExpenseChartData {
  categories: ExpenseCategory[];
  monthRows: ExpenseRow[];
}

// export interface Notification {
//   id: number;
//   message: string;
//   bgColour: string;
//   textColour: string;
//   borderColour: string;
//   time: number;
// }

// export interface Transaction {
//   id: number;
//   date: string;
//   amount: number;
//   account_id: number;
//   category_id: number;
//   kind: string;
//   is_gift: boolean;
//   notes: string | null;
//   twin_transaction_id: number | null;
//   target_account_id: number | null;
//   target_account_amount: number | null;
// }

// export interface DateTimeFormatOptions {
//   weekday?: 'long' | 'short' | 'narrow';
//   month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
//   day?: 'numeric' | '2-digit';
// }

//                                                                            UI

export interface CapturedPhoto {
  file: File;
  dataUrl: string;
}

// export interface InputWithProgressSubmitData {
//   value: string;
//   resolve: () => void;
//   reject: () => void;
// }

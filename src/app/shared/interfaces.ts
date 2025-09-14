//                                                                           APP

export enum ScreenType {
  MOBILE = 'MOBILE',
  DESKTOP = 'DESKTOP',
}

//                                                                          AUTH

export interface UserCreds {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

//                                                                            WS

export enum WebSocketMessageType {
  PING = 'PING',
  SYNC_STATUS = 'SYNC_STATUS',
  DIARY_ENTRY_CREATED = 'DIARY_ENTRY_CREATED',
  DIARY_ENTRY_UPDATED = 'DIARY_ENTRY_UPDATED',
  DIARY_ENTRY_DELETED = 'DIARY_ENTRY_DELETED',
  BODY_WEIGHT_UPDATED = 'BODY_WEIGHT_UPDATED',
  START_VOICE_RECORDING = 'START_VOICE_RECORDING',
  AUDIO_CHUNK = 'AUDIO_CHUNK',
  STOP_VOICE_RECORDING = 'STOP_VOICE_RECORDING',
  SEARCH_QUERY = 'SEARCH_QUERY',
  SEARCH_RESULTS = 'SEARCH_RESULTS',
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
}

export interface SearchResultsWsMessage {
  type: WebSocketMessageType.SEARCH_RESULTS;
  payload: {
    query: string;
    catalogueIds: number[];
    timestamp: number;
  };
}

export type IncomingWsMessage =
  | PingWsMessage
  | SyncStatusWsMessage
  | DiaryEntryCreatedWsMessage
  | DiaryEntryUpdatedWsMessage
  | DiaryEntryDeletedWsMessage
  | BodyWeightUpdatedWsMessage
  | SearchResultsWsMessage;

export type OutgoingWsMessage =
  | StartVoiceRecordingWsMessage
  | AudioChunkWsMessage
  | StopVoiceRecordingWsMessage
  | SearchQueryWsMessage;

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

export interface ServerResponseWithCatalogueEntry extends ServerResponseBasic {
  id?: number;
  name?: string;
  kcals?: number;
}

//                                                                      SETTINGS

export interface Settings {
  selectedChapterFood: boolean;
  selectedChapterMoney: boolean;
  darkTheme: boolean;
  liteVersion: boolean;
  height: number | null;
  userName: string;
  isUserAdmin?: boolean; // TODO[068]: Think of a better way to work with admin privileges
}

export enum KeyOfSettings {
  selectedChapterFood = 'selectedChapterFood',
  selectedChapterMoney = 'selectedChapterMoney',
  darkTheme = 'darkTheme',
  liteVersion = 'liteVersion',
  height = 'height',
  userName = 'userName',
  isUserAdmin = 'isUserAdmin',
}

export type SettingsChapterNames = 'selectedChapterFood' | 'selectedChapterMoney' | '';

export type LocalStorageSettings = Settings | null;

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
    ['targetKcals']: number; // TODO[116]: This too? 🤔
  };
}

export interface DiaryEntryWithFullData extends DiaryEntry {
  foodName: string;
  foodKcals: number;
  foodPercent: string;
  foodKcalPercentageOfDaysNorm: number;
}

export interface DayTotals {
  kcalsEaten: number;
  kcalsPercent: number;
  bodyWeight: number | null;
  targetKcals: number;
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
  kcals: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  description: string;
}

export interface Catalogue {
  [id: number]: CatalogueEntry;
}

export interface Coefficients {
  [id: number]: number;
}

export interface BodyWeight {
  bodyWeight: string;
  dateISO: string;
}

//                                                                         STATS

export interface Stats {
  [id: string]: [number, number, number, number];
}

export interface StatsChartData {
  dates: string[];
  weights: number[];
  weightsAvg: number[];
  kcals: number[];
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

export enum UsedFor {
  TRANSACTION = 'transaction',
  ACCOUNT = 'account',
  ASSET = 'asset',
}

export interface Category {
  id?: number;
  name: string;
  usedFor: UsedFor;
  groupKey: string;
}

export enum AccountKind {
  CASH = 'cash',
  CARD = 'card',
  CHECKING = 'checking',
  DEPOSIT = 'deposit',
  BROKERAGE = 'brokerage',
  CRYPTO = 'crypto',
}

export interface Account {
  id?: number;
  title: string;
  currencyId: number;
  invest: boolean;
  kind: AccountKind;
  categoryIds: number[];
}

export enum TransactionKind {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export interface Transaction {
  id?: number;
  dateISO: string;
  accountId: number;
  amount: number;
  categoryIds: number[];
  kind: TransactionKind;
  isGift: boolean;
  notes?: string;
  details?: any;
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

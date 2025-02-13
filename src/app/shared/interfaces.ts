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

export interface IncomingMessage {
  [key: string]: string;
}

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
  height: number | null;
  userName: string;
  isUserAdmin?: boolean; // TODO[068]: Think of a better way to work with admin privileges
}

export enum KeyOfSettings {
  selectedChapterFood = 'selectedChapterFood',
  selectedChapterMoney = 'selectedChapterMoney',
  darkTheme = 'darkTheme',
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

// export interface DiaryEntryEdit {
//   id: number;
//   foodWeight: number;
//   history: HistoryEntry[];
// }

export interface Diary {
  [dateISO: string]: {
    ['food']: {
      [id: number]: DiaryEntry;
    };
    ['bodyWeight']: number | null;
    ['targetKcals']: number;
  };
}

export interface FormattedDiaryEntry {
  id: number;
  dateISO: string;
  foodCatalogueId: number;
  foodWeight: number;
  history: HistoryEntry[];
  foodName: string;
  foodKcals: number;
  foodPercent: string;
  foodKcalPercentageOfDaysNorm: number;
}

export interface HistoryEntry {
  action: 'init' | 'set' | 'add' | 'subtract';
  value: number;
}

export interface FormattedDiary {
  [date: string]: {
    ['food']: {
      [id: number]: FormattedDiaryEntry;
    };
    ['bodyWeight']: number | null;
    ['targetKcals']: number;
    ['kcalsEaten']: number;
    ['kcalsPercent']: number;
  };
}

export type CatalogueId = number;

export type CatalogueIds = CatalogueId[];

export interface CatalogueEntry {
  id: number;
  name: string;
  kcals: number;
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

// export interface Currency {
//   id: number;
//   title: string;
//   ticker: string;
//   symbol: string;
//   symbol_pos: string;
//   whitespace: boolean;
// }

// export interface Bank {
//   id: number;
//   title: string;
// }

// export interface Account {
//   id: number;
//   title: string;
//   bank_id: number;
//   currency_id: number;
//   invest: boolean;
//   kind: string;
// }

// export interface Category {
//   id: number;
//   title: string;
//   kind: string;
// }

export interface Notification {
  id: number;
  message: string;
  bgColour: string;
  textColour: string;
  borderColour: string;
  time: number;
}

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

export interface InputWithProgressSubmitData {
  value: string;
  resolve: () => void;
  reject: () => void;
}

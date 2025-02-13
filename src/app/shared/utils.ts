import { enToRuTransliterationRules, USER_PREFERRED_MIDNIGHT_OFFSET_HOURS } from '@app/shared/const';

export function getTodayIsoNoTimeNoTZ(): string {
  return epochToIsoNoTimeNoTZ(new Date().getTime());
}

// export function getTodayIsoNoTimeNoTZ(): string {
//   const userPreferredMidnightOffsetHours = 5;
//   const now = new Date();
//   const offsetMilliseconds = userPreferredMidnightOffsetHours * 60 * 60 * 1000;
//   const adjustedDate = new Date(now.getTime() - offsetMilliseconds);
//   return dateToIsoNoTimeNoTZ(adjustedDate.getTime());
// }

export function dateToIsoNoTimeNoTZ(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function epochToIsoNoTimeNoTZ(milliseconds: number): string {
  const date = new Date(milliseconds);
  date.setHours(date.getHours() - USER_PREFERRED_MIDNIGHT_OFFSET_HOURS);
  return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
}

// export function dateToIsoNoTimeNoTZ(milliseconds: number): string {
//   // There was a more neat way (date.toISOString().slice(0,10)), but there were problems with TZs
//   const date = new Date(milliseconds);
//   return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
// }

export function getAdjustedDate(date: Date): Date {
  const adjustedDate = new Date(date.getTime());
  adjustedDate.setHours(adjustedDate.getHours() - USER_PREFERRED_MIDNIGHT_OFFSET_HOURS);
  return adjustedDate;
}

export function formatDateTicks(dateIso: string): string {
  const date = new Date(dateIso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// export function generateDatesList(inputDateIso: string): string[] {
//   const today = new Date().setHours(0, 0, 0, 0);
//   const inputDate = new Date(inputDateIso);
//   const resultDatesList: string[] = [];

//   for (let i = -FETCH_DAYS_RANGE_OFFSET; i <= FETCH_DAYS_RANGE_OFFSET; i++) {
//     const newDate = new Date(inputDate);
//     newDate.setDate(inputDate.getDate() + i);
//     newDate.setHours(0, 0, 0, 0);
//     if (newDate.getTime() > today) {
//       break;
//     }
//     const isoDate = dateToIsoNoTimeNoTZ(newDate.getTime());
//     resultDatesList.push(isoDate);
//   }

//   return resultDatesList;
// }

export function splitNumber(numStr: string): [string, string, string] {
  let sign = '';
  if (numStr.startsWith('-')) {
    sign = '-';
    numStr = numStr.substring(1);
  }
  let [integer, fraction] = numStr.split('.');
  return [sign, integer, fraction ? '.' + fraction : ''];
}

export function divideNumberWithWhitespaces(num: string): string {
  let result = [];
  let count = 0;
  for (let i = num.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      result.unshift(' ');
    }
    result.unshift(num.charAt(i));
    count++;
  }
  return result.join('');
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Adds hyphen between camelCase parts (e.g. 'camelCase' -> 'camel-Case')
    .replace(/[\s_]+/g, '-') // Replaces spaces and underscores with hyphens
    .toLowerCase();
}

export function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      fn(...args);
      lastCall = now;
    }
  };
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// USAGE: getRuDeclension(1, 'день', 'дня', 'дней');
export function getRuDeclension(number: number, one: string, few: string, many: string): string {
  // Corner cases first: numbers from 11 to 14
  const numberAsString = String(number);
  const lastTwoDigits = numberAsString.slice(-2);

  if (['11', '12', '13', '14'].includes(lastTwoDigits)) return many;

  // Next, checking only the last digit
  const lastDigit = numberAsString.slice(-1);

  if (['0', '5', '6', '7', '8', '9'].includes(lastDigit)) return many;

  if (['2', '3', '4'].includes(lastDigit)) return few;

  if (lastDigit === '1') return one;

  return many;
}

export function transliterateEnToRu(text: string): string {
  return text
    .split('')
    .map((char) => enToRuTransliterationRules[char.toLowerCase()] || char)
    .join('');
}

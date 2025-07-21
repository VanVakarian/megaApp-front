import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const ERROR_MESSAGES: Record<string, (errorValue: any) => string> = {
  range: (err) => `От ${err.min} до ${err.max}`,
  bodyWeight: () => 'ХХ.Х или ХХ',
  required: () => 'Обязательноe поле',
  // email: () => 'Введите корректный email',
  // phone: () => 'Введите корректный номер телефона',
  // forbiddenWords: (err) => `Запрещенное слово: ${err.found}`,
  // min: (err) => `Минимальное значение: ${err.min}`,
  // max: (err) => `Максимальное значение: ${err.max}`,
  // minlength: (err) => `Минимальная длина: ${err.requiredLength} символов`,
  // maxlength: (err) => `Максимальная длина: ${err.requiredLength} символов`,
  // pattern: () => 'Неверный формат данных',
};

export function getValidationErrorMessage(errorKey: string, errorValue: any): string {
  const messageFunction = ERROR_MESSAGES[errorKey];
  return messageFunction ? messageFunction(errorValue) : 'Ошибка';
}

export function rangeValidator(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value && value !== 0) return null;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return null;

    if (numValue < min || numValue > max) {
      return {
        range: {
          min,
          max,
          actual: numValue,
        },
      };
    }
    return null;
  };
}

export function weightValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value && value !== 0) return null;

    const stringValue = String(value);
    const pattern = /^\d{2,3}([.,]\d)?$/;

    if (!pattern.test(stringValue)) {
      return {
        bodyWeight: {
          requiredPattern: pattern.source,
          actualValue: stringValue,
        },
      };
    }

    return null;
  };
}

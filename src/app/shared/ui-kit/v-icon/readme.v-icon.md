# V-Icon Component Usage Examples

Компонент для отображения SVG иконок в соответствии с дизайн-системой проекта.

## Основное использование

```html
<!-- Базовая иконка -->
<v-icon name="home" />

<!-- Иконка с настройкой размера -->
<v-icon name="settings" [size]="6" />

<!-- Иконка с кастомным цветом -->
<v-icon name="star" color="var(--color-primary)" />

<!-- Использование предустановленных размеров -->
<v-icon name="user" [size]="IconSize.L" />
```

## Размеры

Компонент поддерживает два способа задания размера:

### Числовые значения (CssUnitValue)
Используют систему unit-значений из vars.css:
- **1**: 4px
- **2**: 8px (размер XS)
- **4**: 16px (размер M, по умолчанию)
- **6**: 24px (размер L)
- **8**: 32px (размер XL)

### Enum IconSize
```typescript
export enum IconSize {
  XS = 1,  // 4px
  S = 2,   // 8px
  M = 4,   // 16px (по умолчанию)
  L = 6,   // 24px
  XL = 8,  // 32px
}
```

## Использование в кнопках

```html
<!-- Иконка как prefix в кнопке -->
<v-button raised>
  <v-icon v-prefix name="plus" [size]="IconSize.S" />
  Добавить
</v-button>

<!-- Иконка как postfix -->
<v-button flat>
  Настройки
  <v-icon v-postfix name="arrow-right" [size]="IconSize.S" />
</v-button>

<!-- Только иконка -->
<v-button flat>
  <v-icon name="close" />
</v-button>
```

## Кликабельные иконки

```html
<!-- Добавить класс clickable для hover-эффектов -->
<v-icon name="heart" class="clickable" (click)="onHeartClick()" />
```

## Организация иконок

Все SVG иконки должны быть размещены в папке `/src/assets/` с расширением `.svg`.

Компонент автоматически формирует путь к иконке: `assets/{name}.svg`

### Существующие иконки в проекте:
- `restaurant.svg` - иконка ресторана
- `paid.svg` - иконка денег/оплаты
- `settings.svg` - иконка настроек
- `more.svg` - иконка "еще" (три точки)
- `login.svg` - иконка входа
- `logout.svg` - иконка выхода
- `person_add.svg` - иконка добавления пользователя

## Стилизация

Компонент использует CSS custom properties:
- `--v-icon-size`: размер иконки
- `--v-icon-color`: цвет иконки

Цвет наследуется через `currentColor`, что позволяет легко изменять цвет через CSS.

## API

### Inputs
- **name** (required): Название иконки для использования в спрайте
- **size**: Размер иконки (CssUnitValue или IconSize, по умолчанию IconSize.M)
- **color**: Цвет иконки (по умолчанию var(--color-text-default))

### CSS Classes
- **clickable**: Добавляет hover-эффекты для интерактивных иконок

## Особенности

- Standalone компонент
- Поддержка aria-label для доступности
- Анимации hover/active для кликабельных иконок
- Использует систему unit-значений проекта
- Соответствует цветовой схеме дизайн-системы

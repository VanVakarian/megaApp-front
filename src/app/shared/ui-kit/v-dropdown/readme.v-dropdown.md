# V-Dropdown

Searchable dropdown component with automatic filtering and form integration.

## Basic Usage

```html
<v-dropdown
  label="Select Item"
  placeholder="Search..."
  [items]="items"
/>
```

## Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | `string` | `''` | Label text |
| `placeholder` | `string` | `''` | Placeholder text |
| `items` | `DropdownItem[]` | `[]` | Options array |
| `isDisabled` | `boolean` | `false` | Disable component |
| `errorMessage` | `string` | `''` | Error message |
| `minDropdownWidth` | `string` | `''` | Min width (e.g. '300px') |
| `expandDirection` | `'left' \| 'right'` | `'left'` | List alignment |

## Events

| Event | Type | Description |
|-------|------|-------------|
| `onSelectionChanged` | `DropdownItem \| null` | Item selected/cleared |

## Data Format

```typescript
interface DropdownItem {
  value: string;  // form value
  label: string;  // display text
}
```

## Examples

### With Forms
```typescript
// Component
items: DropdownItem[] = [
  { label: 'Pizza', value: 'pizza' },
  { label: 'Burger', value: 'burger' }
];

form = new FormGroup({
  food: new FormControl('', Validators.required)
});
```

```html
<!-- Template -->
<v-dropdown
  label="Food Type"
  placeholder="Search food..."
  formControlName="food"
  [items]="items"
  (onSelectionChanged)="onSelect($event)"
/>
```

### Common Configurations
```html
<!-- Required field (via form validation) -->
<v-dropdown
  label="Category"
  [items]="categories"
  formControlName="category"
  [minDropdownWidth]="'250px'"
/>

<!-- Right-aligned -->
<v-dropdown
  placeholder="Quick select"
  [items]="options"
  [expandDirection]="'right'"
/>

<!-- Disabled state -->
<v-dropdown
  label="Loading..."
  [items]="[]"
  [isDisabled]="true"
/>
```

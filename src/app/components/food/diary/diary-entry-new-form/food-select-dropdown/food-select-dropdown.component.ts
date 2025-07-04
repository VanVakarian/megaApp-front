import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  Signal,
  ViewChild,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { FoodService } from '@app/services/food.service';
import { CatalogueEntry } from '@app/shared/interfaces';
import { transliterateEnToRu } from '@app/shared/utils';

@Component({
  selector: 'app-food-select-dropdown',
  templateUrl: './food-select-dropdown.component.html',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatIconModule],
  host: {},
})
export class FoodSelectDropdownComponent implements OnInit {
  @Input()
  public parentForm!: FormGroup;

  @Input()
  public foodNameControl!: FormControl;

  @Output()
  public onFoodSelected = new EventEmitter<CatalogueEntry | null>();

  @ViewChild('foodInputElem')
  public foodInputElem!: ElementRef;

  private searchQuery$$: WritableSignal<string> = signal('');

  public filteredCatalogue: Signal<CatalogueEntry[]> = computed(() => {
    return this.filterCatalogue(this.searchQuery$$());
  });

  public get searchQuery() {
    return this.searchQuery$$();
  }

  public set searchQuery(value: string) {
    this.searchQuery$$.set(value);
  }

  constructor(private foodService: FoodService) {}

  public ngOnInit() {}

  public shouldShowClearButton(): boolean {
    return this.foodNameControl.value.length > 0;
  }

  public onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const catalogueItem = this.foodService
      .catalogueSortedListSelected$$()
      .find((food) => food.name === event.option.value);

    this.onFoodSelected.emit(catalogueItem || null);
  }

  public focusInput(): void {
    setTimeout(() => {
      this.foodInputElem?.nativeElement?.focus();
    }, 0);
  }

  private filterCatalogue(inputValue: string): CatalogueEntry[] {
    const searchTerms = inputValue
      .toLowerCase()
      .split(' ')
      .filter((term) => term.length > 0);

    const transliteratedTerms = inputValue
      .split(' ')
      .filter((term) => term.length > 0)
      .map(transliterateEnToRu);

    return this.foodService.catalogueSortedListSelected$$().filter((food) => {
      const foodNameLower = food.name.toLowerCase();
      return (
        searchTerms.every((term) => foodNameLower.includes(term)) ||
        transliteratedTerms.every((term) => foodNameLower.includes(term))
      );
    });
  }
}

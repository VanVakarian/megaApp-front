import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  QueryList,
  Signal,
  ViewChildren,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { FoodCatalogueFormComponent } from '@app/components/food/catalogue/forms/food-catalogue-form.component';
import { FoodService } from '@app/services/food.service';
import { SettingsService } from '@app/services/settings.service';
import { CatalogueEntry } from '@app/shared/interfaces';
import { transliterateEnToRu } from '@app/shared/utils';

@Component({
  selector: 'app-food-catalogue',
  standalone: true,
  imports: [
    FormsModule,
    FoodCatalogueFormComponent,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatPaginatorModule,
  ],
  templateUrl: './food-catalogue.component.html',
  styleUrls: ['./food-catalogue.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodCatalogueComponent {
  @ViewChildren('foodExpansionPanel', { read: ElementRef }) domElements!: QueryList<ElementRef>;
  public usersSearchQuery$$: WritableSignal<string> = signal('');
  public catalogueFilteredListSelected$$: Signal<CatalogueEntry[]> = computed(() => this.filterCatalogue(true));
  public catalogueFilteredListLeftOut$$: Signal<CatalogueEntry[]> = computed(() => this.filterCatalogue(false));

  public pageSize: number = 10;
  public pageIndexSelected: number = 0;
  public pageIndexLeftOut: number = 0;

  constructor(
    private foodService: FoodService,
    private settingsService: SettingsService,
  ) {
    // effect(() => { console.log('CATALOGUE FILTERED LIST SELECTED have been updated:', this.catalogueFilteredListSelected$$()); });
    // effect(() => { console.log('CATALOGUE FILTERED LIST LEFT OUT have been updated:', this.catalogueFilteredListLeftOut$$()); });
  }

  private filterCatalogue(selected: boolean): CatalogueEntry[] {
    const query = this.usersSearchQuery$$()
      .split(' ')
      .filter((word) => word.length > 0);
    const catalogue = selected
      ? this.foodService.catalogueSortedListSelected$$()
      : this.foodService.catalogueSortedListLeftOut$$();
    return catalogue.filter((entry) => query.every((word) => entry.name.toLowerCase().includes(word)));
  }

  public get usersInput(): string {
    return this.usersSearchQuery$$();
  }

  public get filteredSelectedCatalogueLength(): number {
    return this.catalogueFilteredListSelected$$().length;
  }

  public get filteredLeftOutCatalogueLength(): number {
    return this.catalogueFilteredListLeftOut$$().length;
  }

  public get paginatedSelectedCatalogue(): CatalogueEntry[] {
    const startIndex = this.pageIndexSelected * this.pageSize;
    return this.catalogueFilteredListSelected$$().slice(startIndex, startIndex + this.pageSize);
  }

  public get paginatedLeftOutCatalogue(): CatalogueEntry[] {
    const startIndex = this.pageIndexLeftOut * this.pageSize;
    return this.catalogueFilteredListLeftOut$$().slice(startIndex, startIndex + this.pageSize);
  }

  public onSearchInput(value: string): void {
    const transliteratedValue = transliterateEnToRu(value);
    this.usersSearchQuery$$.set(transliteratedValue);
    this.pageIndexSelected = 0;
    this.pageIndexLeftOut = 0;
  }

  // public onOwnershipChanged(foodId: number): void {
  //   this.findPanelByFoodId(foodId).then((element) => {
  //     if (element) element.nativeElement.scrollIntoView({ behavior: 'smooth' });
  //   });
  // }

  public onPageChange(event: PageEvent, type: 'selected' | 'leftOut'): void {
    this.pageSize = event.pageSize;
    if (type === 'selected') {
      this.pageIndexSelected = event.pageIndex;
    } else if (type === 'leftOut') {
      this.pageIndexLeftOut = event.pageIndex;
    }
  }

  private findPanelByFoodId(foodId: number): Promise<ElementRef | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const element = this.domElements.find((el) => el.nativeElement.getAttribute('data-food-id') === foodId);
        resolve(element);
      }, 0);
    });
  }
}

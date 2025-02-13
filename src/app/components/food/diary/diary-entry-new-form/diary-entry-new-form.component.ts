import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  Signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { firstValueFrom } from 'rxjs';

import { FoodStatsService } from '@app/services/food-stats.service';
import { FoodService } from '@app/services/food.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { CatalogueEntry, DiaryEntry, ScreenType } from '@app/shared/interfaces';
import { FoodSelectDropdownComponent } from './food-select-dropdown/food-select-dropdown.component';

@Component({
  selector: 'app-diary-entry-new-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    FoodSelectDropdownComponent,
  ],
  templateUrl: './diary-entry-new-form.component.html',
})
export class DiaryEntryNewFormComponent implements OnChanges {
  @Input()
  public expanded = false;

  @Output()
  public onServerSuccessfullResponse = new EventEmitter<void>();

  @ViewChild('formGroupDirective')
  public formGroupDirective!: FormGroupDirective;

  @ViewChild('mobileFoodSelect')
  public mobileFoodSelect!: FoodSelectDropdownComponent;

  @ViewChild('desktopFoodSelect')
  public desktopFoodSelect!: FoodSelectDropdownComponent;

  @ViewChild('weightInputElem')
  public weightInputElem!: ElementRef;

  private isModalOpen = false;

  private catalogueNames$$: Signal<string[]> = computed(() =>
    this.foodService.catalogueSortedListSelected$$().map((food: CatalogueEntry) => food.name),
  );

  private catalogueNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      return this.catalogueNames$$().includes(value) ? null : { notInCatalogue: true };
    };
  }

  public diaryEntryForm: FormGroup = new FormGroup({
    foodCatalogueId: new FormControl<number>(0),
    foodName: new FormControl<string>('', [Validators.required, this.catalogueNameValidator()]),
    foodWeight: new FormControl<number | null>(null, [
      Validators.required,
      Validators.pattern(/^\d+$/), // Digits only
    ]),
  });

  get foodNameControl() {
    return this.diaryEntryForm.get('foodName') as FormControl<string>;
  }

  get foodWeightControl() {
    return this.diaryEntryForm.get('foodWeight') as FormControl<number | null>;
  }

  public get foodWeight() {
    return this.diaryEntryForm.get('foodWeight');
  }

  public get isMobile(): boolean {
    return this.screenSizeWatcherService.currentScreenType === ScreenType.MOBILE;
  }

  public get isModalOpened(): boolean {
    return this.isModalOpen;
  }

  public set isModalOpened(value: boolean) {
    this.isModalOpen = value;
  }

  constructor(
    private foodService: FoodService,
    private foodStatsService: FoodStatsService,
    private screenSizeWatcherService: ScreenSizeWatcherService,
  ) {
    // effect(() => { console.log('CATALOGUE NAMES have been updated:', this.catalogueNames$$()); }); // prettier-ignore
  }

  public ngOnInit(): void {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['expanded'] && changes['expanded'].currentValue) {
      setTimeout(() => {
        if (this.isMobile) {
          this.openModal();
          this.mobileFoodSelect.focusInput();
        } else {
          this.desktopFoodSelect.focusInput();
        }
      }, 125); // roughly the expansion animation duration
    }
  }

  public isFormValid(): boolean {
    return this.diaryEntryForm.valid;
  }

  public onFoodSelected(food: CatalogueEntry | null): void {
    if (food) {
      this.diaryEntryForm.patchValue({
        foodCatalogueId: food.id,
        foodName: food.name,
      });
      this.isModalOpened = false;
    }
    setTimeout(() => {
      this.weightInputElem.nativeElement.focus();
    }, 0); // Waiting for panel expansion animation for the focus to work
  }

  async onSubmit(): Promise<void> {
    if (!this.diaryEntryForm.valid) return;

    this.diaryEntryForm.disable();
    const { foodCatalogueId, foodWeight } = this.diaryEntryForm.value;

    const catalogue = this.foodService.catalogue$$();
    if (!catalogue || !foodCatalogueId) {
      this.diaryEntryForm.enable();
      return;
    }

    const foodKcals = catalogue[foodCatalogueId].kcals;
    const foodCoefficient = this.foodService.coefficients$$()?.[foodCatalogueId] ?? 1;
    const kcalsDelta = ((foodWeight || 0) / 100) * foodKcals * foodCoefficient;

    const entry: DiaryEntry = {
      id: 0,
      dateISO: this.foodService.selectedDayIso$$(),
      foodCatalogueId: foodCatalogueId,
      foodWeight: foodWeight || 0,
      history: [{ action: 'init', value: foodWeight || 0 }],
    };

    const response = await firstValueFrom(this.foodService.createDiaryEntry(entry));

    if (response?.result) {
      if (response.diaryId) {
        this.onServerSuccessfullResponse.emit();
      }

      this.diaryEntryForm.enable();
      this.formGroupDirective.resetForm({
        foodCatalogueId: 0,
        foodName: '',
        foodWeight: null,
      });

      if (kcalsDelta) {
        this.foodStatsService.updateStats(this.foodService.selectedDayIso$$(), 0, kcalsDelta);
      }
    } else {
      this.diaryEntryForm.enable();
    }
  }

  public openModal(): void {
    this.isModalOpened = true;
    this.mobileFoodSelect.focusInput();
  }
}

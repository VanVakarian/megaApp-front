import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { SettingsService } from '@app/services/settings.service';
import { UserCreds } from '@app/shared/interfaces';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'auth-form',
  templateUrl: './auth-form.html',
  imports: [ReactiveFormsModule, VCard, VInput, VButton],
})
export class AuthForm implements OnInit {
  protected readonly submitted$$ = signal(false);
  protected readonly isLoginMode$$ = signal(true);
  protected readonly justRegistered$$ = signal(false);

  protected readonly usernameErrorMessage$$ = computed(() => this.getUsernameErrorMessage());
  protected readonly passwordErrorMessage$$ = computed(() => this.getPasswordErrorMessage());

  protected readonly authService = inject(AuthService);
  protected readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);

  protected readonly authForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  public ngOnInit(): void {
    this.authService.checkAuth().subscribe();
  }

  protected toggleMode(): void {
    this.isLoginMode$$.update((value) => !value);
    this.justRegistered$$.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.authForm.invalid) {
      return;
    }

    this.submitted$$.set(true);

    const user: UserCreds = this.authForm.getRawValue();

    try {
      if (this.isLoginMode$$()) {
        await firstValueFrom(this.authService.login(user));
        this.authForm.reset();
        this.router.navigate(['']);
      } else {
        await firstValueFrom(this.authService.register(user));
        this.authForm.reset();
        this.isLoginMode$$.set(true);
        this.justRegistered$$.set(true);
      }
    } catch (error) {
      console.log(error);
    } finally {
      this.submitted$$.set(false);
    }
  }

  private getUsernameErrorMessage(): string {
    const control = this.authForm.controls.username;
    if (!control.touched) return '';

    if (control.errors?.['required']) {
      return 'Поле не должно быть пустым';
    }

    return control.errors ? 'Ошибка' : '';
  }

  private getPasswordErrorMessage(): string {
    const control = this.authForm.controls.password;
    if (!control.touched) return '';

    if (control.errors?.['required']) {
      return 'Введите пароль';
    }

    if (control.errors?.['minlength']) {
      return `Пароль должен быть не менее ${control.errors['minlength'].requiredLength} символов.`;
    }

    return control.errors ? 'Ошибка' : '';
  }
}

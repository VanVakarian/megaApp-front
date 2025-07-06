import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { SettingsService } from '@app/services/settings.service';
import { UserCreds } from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-auth-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
  ],
  templateUrl: './auth-form.component.html',
})
export class AuthFormComponent implements OnInit {
  authForm: FormGroup;
  submitted = false;
  isLoginMode: boolean = true;
  justRegistered: boolean = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    public settingsService: SettingsService,
  ) {
    this.authForm = new FormGroup({
      username: new FormControl(null, [Validators.required]),
      password: new FormControl(null, [Validators.required, Validators.minLength(6)]),
    });
  }

  ngOnInit() {
    this.authService.checkAuth().subscribe();
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.justRegistered = false;
  }

  async submit() {
    if (this.authForm.invalid) {
      return;
    }

    this.submitted = true;

    const user: UserCreds = {
      username: this.authForm.value.username,
      password: this.authForm.value.password,
    };

    try {
      if (this.isLoginMode) {
        await firstValueFrom(this.authService.login(user));
        this.authForm.reset();
        this.router.navigate(['']);
      } else {
        await firstValueFrom(this.authService.register(user));
        this.authForm.reset();
        this.isLoginMode = true;
        this.justRegistered = true;
      }
    } catch (error) {
      console.log(error);
    } finally {
      this.submitted = false;
    }
  }
}

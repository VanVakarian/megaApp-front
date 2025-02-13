import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '@app/services/auth.service';
import { SettingsService } from '@app/services/settings.service';
import { UserCreds } from '@app/shared/interfaces';

@Component({
  selector: 'app-auth-form',
  standalone: true,
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

  ngOnInit() {}

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.justRegistered = false;
  }

  submit() {
    if (this.authForm.invalid) {
      return;
    }

    this.submitted = true;

    const user: UserCreds = {
      username: this.authForm.value.username,
      password: this.authForm.value.password,
    };

    if (this.isLoginMode) {
      this.authService.login(user).subscribe({
        next: () => {
          this.authForm.reset();
          this.router.navigate(['']);
          this.submitted = false;
        },
        error: (error) => {
          console.log(error);
          this.submitted = false;
        },
      });
    } else {
      this.authService.register(user).subscribe({
        next: () => {
          this.authForm.reset();
          this.isLoginMode = true; // Switching to login mode after successful registration
          this.justRegistered = true; // For showing a message about successful registration
          this.submitted = false;
        },
        error: (error) => {
          console.log(error);
          this.submitted = false;
        },
      });
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/components/refactor/service/auth/auth.service';
import { UserLogin } from '@app/shared/interfaces';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent implements OnInit {
  loginForm: FormGroup;
  submitted = false;

  constructor(
    public auth: AuthService,
    private router: Router,
    public route: ActivatedRoute,
  ) {
    this.loginForm = new FormGroup({
      // username: new FormControl(null, [Validators.required, Validators.username]),
      username: new FormControl(null, [Validators.required]),
      password: new FormControl(null, [Validators.required, Validators.minLength(6)]),
    });
  }

  ngOnInit() {}

  clear() {
    this.loginForm.reset();
  }

  submit() {
    if (this.loginForm.invalid) {
      // console.log('Form is invalid')
      return;
    }

    this.submitted = true;

    const user: UserLogin = {
      username: this.loginForm.value.username,
      password: this.loginForm.value.password,
    };

    this.auth.login(user).subscribe({
      next: () => {
        this.loginForm.reset();
        this.router.navigate(['']);
        this.submitted = false;
      },
      error: (error) => {
        console.log(error);
        this.submitted = false;
      },
    });
  }
}

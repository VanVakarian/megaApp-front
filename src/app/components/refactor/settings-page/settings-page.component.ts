import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/components/refactor/service/auth/auth.service';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
  ) {
    auth.authChange.subscribe((isAuthed) => {
      this.checkIfAuthenticated = isAuthed;
    });
  }

  checkIfAuthenticated = this.auth.checkIfAuthenticated();

  logout(event: Event) {
    event.preventDefault();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

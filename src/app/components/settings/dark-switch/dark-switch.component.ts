import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@app/services/auth.service';
import { SettingsService } from '@app/services/settings.service';

@Component({
  selector: 'app-dark-switch',
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './dark-switch.component.html',
})
export class DarkSwitchComponent implements OnInit {
  constructor(
    public settingsService: SettingsService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {}

  public async switchTheme(): Promise<void> {
    const setting = { darkTheme: !this.settingsService.settings$$().darkTheme };
    this.settingsService.applyTheme(setting.darkTheme);
    const requestIsSuccess = await this.settingsService.saveSetting(setting);

    if (!requestIsSuccess) this.settingsService.applyTheme(!setting.darkTheme);
  }
}

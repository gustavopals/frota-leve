import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-dashboard-layout',
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrls: ['./dashboard-layout.scss']
})
export class DashboardLayoutComponent {}

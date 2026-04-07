import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { VehicleImportModal } from './components/vehicle-import-modal/vehicle-import-modal';
import { VehicleDetailPage } from './pages/vehicle-detail-page/vehicle-detail-page';
import { VehicleFormPage } from './pages/vehicle-form-page/vehicle-form-page';
import { VehiclesRoutingModule } from './vehicles-routing-module';
import { VehiclesPage } from './pages/vehicles-page/vehicles-page';
import { VehiclesService } from './vehicles.service';

@NgModule({
  declarations: [VehiclesPage, VehicleFormPage, VehicleDetailPage, VehicleImportModal],
  imports: [SharedModule, VehiclesRoutingModule],
  providers: [VehiclesService],
})
export class VehiclesModule {}

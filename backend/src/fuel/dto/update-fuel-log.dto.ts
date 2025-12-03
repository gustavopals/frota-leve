import { PartialType } from '@nestjs/swagger';
import { CreateFuelLogDto } from './create-fuel-log.dto';

export class UpdateFuelLogDto extends PartialType(CreateFuelLogDto) {}

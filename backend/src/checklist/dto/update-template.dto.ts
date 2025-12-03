import { PartialType } from '@nestjs/swagger';
import { CreateChecklistTemplateDto } from './create-template.dto';

export class UpdateChecklistTemplateDto extends PartialType(CreateChecklistTemplateDto) {}

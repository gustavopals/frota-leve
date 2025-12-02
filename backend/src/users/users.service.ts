import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createUserDto: CreateUserDto) {
    const { password, ...userData } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        ...userData,
        tenantId,
        passwordHash: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        settings: true,
      },
    });
  }

  async update(tenantId: string, id: string, updateUserDto: UpdateUserDto) {
    const { password, ...userData } = updateUserDto;
    const data: any = { ...userData };

    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}

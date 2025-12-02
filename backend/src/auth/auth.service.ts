import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../config/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { tenantName, tenantDocument, name, email, password } = registerDto;

    // Verificar se o email já existe
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }

    // Criar tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: tenantName,
        document: tenantDocument,
      },
    });

    // Criar usuário admin
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email,
        passwordHash: hashedPassword,
        role: 'ADMIN_EMPRESA',
      },
    });

    // Criar configurações padrão do tenant
    await this.prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        preferences: {
          locale: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
          distanceUnit: 'km',
          alertDaysBeforeDue: 15,
        },
      },
    });

    const token = this.generateToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    if (!user.tenant.isActive) {
      throw new UnauthorizedException('Tenant is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
  }

  private generateToken(user: { id: string; email: string; role: string; tenantId: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    return this.jwtService.sign(payload);
  }
}

import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer'] },
      },
      required: ['name', 'email', 'password'],
    },
  })
  async register(@Body() body: { name: string; email: string; password: string; role?: string }) {
    return this.authService.register(body.name, body.email, body.password, body.role);
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['email', 'password'],
    },
  })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }
}

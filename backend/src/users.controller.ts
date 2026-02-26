import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './users/entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './users/entities/user.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/auth.interfaces';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findOneById(id);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req): Promise<User> {
    return this.usersService.findOneById(req.user.userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}

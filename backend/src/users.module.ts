import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity'; // Corrected relative path
import { UsersService } from './users.service'; // Reverted to correct path
// Assuming UsersController exists, if not, remove it
// import { UsersController } from './users/users.controller'; // If it exists in users/

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  // controllers: [UsersController], // Add if a controller exists/is needed
  providers: [UsersService],
  exports: [UsersService], // Export UsersService for AuthModule
})
export class UsersModule {}

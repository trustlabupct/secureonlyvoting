import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users.service';
import { Role } from '../auth/auth.interfaces';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  console.log('Creating test users...');

  try {
    // Create admin user with certificate support
    const adminUser = await usersService.create({
      username: 'admin@certificates.local',
      password: 'admin123',
      name: 'Certificate Admin',
      role: Role.ADMIN,
    });

    // Enable certificate authentication for admin
    await usersService.updateCertificate(
      adminUser.id,
      'admin@certificates.local', // This should match the certificate CN or email
      '', // Fingerprint will be populated when certificate is first used
    );

    console.log('✅ Admin user created:', {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
      certificateEnabled: true,
    });

    // Create regular user
    const regularUser = await usersService.create({
      username: 'user@example.com',
      password: 'user123',
      name: 'Regular User',
      role: Role.USER,
    });

    console.log('✅ Regular user created:', {
      id: regularUser.id,
      username: regularUser.username,
      name: regularUser.name,
      role: regularUser.role,
    });

    // Create HR user for testing
    const hrUser = await usersService.create({
      username: 'hr@example.com',
      password: 'admin123',
      name: 'HR Manager',
      role: Role.ADMIN,
    });

    console.log('✅ HR user created:', {
      id: hrUser.id,
      username: hrUser.username,
      name: hrUser.name,
      role: hrUser.role,
    });

    console.log('\n🎉 Test users created successfully!');
    console.log('\nLogin credentials:');
    console.log(
      'Admin: admin@certificates.local / admin123 (certificate auth enabled)',
    );
    console.log('HR: hr@example.com / admin123');
    console.log('User: user@example.com / user123');
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    if (error.message.includes('already taken')) {
      console.log('ℹ️  Test users may already exist. This is normal.');
    }
  }

  await app.close();
}

bootstrap();

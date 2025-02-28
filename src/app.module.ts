import { Module } from '@nestjs/common';
import { SpeedTestCommand } from './app.command';
import { SpeedTestService } from './speed-test.service';

@Module({
  providers: [SpeedTestCommand, SpeedTestService],
})
export class AppModule {}

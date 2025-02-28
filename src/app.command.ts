import { Command, CommandRunner } from 'nest-commander';
import { SpeedTestService } from './speed-test.service';

@Command({ name: 'speed-test', description: 'Run VPN speed tests' })
export class SpeedTestCommand extends CommandRunner {
  constructor(private speedTestService: SpeedTestService) {
    super();
  }

  async run(): Promise<void> {
    this.speedTestService.runSpeedTest();
  }
}

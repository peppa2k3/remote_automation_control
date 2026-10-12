import 'dotenv/config';
import { parseAgentConfig } from './config.js';
import { diagnose } from './diagnose.js';

try {
  const result = await diagnose(parseAgentConfig(process.env));
  console.log(
    JSON.stringify({
      event: 'agent.diagnose',
      ...result,
      message: 'Kết nối API thành công. Pairing/heartbeat chưa triển khai.',
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      event: 'agent.diagnose',
      status: 'failed',
      message:
        'Không kết nối được API hoặc cấu hình/response không hợp lệ. Kiểm tra env và API health.',
    }),
  );
  process.exitCode = 1;
}

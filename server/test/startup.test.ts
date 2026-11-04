import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// test อื่นโหลดผ่าน app.ts ส่วนของจริงเริ่มจาก index.ts ลำดับโหลดต่างกัน วงการ import จึงพังเฉพาะตอนรันจริงได้
describe('เริ่ม server จาก index.ts', () => {
  it('เปิด port ได้โดยไม่ล้ม', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      env: { ...process.env, PORT: '4187', NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    try {
      const started = await new Promise<boolean>((resolve) => {
        child.stdout.on('data', (chunk: Buffer) => {
          if (chunk.toString().includes('API running')) resolve(true)
        })
        child.once('exit', () => resolve(false))
      })
      expect(started, stderr).toBe(true)
    } finally {
      child.kill()
    }
  })
})

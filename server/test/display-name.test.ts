import { describe, expect, it } from 'vitest'
import { createUser, loginUser, PASSWORD, signedInAdmin, signedInUser, userAgent } from './helpers.js'

let seq = 0
const register = (displayName: string) =>
  userAgent().post('/api/auth/register').send({ email: `name${++seq}@test.local`, password: PASSWORD, displayName })

describe('ชื่อที่แสดงตอนสมัคร', () => {
  it.each([
    'ทีมงาน TCGNexus',
    'ทีมงาน',
    'ทีม งาน',
    'แอดมินเพจ',
    'ผู้ดูแลระบบ',
    'เจ้าหน้าที่',
    'TCGNexus',
    'TCG Nexus',
    'tcg-nexus',
    'SwapHub',
    'Admin',
    'admin_1',
    'Support Team',
    'Official Store',
    'Moderator',
    // ตัวอักษรเต็มความกว้างที่ดูเหมือน admin
    'ａｄｍｉｎ',
  ])('แอบอ้างทีมงานไม่ได้: %s', async (name) => {
    const res = await register(name)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('DISPLAY_NAME_RESERVED')
  })

  it.each([
    ['zero-width space', '​​'],
    ['ZWJ อย่างเดียว', '‍‍'],
    ['Hangul filler', 'ㅤ'],
    ['อักษรเบรลล์ว่าง', '⠀'],
    ['สลับทิศตัวอักษร', 'abc‮def'],
    ['อักขระควบคุม', 'a\u0007b'],
  ])('อักขระที่มองไม่เห็นไม่ได้: %s', async (_label, name) => {
    const res = await register(name)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('DISPLAY_NAME_INVALID')
  })

  it.each(['สมชาย', 'Badminton King', 'Supporter', 'Staffordshire', 'Mr. Pika', '👨‍👩‍👧 Family', '❤️ การ์ดไทย'])(
    'ชื่อปกติใช้ได้: %s',
    async (name) => {
      const res = await register(name)
      expect(res.status).toBe(201)
      expect(res.body.user.displayName).toBe(name)
    },
  )
})

describe('แก้ชื่อที่แสดงในโปรไฟล์', () => {
  const profile = (username: string, displayName: string) => ({ username, displayName, bio: '', location: '' })

  it('เปลี่ยนเป็นชื่อแอบอ้างไม่ได้', async () => {
    const { user, agent } = await signedInUser()
    const res = await agent.patch('/api/me/profile').send(profile(user.username, 'ทีมงาน TCGNexus'))
    expect(res.body.error.code).toBe('DISPLAY_NAME_RESERVED')
  })

  it('ชื่อที่ตั้งไว้ก่อนมีกฎนี้ใช้ต่อได้ และแก้ช่องอื่นได้', async () => {
    const user = await createUser({ displayName: 'Official Fan' })
    const agent = await loginUser(user.email)
    const res = await agent.patch('/api/me/profile').send({ ...profile(user.username, 'Official Fan'), bio: 'สะสมการ์ด' })
    expect(res.status).toBe(200)
    expect((await agent.patch('/api/me/profile').send(profile(user.username, 'Official Fan 2'))).body.error.code).toBe(
      'DISPLAY_NAME_RESERVED',
    )
  })

  it('admin ใช้คำเหล่านี้ได้ แต่อักขระที่มองไม่เห็นยังไม่ได้', async () => {
    const { user, agent } = await signedInAdmin()
    expect((await agent.patch('/api/me/profile').send(profile(user.username, 'Admin Team'))).status).toBe(200)
    expect((await agent.patch('/api/me/profile').send(profile(user.username, '​'))).body.error.code).toBe('DISPLAY_NAME_INVALID')
  })
})

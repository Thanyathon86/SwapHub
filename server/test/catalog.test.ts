import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { uploadRoot } from '../src/lib/storage.js'
import { createGame, createListing, createUser, signedInAdmin, signedInUser, userAgent, type Agent } from './helpers.js'

let admin: Agent

beforeEach(async () => {
  admin = (await signedInAdmin()).agent
})

// รูป JPEG ที่มี EXIF ติดมา เหมือนรูปจากมือถือ
const jpeg = (width = 1600, height = 1000) =>
  sharp({ create: { width, height, channels: 3, background: '#c00' } })
    .jpeg()
    .withExif({ IFD0: { ImageDescription: 'secret-location' } })
    .toBuffer()

const uploadImage = async (agent: Agent, gameId: string, file?: Buffer) =>
  agent.post(`/api/admin/games/${gameId}/image`).attach('image', file ?? (await jpeg()), 'game.jpg')

const fileOf = (key: string) => resolve(uploadRoot, key)

describe('admin games', () => {
  it('adds a game that sellers can pick right away', async () => {
    const res = await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'digimon' })
    expect(res.status).toBe(201)
    expect(res.body.game).toMatchObject({ name: 'Digimon', slug: 'digimon', imageKey: null, _count: { listings: 0 } })

    const pub = await userAgent().get('/api/catalog/games')
    expect(pub.body.games.map((g: { slug: string }) => g.slug)).toContain('digimon')
  })

  it('rejects a duplicate name or slug', async () => {
    await createGame({ name: 'Digimon', slug: 'digimon' })
    const sameSlug = await admin.post('/api/admin/games').send({ name: 'Other', slug: 'digimon' })
    expect(sameSlug.status).toBe(409)
    expect(sameSlug.body.error.code).toBe('ALREADY_EXISTS')
  })

  it('rejects a slug that cannot be used in a URL', async () => {
    const res = await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'Digimon Card Game' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('does not let a client point imageKey at an arbitrary file', async () => {
    const game = await createGame()
    const created = await admin.post('/api/admin/games').send({ name: 'X', slug: 'x', imageKey: '../secret' })
    expect(created.status).toBe(400)
    const updated = await admin.patch(`/api/admin/games/${game.id}`).send({ imageKey: '../secret' })
    expect(updated.status).toBe(400)
  })

  it('hides a deactivated game from the public list', async () => {
    const game = await createGame({ slug: 'old-game' })
    const res = await admin.patch(`/api/admin/games/${game.id}`).send({ isActive: false })
    expect(res.status).toBe(200)
    const pub = await userAgent().get('/api/catalog/games')
    expect(pub.body.games.map((g: { slug: string }) => g.slug)).not.toContain('old-game')
  })
})

describe('popular games', () => {
  const popular = async () => {
    const res = await userAgent().get('/api/catalog/games/popular')
    expect(res.status).toBe(200)
    return res.body.games as { id: string; slug: string; imageKey: string | null }[]
  }
  const addListings = async (sellerId: string, gameId: string, count: number) => {
    for (let i = 0; i < count; i++) await createListing(sellerId, { gameId })
  }

  it('ranks games by listings people can see, then by name', async () => {
    const seller = await createUser()
    const few = await createGame({ name: 'Few', slug: 'few' })
    const many = await createGame({ name: 'Many', slug: 'many' })
    await createGame({ name: 'Zero B', slug: 'zero-b' })
    await createGame({ name: 'Zero A', slug: 'zero-a' })
    await addListings(seller.id, few.id, 1)
    await addListings(seller.id, many.id, 3)

    expect((await popular()).map((g) => g.slug)).toEqual(['many', 'few', 'zero-a', 'zero-b'])
  })

  it('ignores listings the public cannot see', async () => {
    const seller = await createUser()
    const suspended = await createUser({ status: 'SUSPENDED' })
    const visible = await createGame({ name: 'Visible', slug: 'visible' })
    const hidden = await createGame({ name: 'Hidden', slug: 'hidden' })
    await createListing(seller.id, { gameId: visible.id })
    await createListing(seller.id, { gameId: hidden.id, status: 'PENDING_REVIEW' })
    await createListing(seller.id, { gameId: hidden.id, status: 'CLOSED' })
    await createListing(seller.id, { gameId: hidden.id, status: 'REJECTED' })
    await createListing(suspended.id, { gameId: hidden.id })

    expect((await popular()).map((g) => g.slug)).toEqual(['visible', 'hidden'])
  })

  it('returns at most 5 games', async () => {
    for (const slug of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) await createGame({ name: slug, slug })
    expect((await popular()).map((g) => g.slug)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('leaves out deactivated games even when they have the most listings', async () => {
    const seller = await createUser()
    const closed = await createGame({ name: 'Closed', slug: 'closed', isActive: false })
    await createGame({ name: 'Open', slug: 'open' })
    await addListings(seller.id, closed.id, 2)
    expect((await popular()).map((g) => g.slug)).toEqual(['open'])
  })

  it('sends only the fields the tile needs', async () => {
    const game = await createGame({ name: 'Digimon', slug: 'digimon' })
    const key = (await uploadImage(admin, game.id)).body.game.imageKey as string
    expect(await popular()).toEqual([{ id: game.id, name: 'Digimon', slug: 'digimon', imageKey: key }])
  })
})

describe('game image', () => {
  it('stores a 960x600 WebP without EXIF and shows it publicly', async () => {
    const game = await createGame()
    const res = await uploadImage(admin, game.id)
    expect(res.status).toBe(200)
    const key = res.body.game.imageKey as string
    expect(key).toMatch(new RegExp(`^games/${game.id}/[0-9a-f-]+\\.webp$`))
    expect(res.body.game._count).toEqual({ listings: 0 })

    const meta = await sharp(fileOf(key)).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 960, height: 600 })
    expect(meta.exif).toBeUndefined()

    const pub = await userAgent().get('/api/catalog/games')
    expect(pub.body.games.find((g: { id: string }) => g.id === game.id).imageKey).toBe(key)
  })

  it('forces the 16:10 frame even when the client skips cropping', async () => {
    const game = await createGame()
    const res = await uploadImage(admin, game.id, await jpeg(500, 1500))
    expect(res.status).toBe(200)
    const meta = await sharp(fileOf(res.body.game.imageKey as string)).metadata()
    expect(meta).toMatchObject({ width: 960, height: 600 })
  })

  it('removes the previous file when the image is replaced', async () => {
    const game = await createGame()
    const first = (await uploadImage(admin, game.id)).body.game.imageKey as string
    const second = (await uploadImage(admin, game.id)).body.game.imageKey as string
    expect(second).not.toBe(first)
    expect(existsSync(fileOf(first))).toBe(false)
    expect(existsSync(fileOf(second))).toBe(true)
  })

  it('removes the image and its file', async () => {
    const game = await createGame()
    const key = (await uploadImage(admin, game.id)).body.game.imageKey as string
    const res = await admin.delete(`/api/admin/games/${game.id}/image`)
    expect(res.status).toBe(200)
    expect(res.body.game.imageKey).toBeNull()
    expect(existsSync(fileOf(key))).toBe(false)
  })

  it('treats removing a missing image as success', async () => {
    const game = await createGame()
    const res = await admin.delete(`/api/admin/games/${game.id}/image`)
    expect(res.status).toBe(200)
    expect(res.body.game.imageKey).toBeNull()
  })

  it('keeps the current image when the new file is not an image', async () => {
    const game = await createGame()
    const key = (await uploadImage(admin, game.id)).body.game.imageKey as string
    const res = await uploadImage(admin, game.id, Buffer.from('not an image'))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_IMAGE')
    const after = await prisma.game.findUniqueOrThrow({ where: { id: game.id } })
    expect(after.imageKey).toBe(key)
    expect(existsSync(fileOf(key))).toBe(true)
  })

  it('rejects a request without a file', async () => {
    const game = await createGame()
    const res = await admin.post(`/api/admin/games/${game.id}/image`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_UPLOAD')
  })

  it('answers 404 for a game that does not exist', async () => {
    const missing = '00000000-0000-4000-8000-000000000000'
    const upload = await uploadImage(admin, missing)
    expect(upload.status).toBe(404)
    expect(upload.body.error.code).toBe('GAME_NOT_FOUND')
    const remove = await admin.delete(`/api/admin/games/${missing}/image`)
    expect(remove.status).toBe(404)
  })

  it('is only available to admins', async () => {
    const game = await createGame()
    const guest = userAgent()
    expect((await uploadImage(guest, game.id)).status).toBe(401)
    expect((await guest.delete(`/api/admin/games/${game.id}/image`)).status).toBe(401)

    const { agent: user } = await signedInUser()
    expect((await uploadImage(user, game.id)).status).toBe(403)
    expect((await user.delete(`/api/admin/games/${game.id}/image`)).status).toBe(403)

    const after = await prisma.game.findUniqueOrThrow({ where: { id: game.id } })
    expect(after.imageKey).toBeNull()
  })
})

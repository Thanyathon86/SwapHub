import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { listingInclude, publicOmit, publicWhere } from '../listings/listings.service.js'

// หน้าโปรไฟล์แสดงประกาศได้ไม่เกินนี้ ยังไม่แบ่งหน้าเพราะผู้ขายส่วนใหญ่มีไม่ถึง
const PROFILE_LISTINGS = 60

const notFound = () => new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found')

// หาผู้ใช้ที่เปิดโปรไฟล์ให้คนอื่นดูได้: ต้องเป็นผู้ใช้ทั่วไปที่ยังใช้งานอยู่
// admin ไม่ได้ซื้อขายจึงไม่มีโปรไฟล์ และไม่ให้คนภายนอกเดาได้ว่าใครเป็น admin
export const findPublicUser = async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarKey: true,
      bio: true,
      location: true,
      createdAt: true,
      role: true,
      status: true,
    },
  })
  if (!user || user.role !== 'USER' || user.status !== 'ACTIVE') throw notFound()
  const { role: _role, status: _status, ...profile } = user
  return profile
}

export const getProfile = async (username: string) => {
  const profile = await findPublicUser(username)
  const [listings, deals] = await Promise.all([
    prisma.listing.findMany({
      where: { ...publicWhere, sellerId: profile.id },
      include: listingInclude,
      omit: publicOmit,
      orderBy: { createdAt: 'desc' },
      take: PROFILE_LISTINGS,
    }),
    // ดีลที่ตกลงกันได้ ไม่ว่าจะเป็นฝั่งผู้ซื้อหรือผู้ขาย
    prisma.offer.count({ where: { status: 'ACCEPTED', OR: [{ buyerId: profile.id }, { listing: { sellerId: profile.id } }] } }),
  ])
  return { profile: { ...profile, stats: { activeListings: listings.length, deals } }, listings }
}

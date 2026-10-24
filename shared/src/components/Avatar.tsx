import { imageUrl } from '../listings/listingsApi'

const sizes = { sm: 'size-9 text-sm', md: 'size-14 text-xl', lg: 'size-20 text-3xl sm:size-28 sm:text-4xl' }

type Props = { user: { displayName: string; avatarKey: string | null }; size?: keyof typeof sizes }

// รูปโปรไฟล์วงกลม ถ้ายังไม่ได้ตั้งรูปใช้ตัวอักษรแรกของชื่อแทน
export function Avatar({ user, size = 'sm' }: Props) {
  const box = `${sizes[size]} shrink-0 rounded-full`
  if (user.avatarKey) {
    return <img src={imageUrl(user.avatarKey)} alt={user.displayName} className={`${box} bg-zinc-100 object-cover`} />
  }
  return (
    <span aria-hidden="true" className={`${box} grid place-items-center bg-zinc-100 font-semibold text-zinc-700 uppercase`}>
      {user.displayName.slice(0, 1)}
    </span>
  )
}

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { Field, FormField } from '@shared/components/FormField'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage, fieldErrors } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { photoProblem } from '../../features/listings/photos'
import { profileApi } from '../../features/profile/profileApi'

const BIO_MAX = 150

export default function EditProfilePage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  // bio กับที่อยู่ไม่อยู่ใน AuthUser จึงโหลดค่าเดิมจากโปรไฟล์สาธารณะของตัวเอง
  const { data } = useResource(async () => (user ? profileApi.get(user.username) : null), user?.username ?? '')
  const [error, setError] = useState<unknown>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bioLength, setBioLength] = useState<number | null>(null)

  if (!user) return null
  if (!data) return <Spinner />
  const { profile } = data

  const onAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const bad = photoProblem(file)
    if (bad) {
      setAvatarError(bad)
      return
    }
    setAvatarError(null)
    setBusy(true)
    try {
      updateUser(await profileApi.uploadAvatar(file))
    } catch (err) {
      setAvatarError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onRemoveAvatar = async () => {
    setBusy(true)
    try {
      updateUser(await profileApi.removeAvatar())
    } catch (err) {
      setAvatarError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const updated = await profileApi.update({
        displayName: String(form.get('displayName')),
        username: String(form.get('username')),
        bio: String(form.get('bio')),
        location: String(form.get('location')),
      })
      updateUser(updated)
      navigate(`/u/${updated.username}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const fields = fieldErrors(error)
  return (
    <section className="mx-auto max-w-lg space-y-8">
      <div>
        <Link to="/profile" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← โปรไฟล์
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">แก้ไขโปรไฟล์</h1>
      </div>

      <div className="flex items-center gap-4 rounded-3xl bg-zinc-50 p-4">
        <Avatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">@{user.username}</div>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            <label className={`font-medium text-blue-600 ${busy ? 'opacity-50' : 'cursor-pointer hover:underline'}`}>
              เปลี่ยนรูปโปรไฟล์
              <input type="file" accept="image/*" disabled={busy} onChange={onAvatar} className="sr-only" />
            </label>
            {user.avatarKey && (
              <button type="button" onClick={onRemoveAvatar} disabled={busy} className="text-zinc-500 hover:underline">
                ลบรูป
              </button>
            )}
          </div>
          {avatarError && <p className="mt-1 text-sm text-red-600">{avatarError}</p>}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error !== null && Object.keys(fields).length === 0 && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
        )}
        <FormField
          label="ชื่อที่แสดง"
          name="displayName"
          required
          maxLength={50}
          defaultValue={user.displayName}
          errors={fields.displayName}
        />
        <FormField
          label="ชื่อผู้ใช้"
          name="username"
          required
          minLength={3}
          maxLength={20}
          defaultValue={user.username}
          autoCapitalize="none"
          spellCheck={false}
          hint={`ลิงก์โปรไฟล์ของคุณ: /u/ชื่อผู้ใช้ ใช้ได้ a-z, 0-9, _ และ . ยาว 3-20 ตัว`}
          errors={fields.username}
        />
        <Field
          label="แนะนำตัว"
          name="bio"
          errors={fields.bio}
          hint={`${bioLength ?? (profile.bio ?? '').length}/${BIO_MAX}`}
        >
          {(aria) => (
            <textarea
              name="bio"
              rows={3}
              maxLength={BIO_MAX}
              defaultValue={profile.bio ?? ''}
              onChange={(e) => setBioLength(e.target.value.length)}
              placeholder="เช่น สะสม Pokémon ญี่ปุ่น รับแลกการ์ด SAR"
              className="input"
              {...aria}
            />
          )}
        </Field>
        <FormField
          label="ที่อยู่ (ไม่บังคับ)"
          name="location"
          maxLength={60}
          defaultValue={profile.location ?? ''}
          placeholder="เช่น เชียงใหม่"
          hint="แสดงให้คนอื่นเห็น ใส่แค่จังหวัดก็พอ ไม่ต้องใส่ที่อยู่เต็ม"
          errors={fields.location}
        />
        <button type="submit" disabled={busy} className="btn btn-primary w-full py-3">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </form>
    </section>
  )
}

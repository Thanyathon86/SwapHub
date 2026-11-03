import logoFull from './logo-full.webp'
import logoMark from './logo-mark.webp'

// รูปมีพื้นขาว จึงวางในกรอบขาวมุมมน ใช้ได้ทุกพื้นหลัง รวมถึงเมนูสีเข้มของหลังบ้าน
// alt ว่างเป็นค่าเริ่มต้น เพราะส่วนใหญ่มีชื่อแบรนด์เป็นข้อความอยู่ข้าง ๆ แล้ว
type Props = { className?: string; alt?: string }

// โลโก้เต็มรายละเอียดเยอะ เล็กกว่า 56px จะอ่านไม่ออก จุดเล็กอย่าง header ให้ใช้แบบครอปเฉพาะการ์ดกับลูกศร
export function LogoMark({ className = 'size-10', alt = '' }: Props) {
  return <img src={logoMark} alt={alt} className={`shrink-0 rounded-lg bg-white ${className}`} />
}

// ใช้ตั้งแต่ประมาณ 96px ขึ้นไป
export function LogoFull({ className = 'size-24', alt = '' }: Props) {
  return <img src={logoFull} alt={alt} className={`shrink-0 rounded-2xl bg-white ${className}`} />
}

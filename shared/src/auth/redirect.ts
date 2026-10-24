// รับเฉพาะ path ภายในเว็บ กัน open redirect ถ้ามีคนยัด URL ภายนอกมาใน state
export const safeRedirect = (from: unknown) =>
  typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'

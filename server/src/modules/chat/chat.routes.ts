import { Router, type Request, type Response } from 'express'
import { isSessionActive, SESSION_COOKIE } from '../../lib/session.js'
import { chatImageLimiter, chatSendLimiter } from '../../middleware/rateLimit.js'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { uploadImage } from '../../middleware/uploadImage.js'
import { validate } from '../../middleware/validate.js'
import { addStream, removeStream } from './chatEvents.js'
import {
  conversationIdParams,
  messageIdParams,
  messagesQuery,
  openConversationSchema,
  sendMessageSchema,
  type ConversationIdParams,
  type MessageIdParams,
  type MessagesQuery,
  type OpenConversationInput,
  type SendMessageInput,
} from './chat.schema.js'
import * as chatService from './chat.service.js'

const HEARTBEAT_MS = 25_000
// session อาจถูกลบระหว่างที่ต่ออยู่ เช่น ออกจากระบบหรือเปลี่ยนรหัสผ่าน
const SESSION_CHECK_MS = 30_000

export const chatRouter = Router()

chatRouter.use(requireAuth)

chatRouter.get('/events', (req: Request, res: Response) => {
  const userId = getAuthUser(req).id
  const token = req.cookies?.[SESSION_COOKIE] as string
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    // nginx เก็บ response ไว้ก่อนส่งถ้าไม่บอก ข้อความจะไม่มาทันที
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write(': connected\n\n')
  addStream(userId, res)

  // proxy หลายตัวตัดการเชื่อมต่อที่เงียบนานเกินไป
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
  const sessionCheck = setInterval(() => {
    isSessionActive(token).then(
      (active) => {
        if (!active) res.end()
      },
      // DB สะดุดชั่วคราวไม่ต้องตัด รอรอบถัดไป
      () => undefined,
    )
  }, SESSION_CHECK_MS)

  res.on('close', () => {
    clearInterval(heartbeat)
    clearInterval(sessionCheck)
    removeStream(userId, res)
  })
})

chatRouter.get('/conversations', async (req, res) => {
  res.json({ conversations: await chatService.listConversations(getAuthUser(req).id) })
})

chatRouter.post('/conversations', validate({ body: openConversationSchema }), async (req, res) => {
  res.json({ conversation: await chatService.openConversation(getAuthUser(req).id, req.body as OpenConversationInput) })
})

chatRouter.get('/conversations/:id', validate({ params: conversationIdParams }), async (req, res) => {
  const { id } = req.params as ConversationIdParams
  res.json({ conversation: await chatService.getConversation(getAuthUser(req).id, id) })
})

chatRouter.get('/conversations/:id/messages', validate({ params: conversationIdParams, query: messagesQuery }), async (req, res) => {
  const { id } = req.params as ConversationIdParams
  res.json(await chatService.listMessages(getAuthUser(req).id, id, req.query as unknown as MessagesQuery))
})

// ตัวนับอยู่หลัง validate ข้อความผิดรูปแบบจะได้ไม่กินโควตา
chatRouter.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParams, body: sendMessageSchema }),
  chatSendLimiter,
  async (req, res) => {
    const { id } = req.params as ConversationIdParams
    res.status(201).json({ message: await chatService.sendMessage(getAuthUser(req).id, id, req.body as SendMessageInput) })
  },
)

// จำกัดก่อนรับไฟล์ คนที่ส่งรัวจะไม่ได้ส่งไฟล์ขึ้นมาถึง memory
chatRouter.post('/conversations/:id/images', validate({ params: conversationIdParams }), chatImageLimiter, uploadImage, async (req, res) => {
  const { id } = req.params as ConversationIdParams
  // uploadImage รับประกันว่ามี req.file แล้ว
  res.status(201).json({ message: await chatService.sendImage(getAuthUser(req).id, id, req.file!.buffer) })
})

chatRouter.post('/conversations/:id/read', validate({ params: conversationIdParams }), async (req, res) => {
  const { id } = req.params as ConversationIdParams
  await chatService.markRead(getAuthUser(req).id, id)
  res.status(204).end()
})

chatRouter.put('/conversations/:id/block', validate({ params: conversationIdParams }), async (req, res) => {
  const { id } = req.params as ConversationIdParams
  res.json({ conversation: await chatService.blockOther(getAuthUser(req).id, id) })
})

chatRouter.delete('/conversations/:id/block', validate({ params: conversationIdParams }), async (req, res) => {
  const { id } = req.params as ConversationIdParams
  res.json({ conversation: await chatService.unblockOther(getAuthUser(req).id, id) })
})

chatRouter.get('/images/:messageId', validate({ params: messageIdParams }), async (req, res) => {
  const { messageId } = req.params as MessageIdParams
  res.type('image/webp').send(await chatService.readImage(getAuthUser(req).id, messageId))
})

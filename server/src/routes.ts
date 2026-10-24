import { Router } from 'express'
import { adminRouter } from './modules/admin/admin.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { catalogPublicRouter } from './modules/catalog/catalog.routes.js'
import { listingsRouter } from './modules/listings/listings.routes.js'
import { meRouter } from './modules/me/me.routes.js'
import { offersRouter } from './modules/offers/offers.routes.js'
import { supportRouter } from './modules/support/support.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/catalog', catalogPublicRouter)
apiRouter.use('/listings', listingsRouter)
apiRouter.use('/me', meRouter)
apiRouter.use('/offers', offersRouter)
apiRouter.use('/support', supportRouter)
apiRouter.use('/admin', adminRouter)

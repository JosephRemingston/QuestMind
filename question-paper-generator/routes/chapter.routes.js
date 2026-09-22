import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { resourceId } from './shared.js';
import { details } from '../controllers/chapter.controller.js';
import a from '../utils/asyncHandler.js';
export default Router().get('/:id', requireAuth(), resourceId, a(details));

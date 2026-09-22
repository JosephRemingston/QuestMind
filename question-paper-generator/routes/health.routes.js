import { Router } from 'express';
import * as c from '../controllers/health.controller.js';
import a from '../utils/asyncHandler.js';
export default Router().get('/', a(c.health)).get('/ready', a(c.ready));

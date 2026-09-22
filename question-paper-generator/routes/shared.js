import { z } from 'zod';
import { id } from '../utils/validators.js';
import { validate } from '../middlewares/validate.middleware.js';
export const resourceId = validate(z.object({ id }).strict(), 'params');

import ApiResponse from '../utils/ApiResponse.js';
import { getChapter } from '../services/textbooks/chapter.service.js';
export const details = async (req, res) => ApiResponse.success(res, 'Chapter', await getChapter(req.params.id, req.user.id));

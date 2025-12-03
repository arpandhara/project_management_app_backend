import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requestDemotion, approveDemotion, getPendingRequests } from '../controllers/adminActionController.js';

const router = express.Router();


router.post('/demote/request', requireAuth, requireRole(['org:admin']), requestDemotion);
router.post('/demote/approve/:requestId', requireAuth, requireRole(['org:admin']), approveDemotion);
router.get('/pending', requireAuth, requireRole(['org:admin']), getPendingRequests);

export default router;
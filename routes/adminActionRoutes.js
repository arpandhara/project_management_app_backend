import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requestDemotion, approveDemotion, getPendingRequests , promoteMember } from '../controllers/adminActionController.js';

const router = express.Router();

const ALLOWED_ROLES = ['org:admin', 'admin'];

router.post('/demote/request', requireAuth, requireRole(ALLOWED_ROLES), requestDemotion);
router.post('/demote/approve/:requestId', requireAuth, requireRole(ALLOWED_ROLES), approveDemotion);
router.get('/pending', requireAuth, requireRole(ALLOWED_ROLES), getPendingRequests);
router.post('/promote', requireAuth, requireRole(ALLOWED_ROLES), promoteMember);

export default router;
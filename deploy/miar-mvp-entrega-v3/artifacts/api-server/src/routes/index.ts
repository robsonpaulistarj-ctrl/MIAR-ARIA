import { Router, type IRouter } from "express";
import healthRouter from './health';
import storiesRouter from './stories';
import conversationsRouter from './conversations';
import authRouter from './auth';
import uploadsRouter from './uploads';
import settingsRouter from './settings';

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storiesRouter);
router.use(conversationsRouter);
router.use(uploadsRouter);
router.use(settingsRouter);

export default router;

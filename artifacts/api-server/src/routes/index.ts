import { Router, type IRouter } from "express";
import healthRouter from "./health";
import edutrackAuthRouter from "./edutrack-auth";
import edutrackRouter from "./edutrack";

const router: IRouter = Router();

router.use(healthRouter);
router.use(edutrackAuthRouter);
router.use(edutrackRouter);

export default router;

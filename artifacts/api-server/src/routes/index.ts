import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import tidesRouter from "./tides";
const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(tidesRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import tidesRouter from "./tides";
import forecastRouter from "./forecast";
const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(tidesRouter);
router.use(forecastRouter);

export default router;

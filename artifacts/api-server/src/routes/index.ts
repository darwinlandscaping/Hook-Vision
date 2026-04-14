import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import tidesRouter from "./tides";
import forecastRouter from "./forecast";
import barraRouter from "./barra";
import narrateRouter from "./narrate";
import ttsRouter from "./tts";
import demosRouter from "./demos";
import lureSearchRouter from "./lureSearch";
import dataStatusRouter from "./dataStatus";
import communityRouter from "./community";
import brainRouter from "./brain";
import fishidRouter from "./fishid";
import barracheckRouter from "./barracheck";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(tidesRouter);
router.use(forecastRouter);
router.use(barraRouter);
router.use(narrateRouter);
router.use(ttsRouter);
router.use(demosRouter);
router.use(lureSearchRouter);
router.use(dataStatusRouter);
router.use(communityRouter);
router.use(brainRouter);
router.use(fishidRouter);
router.use(barracheckRouter);

export default router;

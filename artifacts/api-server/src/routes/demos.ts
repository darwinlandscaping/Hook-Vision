import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/demos/:name", (req, res) => {
  const name = req.params.name;
  if (!/^sonar-demo-[1-5]\.png$/.test(name)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const filePath = path.resolve(
    __dirname,
    "..",
    "public",
    "demos",
    name
  );

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found", path: filePath });
    return;
  }

  const stat = fs.statSync(filePath);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
});

export default router;

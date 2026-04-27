import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

// Demos 1–5 are PNG; demos 6–9 are JPEG (live sonar references)
const DEMO_FILES: Record<number, { file: string; mime: string }> = {
  1: { file: "sonar-demo-1.png", mime: "image/png"  },
  2: { file: "sonar-demo-2.png", mime: "image/png"  },
  3: { file: "sonar-demo-3.png", mime: "image/png"  },
  4: { file: "sonar-demo-4.png", mime: "image/png"  },
  5: { file: "sonar-demo-5.png", mime: "image/png"  },
  6: { file: "sonar-demo-6.jpg", mime: "image/jpeg" },
  7: { file: "sonar-demo-7.jpg", mime: "image/jpeg" },
  8: { file: "sonar-demo-8.jpg", mime: "image/jpeg" },
  9: { file: "sonar-demo-9.jpg", mime: "image/jpeg" },
};

router.get("/demos/:name", (req, res) => {
  const name = req.params.name;

  // Match sonar-demo-N.ext (N = 1–9, ext = png or jpg)
  const match = name.match(/^sonar-demo-([1-9])\.(png|jpg)$/);
  if (!match) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const num = Number(match[1]);
  const entry = DEMO_FILES[num];
  if (!entry) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const filePath = path.join(process.cwd(), "public", "demos", entry.file);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found", path: filePath });
    return;
  }

  const stat = fs.statSync(filePath);
  res.setHeader("Content-Type", entry.mime);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
});

export default router;

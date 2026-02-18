import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

const LICENSE_SERVER_URL = "https://masqr.gointerstellar.app/validate?license=";
let Fail;

// Safe async file loading
async function loadFailFile() {
  try {
    Fail = await fs.promises.readFile("Failed.html", "utf8");
  } catch (e) {
    console.warn("Failed.html not found, using fallback error page");
    Fail = "<html><body><h1>Access Denied</h1><p>License validation failed.</p></body></html>";
  }
}

loadFailFile();

export function setupMasqr(app) {
  app.use(async (req, res, next) => {
    if (req.url.includes("/ca/")) {
      next();
      return;
    }

    const authheader = req.headers.authorization;

    if (req.cookies["authcheck"]) {
      next();
      return;
    }

    if (req.cookies["refreshcheck"] !== "true") {
      res.cookie("refreshcheck", "true", { maxAge: 10000 });
      MasqFail(req, res);
      return;
    }

    if (!authheader) {
      res.setHeader("WWW-Authenticate", "Basic");
      res.status(401);
      MasqFail(req, res);
      return;
    }

    try {
      const auth = Buffer.from(authheader.split(" ")[1], "base64").toString().split(":");
      const pass = auth[1];

      if (!pass) {
        res.status(403);
        MasqFail(req, res);
        return;
      }

      const licenseCheckResponse = await fetch(
        LICENSE_SERVER_URL + encodeURIComponent(pass) + "&host=" + encodeURIComponent(req.headers.host || "unknown")
      );
      const licenseCheck = (await licenseCheckResponse.json())["status"]; 
      console.log(`License validation for ${req.headers.host}: ${licenseCheck}`);

      if (licenseCheck === "License valid") {
        res.cookie("authcheck", "true", {
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
        res.send("<script>window.location.href = window.location.href;</script>");
        return;
      }

      res.status(403);
      MasqFail(req, res);
    } catch (error) {
      console.error("License validation error:", error);
      res.status(500);
      MasqFail(req, res);
    }
  });
}

async function MasqFail(req, res) {
  if (!req.headers.host) {
    res.setHeader("Content-Type", "text/html");
    res.send(Fail || "<html><body><h1>Error</h1></body></html>");
    return;
  }

  const unsafeSuffix = req.headers.host + ".html";
  const safeSuffix = path.normalize(unsafeSuffix).replace(/^((\.\.(\/|\\|$))|\.(\.|\/|\\)$)+/, "");
  const safeJoin = path.join(process.cwd(), "Masqrd", safeSuffix);

  try {
    await fs.promises.access(safeJoin);
    const FailLocal = await fs.promises.readFile(safeJoin, "utf8");
    res.setHeader("Content-Type", "text/html");
    res.send(FailLocal);
  } catch (e) {
    res.setHeader("Content-Type", "text/html");
    res.send(Fail || "<html><body><h1>Error</h1></body></html>");
  }
}
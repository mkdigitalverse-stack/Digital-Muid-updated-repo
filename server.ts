process.env.DISABLE_HMR = "true";
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { isRazorpayConfigured, isWebhookConfigured } from "./server/razorpay.js";
import { isSupabaseServerConfigured } from "./server/supabaseServer.js";
import { handleRazorpayWebhook } from "./server/paymentWebhook.js";
import paymentRoutes from "./server/paymentRoutes.js";
import webEnquiryRoutes from "./server/webEnquiryRoutes.js";
import { seoRedirectMiddleware } from "./server/seoRedirects.js";
import { injectSeoIntoHtml } from "./server/htmlSeoInjector.js";

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const defaultPort = isProduction
    ? (process.env.PORT || "8080")
    : (process.env.DEFAULT_APP_PORT || "3000");
  const PORT = parseInt(process.env.TEST_PORT || defaultPort, 10);

  // 1. Mount Razorpay Webhook endpoint with exact raw body handling BEFORE express.json()
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "*/*" }),
    handleRazorpayWebhook
  );

  // 2. Configure JSON body parsing with raw body retention for other routes
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        // Retain unaltered raw request buffer for cryptographic verification
        if (buf && buf.length) {
          req.rawBody = buf;
        }
      },
    })
  );

  // 3. Configure URL-encoded body parsing
  app.use(express.urlencoded({ extended: true }));

  // 4. Health & Gateway Diagnostics API endpoint (read-only infrastructure check)
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      gateway: {
        razorpayConfigured: isRazorpayConfigured(),
        webhookConfigured: isWebhookConfigured(),
        supabaseServerConfigured: isSupabaseServerConfigured(),
      },
    });
  });

  // 5. Payment Gateway APIs
  app.use("/api/payments", paymentRoutes);

  // 6. Web Project Enquiries CRM APIs
  app.use("/api/web-enquiries", webEnquiryRoutes);

  // 7. API 404 handler - prevents unhandled API requests from returning index.html
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // 8. Legacy WordPress 301 Redirects & 410 Retirements Middleware
  app.use(seoRedirectMiddleware);

  // 9. Vite middleware for development / Static fallback for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.includes(".")) {
        return next();
      }
      try {
        const templatePath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl || req.url, template);
        const finalHtml = injectSeoIntoHtml(template, req.path);
        res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(finalHtml);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const indexPath = path.join(distPath, "index.html");

    app.use(express.static(distPath, { index: false, redirect: false }));

    app.get("*", (req, res) => {
      try {
        if (!fs.existsSync(indexPath)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(200).send("<!doctype html><html><head><title>Loading...</title></head><body>Application is starting up...</body></html>");
        }

        const cleanSubdir = req.path.replace(/^\/+/, "").replace(/\/+$/, "");
        const specificHtmlPath = cleanSubdir ? path.join(distPath, cleanSubdir, "index.html") : indexPath;

        let html = fs.existsSync(specificHtmlPath)
          ? fs.readFileSync(specificHtmlPath, "utf8")
          : fs.readFileSync(indexPath, "utf8");

        html = injectSeoIntoHtml(html, req.path);

        // Strictly client-safe environment variables - server secrets MUST NEVER be included
        const clientEnv = {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "",
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "",
          VITE_RAZORPAY_KEY_ID: process.env.VITE_RAZORPAY_KEY_ID || "",
        };

        const serializedEnv = JSON.stringify(clientEnv).replace(/</g, "\\u003c");
        const envScript = `<script>window.__ENV__ = Object.assign(window.__ENV__ || {}, ${serializedEnv});</script>`;

        if (html.includes("</head>")) {
          html = html.replace("</head>", `${envScript}</head>`);
        } else {
          html = envScript + html;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
      } catch (_err) {
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send("<!doctype html><html><head><title>Loading...</title></head><body>Application is starting up...</body></html>");
        }
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (isRazorpayConfigured()) {
      console.log("[Payment Gateway] Razorpay server credentials detected.");
    } else {
      console.log("[Payment Gateway] Razorpay server credentials not configured (development mode).");
    }
  });
}

startServer();

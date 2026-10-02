import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

const PORT = Number(process.env.APP_PORT || 3865);
const webDir = path.join(process.cwd(), "web");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

/**
 * Inicia o servidor HTTP local para servir o site oficial (pasta web)
 * e despachar a abertura de aplicativos no computador.
 */
export function startAppLauncherServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      // Rota de disparo de aplicativo
      if (url.pathname === "/app") {
        const platform = url.searchParams.get("platform");
        const id = url.searchParams.get("id");
        const slug = url.searchParams.get("slug");
        const webUrl =
          url.searchParams.get("web") ||
          (platform === "steam" ? "https://store.steampowered.com/" : "https://store.epicgames.com/");

        let targetUri = "";
        let appName = "";

        if (platform === "steam") {
          targetUri = `steam://store/${id}`;
          appName = "Steam";
        } else if (platform === "epic") {
          targetUri = `com.epicgames.launcher://store/product/${slug}`;
          appName = "Epic Games Launcher";
        }

        // Tenta acionar diretamente no Windows se for Windows
        if (targetUri && process.platform === "win32") {
          exec(`start "" "${targetUri}"`, (err) => {
            if (err) {
              console.warn(`[AppLauncher] Não foi possível abrir o protocolo via start: ${err.message}`);
            }
          });
        }

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abrindo ${appName}...</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0; background: #0f141c; color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    .card {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      padding: 36px 30px; text-align: center; max-width: 440px; width: 90%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .icon { font-size: 48px; margin-bottom: 12px; }
    h2 { margin: 0 0 10px 0; font-size: 22px; color: #fff; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; }
    .btn {
      display: block; width: 100%; padding: 12px 18px; border-radius: 8px;
      font-size: 15px; font-weight: 600; text-decoration: none; margin-bottom: 10px;
    }
    .btn-primary { background: #0078f2; color: #fff; }
    .btn-secondary { background: #334155; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚀</div>
    <h2>Abrindo ${appName}...</h2>
    <p>O aplicativo deve abrir automaticamente no seu computador caso esteja instalado.</p>
    <a href="${targetUri}" class="btn btn-primary">Clique aqui para abrir no Aplicativo</a>
    <a href="${webUrl}" class="btn btn-secondary">Abrir pelo Navegador (Site)</a>
  </div>
  <script>
    const uri = "${targetUri}";
    if (uri) {
      window.location.href = uri;
      setTimeout(() => { try { window.close(); } catch(e) {} }, 3000);
    }
  </script>
</body>
</html>`;

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      }

      // Servidor estático da pasta WEB
      let filePath = path.join(webDir, url.pathname === "/" ? "index.html" : url.pathname);
      
      // Previne Directory Traversal
      if (!filePath.startsWith(webDir)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        return res.end("Forbidden");
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        return fs.createReadStream(filePath).pipe(res);
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`🌐 Servidor Web e Disparador de Apps ativo em: http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[WebServer] Porta ${PORT} já em uso.`);
    } else {
      console.error("[WebServer] Erro no servidor HTTP:", err.message);
    }
  });

  return server;
}

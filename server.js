const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "java.script");
const DB_PATH = process.env.DB_PATH || path.join(PUBLIC_DIR, "db.json");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

async function ensureDbFile() {
  try {
    await fs.access(DB_PATH);
  } catch (error) {
    await fs.writeFile(DB_PATH, JSON.stringify({ users: [] }, null, 2));
  }
}

async function readUsers() {
  await ensureDbFile();

  const raw = await fs.readFile(DB_PATH, "utf8");

  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && Array.isArray(parsed.users)) {
      return parsed.users;
    }
  } catch (error) {
    return [];
  }

  return [];
}

async function writeUsers(users) {
  await fs.writeFile(DB_PATH, JSON.stringify({ users }, null, 2));
}

function getRequestUrl(request) {
  return new URL(request.url || "/", "http://127.0.0.1");
}

function getUserIdFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 3 ? parts[2] : null;
}

function createUser(payload) {
  return {
    id: Date.now(),
    name: String(payload.name || "").trim(),
    email: String(payload.email || "").trim(),
    phone: String(payload.phone || "").trim(),
    website: String(payload.website || "").trim(),
  };
}

function isValidUser(user) {
  return user.name && user.email && user.phone && user.website;
}

function updateUser(oldUser, payload) {
  return {
    ...oldUser,
    name: String(payload.name || "").trim(),
    email: String(payload.email || "").trim(),
    phone: String(payload.phone || "").trim(),
    website: String(payload.website || "").trim(),
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}

async function handleApi(request, response) {
  const requestUrl = getRequestUrl(request);
  const userId = getUserIdFromPath(requestUrl.pathname);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && !userId) {
    const users = await readUsers();
    sendJson(response, 200, users);
    return;
  }

  if (request.method === "POST" && !userId) {
    const rawBody = await readRequestBody(request);
    const parsedBody = rawBody ? JSON.parse(rawBody) : {};
    const user = createUser(parsedBody);

    if (!isValidUser(user)) {
      sendJson(response, 400, { message: "Barcha maydonlar majburiy." });
      return;
    }

    const users = await readUsers();
    users.unshift(user);
    await writeUsers(users);
    sendJson(response, 201, user);
    return;
  }

  if (request.method === "PUT" && userId) {
    const rawBody = await readRequestBody(request);
    const parsedBody = rawBody ? JSON.parse(rawBody) : {};
    const users = await readUsers();
    const userIndex = users.findIndex(
      (user) => String(user.id) === String(userId),
    );

    if (userIndex === -1) {
      sendJson(response, 404, { message: "Card topilmadi." });
      return;
    }

    const editedUser = updateUser(users[userIndex], parsedBody);

    if (!isValidUser(editedUser)) {
      sendJson(response, 400, { message: "Barcha maydonlar majburiy." });
      return;
    }

    users[userIndex] = editedUser;
    await writeUsers(users);
    sendJson(response, 200, editedUser);
    return;
  }

  if (request.method === "DELETE" && userId) {
    const users = await readUsers();
    const filteredUsers = users.filter(
      (user) => String(user.id) !== String(userId),
    );

    if (filteredUsers.length === users.length) {
      sendJson(response, 404, { message: "Card topilmadi." });
      return;
    }

    await writeUsers(filteredUsers);
    sendJson(response, 200, { success: true });
    return;
  }

  sendJson(response, 405, { message: "Bu method qo'llab-quvvatlanmaydi." });
}

async function handleStatic(request, response) {
  const requestUrl = getRequestUrl(request);
  const requestPath =
    requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(response, 403, "Ruxsat yo'q.");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory()
      ? path.join(filePath, "index.html")
      : filePath;
    const extension = path.extname(finalPath).toLowerCase();
    const contentType =
      CONTENT_TYPES[extension] || "application/octet-stream";
    const content = await fs.readFile(finalPath);

    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": contentType,
    });
    response.end(content);
  } catch (error) {
    sendText(response, 404, "Fayl topilmadi.");
  }
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      if (!request.url) {
        sendText(response, 400, "So'rov noto'g'ri.");
        return;
      }

      if (getRequestUrl(request).pathname.startsWith("/api/users")) {
        await handleApi(request, response);
        return;
      }

      await handleStatic(request, response);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: "JSON noto'g'ri yuborildi." });
        return;
      }

      sendJson(response, 500, { message: "Serverda xatolik yuz berdi." });
    }
  });
}

if (require.main === module) {
  const server = createServer();

  server.listen(PORT, () => {
    console.log(`Server ishga tushdi: http://127.0.0.1:${PORT}`);
  });
}

module.exports = {
  createServer,
};

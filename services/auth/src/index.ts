import "dotenv/config";
import http from "node:http";
import express, { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { createMemoryRepository, type PublicUser, type Repository } from "@taxico/shared";

const PORT = Number(process.env.PORT ?? 4001);
const JWT_SECRET = process.env.JWT_SECRET ?? "taxico-dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production. Refusing to start on the insecure dev fallback.");
}

interface StoredUser extends PublicUser {
  passwordHash: string;
}

// PostgreSQL-backed in production; in-memory for the MVP (see @taxico/shared infra).
const users: Repository<StoredUser> = createMemoryRepository<StoredUser>();

const publicView = (u: StoredUser): PublicUser => {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
};
const makeId = () => "u-" + Math.random().toString(36).slice(2, 10);
const byEmail = (email: string) => users.find((u) => u.email === email.toLowerCase());

function signToken(user: PublicUser): string {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

async function seedDemoUsers() {
  if (users.all().length > 0) return;
  const demo = [
    { name: "Administrator", email: "admin@taxico.cm", password: "taxico-admin", role: "admin" as const },
    { name: "Awa the Driver", email: "driver@taxico.cm", password: "taxico-driver", role: "driver" as const },
    { name: "Bih the Passenger", email: "passenger@taxico.cm", password: "taxico-pass", role: "passenger" as const },
  ];
  for (const d of demo) {
    users.insert({
      id: makeId(),
      name: d.name,
      email: d.email.toLowerCase(),
      role: d.role,
      createdAt: Date.now(),
      passwordHash: await bcrypt.hash(d.password, 10),
    });
  }
}

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: unknown) => {
      const status = (err as { status?: number }).status ?? 400;
      res.status(status).json({ error: err instanceof Error ? err.message : "Request failed." });
    });
  };
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["driver", "passenger"]),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const app = express();
app.use(express.json());

app.post(
  "/register",
  handle(async (req, res) => {
    const input = registerSchema.parse(req.body);
    if (byEmail(input.email)) {
      throw Object.assign(new Error("An account with that email already exists."), { status: 409 });
    }
    const user = users.insert({
      id: makeId(),
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      createdAt: Date.now(),
      passwordHash: await bcrypt.hash(input.password, 10),
    });
    const view = publicView(user);
    res.status(201).json({ user: view, token: signToken(view) });
  }),
);

app.post(
  "/login",
  handle(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = byEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw Object.assign(new Error("Invalid email or password."), { status: 401 });
    }
    const view = publicView(user);
    res.json({ user: view, token: signToken(view) });
  }),
);

// Identity, resolved from the gateway-verified `x-user-id` header.
app.get("/me", (req, res) => {
  const id = req.header("x-user-id");
  const user = id ? users.get(id) : undefined;
  if (!user) return res.status(401).json({ error: "Authentication required." });
  res.json(publicView(user));
});

// Internal: consumed by the gateway's admin aggregation.
app.get("/users", (_req, res) => res.json({ users: users.all().map(publicView) }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "auth" }));

async function main() {
  await seedDemoUsers();
  http.createServer(app).listen(PORT, () => console.log(`[auth] listening on :${PORT}`));
}
main().catch((err) => {
  console.error("[auth] failed to start:", err);
  process.exit(1);
});

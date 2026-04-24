process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const { buildApp } = require("./helpers");

const app = buildApp();

describe("POST /auth/register", () => {
    it("creates a user and returns 201", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "a@test.com", password: "password123", name: "Alice" });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe("User registered");
    });

    it("returns 409 on duplicate email", async () => {
        const payload = { email: "dup@test.com", password: "password123", name: "Bob" };
        await request(app).post("/auth/register").send(payload);
        const res = await request(app).post("/auth/register").send(payload);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already registered/i);
    });

    it("returns 400 for invalid email", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "notanemail", password: "password123", name: "Carol" });
        expect(res.status).toBe(400);
    });

    it("returns 400 for short password", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "c@test.com", password: "short", name: "Dave" });
        expect(res.status).toBe(400);
    });

    it("returns 400 when name is missing", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "e@test.com", password: "password123" });
        expect(res.status).toBe(400);
    });
});

describe("POST /auth/login", () => {
    beforeEach(async () => {
        await request(app)
            .post("/auth/register")
            .send({ email: "login@test.com", password: "password123", name: "Eve" });
    });

    it("returns a JWT token on valid credentials", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "login@test.com", password: "password123" });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(res.body.name).toBe("Eve");
    });

    it("returns 401 on wrong password", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "login@test.com", password: "wrongpass" });
        expect(res.status).toBe(401);
    });

    it("returns 401 for unknown email", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "nobody@test.com", password: "password123" });
        expect(res.status).toBe(401);
    });
});

process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const { buildApp } = require("./helpers");

const app = buildApp();

async function registerAndLogin(email = "pet-user@test.com") {
    await request(app)
        .post("/v1/auth/register")
        .send({ email, password: "password123", name: "Tester" });
    const res = await request(app)
        .post("/v1/auth/login")
        .send({ email, password: "password123" });
    return res.body.token;
}

describe("GET /v1/pets", () => {
    it("returns 401 without token", async () => {
        const res = await request(app).get("/v1/pets");
        expect(res.status).toBe(401);
    });

    it("returns paginated empty result for new user", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .get("/v1/pets")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.total).toBe(0);
        expect(res.body.page).toBe(1);
    });

    it("respects page and limit query params", async () => {
        const token = await registerAndLogin("paginate@test.com");
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post("/v1/pets")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: `Pet${i}`, species: "cat" });
        }
        const res = await request(app)
            .get("/v1/pets?page=1&limit=2")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.total).toBe(3);
        expect(res.body.pages).toBe(2);
    });
});

describe("POST /v1/pets", () => {
    it("creates a pet and returns 201", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Buddy", species: "dog", breed: "Labrador", age_years: 3 });
        expect(res.status).toBe(201);
        expect(res.body.name).toBe("Buddy");
        expect(res.body.species).toBe("dog");
        expect(res.body._id).toBeDefined();
    });

    it("returns 400 when name is missing", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token}`)
            .send({ species: "cat" });
        expect(res.status).toBe(400);
    });

    it("returns 400 when species is missing", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Whiskers" });
        expect(res.status).toBe(400);
    });
});

describe("GET /v1/pets/:id", () => {
    it("returns the pet by id", async () => {
        const token = await registerAndLogin();
        const create = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Rex", species: "dog" });
        const id = create.body._id;

        const res = await request(app)
            .get(`/v1/pets/${id}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Rex");
    });

    it("returns 404 for another user's pet", async () => {
        const token1 = await registerAndLogin("owner@test.com");
        const token2 = await registerAndLogin("other@test.com");

        const create = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token1}`)
            .send({ name: "Mine", species: "cat" });
        const id = create.body._id;

        const res = await request(app)
            .get(`/v1/pets/${id}`)
            .set("Authorization", `Bearer ${token2}`);
        expect(res.status).toBe(404);
    });
});

describe("DELETE /v1/pets/:id", () => {
    it("deletes the pet and returns 204", async () => {
        const token = await registerAndLogin();
        const create = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Goldie", species: "fish" });
        const id = create.body._id;

        const del = await request(app)
            .delete(`/v1/pets/${id}`)
            .set("Authorization", `Bearer ${token}`);
        expect(del.status).toBe(204);

        const get = await request(app)
            .get(`/v1/pets/${id}`)
            .set("Authorization", `Bearer ${token}`);
        expect(get.status).toBe(404);
    });

    it("returns 404 when deleting another user's pet", async () => {
        const token1 = await registerAndLogin("delowner@test.com");
        const token2 = await registerAndLogin("delother@test.com");

        const create = await request(app)
            .post("/v1/pets")
            .set("Authorization", `Bearer ${token1}`)
            .send({ name: "NotYours", species: "rabbit" });
        const id = create.body._id;

        const res = await request(app)
            .delete(`/v1/pets/${id}`)
            .set("Authorization", `Bearer ${token2}`);
        expect(res.status).toBe(404);
    });
});

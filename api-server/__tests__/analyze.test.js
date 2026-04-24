process.env.JWT_SECRET = "test-secret";

// Mock the BullMQ queue so tests don't need Redis
const mockJob = { id: "mock-job-123" };
const mockGetJob = jest.fn();
jest.mock("../queue/analysisQueue", () => ({
    getQueue: jest.fn(() => ({
        add: jest.fn(async () => mockJob),
        getJob: mockGetJob,
    })),
}));

const request = require("supertest");
const { buildApp, makeWavBuffer } = require("./helpers");

let app;

beforeEach(() => {
    app = buildApp();
    mockGetJob.mockReset();
});

async function getToken() {
    await request(app)
        .post("/v1/auth/register")
        .send({ email: "analyze@test.com", password: "password123", name: "Tester" });
    const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: "analyze@test.com", password: "password123" });
    return res.body.token;
}

describe("POST /v1/analyze", () => {
    it("returns 401 without token", async () => {
        const res = await request(app)
            .post("/v1/analyze")
            .attach("audio", makeWavBuffer(), { filename: "test.wav", contentType: "audio/wav" });
        expect(res.status).toBe(401);
    });

    it("accepts audio and returns 202 with jobId", async () => {
        const token = await getToken();
        const res = await request(app)
            .post("/v1/analyze")
            .set("Authorization", `Bearer ${token}`)
            .attach("audio", makeWavBuffer(), { filename: "test.wav", contentType: "audio/wav" });
        expect(res.status).toBe(202);
        expect(res.body.jobId).toBe("mock-job-123");
        expect(res.body.message).toMatch(/queued/i);
    });

    it("returns 400 when no audio file is attached", async () => {
        const token = await getToken();
        const res = await request(app)
            .post("/v1/analyze")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 415 for non-audio file type", async () => {
        const token = await getToken();
        const res = await request(app)
            .post("/v1/analyze")
            .set("Authorization", `Bearer ${token}`)
            .attach("audio", Buffer.from("fake pdf"), { filename: "doc.pdf", contentType: "application/pdf" });
        expect(res.status).toBe(415);
    });
});

describe("GET /v1/analyze/status/:jobId", () => {
    it("returns 401 without token", async () => {
        const res = await request(app).get("/v1/analyze/status/abc123");
        expect(res.status).toBe(401);
    });

    it("returns 404 for unknown jobId", async () => {
        mockGetJob.mockResolvedValue(null);
        const token = await getToken();
        const res = await request(app)
            .get("/v1/analyze/status/unknown-id")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it("returns job state for known jobId", async () => {
        mockGetJob.mockResolvedValue({
            id: "mock-job-123",
            getState: async () => "completed",
            returnvalue: { intent_label: "play or excitement" },
            failedReason: null,
        });
        const token = await getToken();
        const res = await request(app)
            .get("/v1/analyze/status/mock-job-123")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.state).toBe("completed");
        expect(res.body.jobId).toBe("mock-job-123");
    });
});

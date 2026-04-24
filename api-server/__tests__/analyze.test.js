process.env.JWT_SECRET = "test-secret";

jest.mock("axios");
const axios = require("axios");

const request = require("supertest");
const { buildApp, makeWavBuffer } = require("./helpers");

const MOCK_AI_RESPONSE = {
    intent_label: "play or excitement",
    intent_confidence: 0.87,
    intent_probs: {
        "play or excitement": 0.87,
        "hunger or food request": 0.06,
        "contentment or relaxation": 0.04,
        "attention seeking": 0.02,
        other: 0.01,
    },
    fused_embedding_shape: [768],
    audio_features: { duration_seconds: 1.5, mel_shape: [128, 32], centroid_shape: [32] },
    naturelm_raw_output: "playful",
    naturelm_intent: "play or excitement",
    rvc_enhancement_applied: false,
};

let app;
let emitSpy;

beforeEach(() => {
    emitSpy = jest.fn();
    const mockIo = { to: jest.fn(() => ({ emit: emitSpy })) };
    app = buildApp({ mockIo });
    axios.post.mockResolvedValue({ data: MOCK_AI_RESPONSE });
});

afterEach(() => {
    jest.clearAllMocks();
});

async function getToken() {
    await request(app)
        .post("/auth/register")
        .send({ email: "analyze@test.com", password: "password123", name: "Tester" });
    const res = await request(app)
        .post("/auth/login")
        .send({ email: "analyze@test.com", password: "password123" });
    return res.body.token;
}

describe("POST /analyze", () => {
    it("returns 401 without token", async () => {
        const res = await request(app).post("/analyze").attach("audio", makeWavBuffer(), "test.wav");
        expect(res.status).toBe(401);
    });

    it("forwards audio to AI service and returns result", async () => {
        const token = await getToken();
        const res = await request(app)
            .post("/analyze")
            .set("Authorization", `Bearer ${token}`)
            .attach("audio", makeWavBuffer(), "test.wav");
        expect(res.status).toBe(200);
        expect(res.body.intent_label).toBe("play or excitement");
        expect(res.body.intent_confidence).toBe(0.87);
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it("emits analysis_complete over WebSocket after success", async () => {
        const token = await getToken();
        await request(app)
            .post("/analyze")
            .set("Authorization", `Bearer ${token}`)
            .attach("audio", makeWavBuffer(), "test.wav");
        expect(emitSpy).toHaveBeenCalledWith(
            "analysis_complete",
            expect.objectContaining({ userId: "analyze@test.com" })
        );
    });

    it("returns 400 when no audio file is attached", async () => {
        const token = await getToken();
        const res = await request(app)
            .post("/analyze")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns AI service error status on upstream failure", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 422, data: { detail: "Unsupported audio format" } },
        });
        const token = await getToken();
        const res = await request(app)
            .post("/analyze")
            .set("Authorization", `Bearer ${token}`)
            .attach("audio", makeWavBuffer(), "test.wav");
        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/unsupported audio format/i);
    });
});

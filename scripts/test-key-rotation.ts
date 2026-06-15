import { KeyRotator } from "../lib/util/keys";

async function main() {
  console.log("=== Key Rotator Smoke Test ===\n");
  
  // Set up mock keys in environment
  process.env.MOCK_API_KEYS = "key_A, key_B, key_C";
  const rotator = new KeyRotator("MOCK_API_KEYS");

  console.log(`Initial Key: ${rotator.getKey()}`);

  // Simulate an API call that fails with a 429 Rate Limit error
  const mockApiCall = async (key: string) => {
    console.log(`[API Call] Trying with key: ${key}`);
    if (key === "key_A" || key === "key_B") {
      const error: any = new Error("Rate limit exceeded");
      error.status = 429;
      throw error;
    }
    return `Success with ${key}!`;
  };

  try {
    const result = await rotator.executeWithRotation(mockApiCall);
    console.log(`\n[Result] ${result}`);
  } catch (err: any) {
    console.error(`\n[Result] Failed: ${err.message}`);
  }

  console.log(`\nFinal Key in use: ${rotator.getKey()}`);
  console.log("\n✅ Key rotation test complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

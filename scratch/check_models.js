const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    console.log("Listing available models...");
    // The listModels method is available on the genAI instance or through a different path in newer SDKs
    // Actually, in @google/generative-ai, there isn't a top-level listModels. 
    // It's often accessed via the REST API or a different package.
    // However, let's try gemini-pro and gemini-1.5-pro
    
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
    for (const m of modelsToTry) {
      try {
        console.log(`Trying ${m}...`);
        const model = genAI.getGenerativeModel({ model: m });
        await model.generateContent("test");
        console.log(`Success with ${m}`);
        return;
      } catch (e) {
        console.error(`Failed ${m}: ${e.message}`);
      }
    }
  } catch (error) {
    console.error("General error:", error.message);
  }
}

listModels();

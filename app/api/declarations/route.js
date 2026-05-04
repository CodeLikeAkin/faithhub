import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyUserIntent, getDeclarations } from "@/lib/gemini";

// Initialize Supabase with Service Role Key for backend access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { message, topic: explicitTopic, shownIds = [] } = await request.json();

    // 1. Detect Intent if no explicit topic is provided
    let searchTopic = explicitTopic;
    let keywords = [];

    if (!searchTopic || searchTopic === "all") {
      const classification = await classifyUserIntent(message);
      searchTopic = classification.topic;
      keywords = classification.keywords || [];
    }

    // 2. Build Query with Sermon Join
    let query = supabase
      .from("declarations")
      .select(`
        id,
        declaration_text,
        youtube_url_with_timestamp,
        topic_tags,
        sermons (
          title,
          youtube_url
        )
      `);

    // 3. Apply Filters
    const conditions = [];

    // Filter by topic tag
    if (searchTopic && searchTopic !== "all") {
      conditions.push(`topic_tags.cs.{${searchTopic.toLowerCase()}}`);
    }

    // Fallback: Filter by keywords if no topic or as supplement
    if (keywords.length > 0) {
      const keywordFilter = keywords.map(kw => `declaration_text.ilike.%${kw}%`).join(',');
      // Note: Supabase JS doesn't support complex OR across columns easily without a raw query or multiple calls
      // For simplicity, we'll use a text search filter if keywords exist
      query = query.or(`declaration_text.ilike.%${keywords[0]}%,topic_tags.cs.{${searchTopic || ''}}`);
    } else if (searchTopic && searchTopic !== "all") {
      query = query.contains("topic_tags", [searchTopic.toLowerCase()]);
    }

    // 4. Exclude already shown declarations
    if (shownIds && shownIds.length > 0) {
      query = query.not('id', 'in', `(${shownIds.join(',')})`);
    }

    // 5. Fetch 11 to determine hasMore
    const { data, error } = await query.limit(11);

    if (error) {
      console.error("Supabase Query Error:", error);
      throw error;
    }

    // 6. Handle empty case (fallback to general if specific search failed)
    let finalData = data;
    if (!finalData || finalData.length === 0) {
      const fallbackRes = await supabase
        .from("declarations")
        .select(`id, declaration_text, youtube_url_with_timestamp, topic_tags, sermons(title, youtube_url)`)
        .limit(11);
      finalData = fallbackRes.data;
    }

    // 7. Determine hasMore and prepare return set
    const hasMore = finalData?.length > 10;
    const declarationsToReturn = finalData?.slice(0, 10) || [];

    // 8. Format for the frontend UI
    const declarations = declarationsToReturn.map(d => ({
      id: d.id,
      declaration_text: d.declaration_text,
      sermon_title: d.sermons?.title || "Heritage of Faith Church",
      youtube_url_with_timestamp: d.youtube_url_with_timestamp || d.sermons?.youtube_url || "",
      topic_tags: d.topic_tags
    }));

    // 9. Generate AI response
    const botResponse = await getDeclarations(message, declarations);

    return NextResponse.json({
      response: botResponse,
      declarations,
      hasMore
    });

  } catch (error) {
    console.error("[api/declarations/route] POST error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve declarations. Please try again." },
      { status: 500 }
    );
  }
}

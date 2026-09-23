// Example questions for the Ask empty state, grouped by theme. Drawn from the
// subjects Rev. Peter's messages cover most deeply, so each one grounds well.
// Fixed order (no shuffle) keeps server and client renders identical.

export const EXAMPLE_THEMES = [
  {
    title: "Faith",
    blurb: "Believing before you see",
    questions: [
      "Walking in faith before things change",
      "Faith versus feelings — what wins?",
      "Dealing with unbelief in prayer",
    ],
  },
  {
    title: "New creation",
    blurb: "Who you are in Christ",
    questions: [
      "What born again really means",
      "The believer's righteousness in Christ",
      "Our eternal life — can it be lost?",
    ],
  },
  {
    title: "The Holy Spirit",
    blurb: "His leading and His help",
    questions: [
      "Recognising the Holy Spirit's leading",
      "How the Holy Spirit helps us pray",
      "What being filled with the Spirit means",
    ],
  },
  {
    title: "Church & blessing",
    blurb: "Living it out together",
    questions: [
      "Why Rev. Peter values the local church",
      "How to activate the blessing",
      "Giving as an act of faith",
    ],
  },
];

/** One from each theme — the short list shown after a "nothing found" answer. */
export const STARTER_QUESTIONS = EXAMPLE_THEMES.map((t) => t.questions[0]);

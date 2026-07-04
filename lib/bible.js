/**
 * Bible verse text via the AO Lab Free Use Bible API (bible.helloao.org).
 * No key, no rate limit. See CONTEXT.md rule #6 — never swap to a key-gated service.
 *
 * Used by the Verse Explorer to show the text of a scripture the pastor opened.
 */

const DEFAULT_TRANSLATION = "BSB"; // Berean Standard Bible — modern, free

// Canonical book name / common abbreviation → USFM id used by the API.
const BOOK_IDS = {
  genesis: "GEN", gen: "GEN",
  exodus: "EXO", exo: "EXO", ex: "EXO",
  leviticus: "LEV", lev: "LEV",
  numbers: "NUM", num: "NUM",
  deuteronomy: "DEU", deut: "DEU", deu: "DEU",
  joshua: "JOS", josh: "JOS",
  judges: "JDG", judg: "JDG",
  ruth: "RUT",
  "1 samuel": "1SA", "1samuel": "1SA", "1 sam": "1SA",
  "2 samuel": "2SA", "2samuel": "2SA", "2 sam": "2SA",
  "1 kings": "1KI", "1kings": "1KI", "1 kgs": "1KI",
  "2 kings": "2KI", "2kings": "2KI", "2 kgs": "2KI",
  "1 chronicles": "1CH", "1 chron": "1CH", "1chronicles": "1CH",
  "2 chronicles": "2CH", "2 chron": "2CH", "2chronicles": "2CH",
  ezra: "EZR",
  nehemiah: "NEH", neh: "NEH",
  esther: "EST", est: "EST",
  job: "JOB",
  psalm: "PSA", psalms: "PSA", ps: "PSA", psa: "PSA",
  proverbs: "PRO", prov: "PRO", pro: "PRO",
  ecclesiastes: "ECC", eccl: "ECC",
  "song of solomon": "SNG", "song of songs": "SNG", songs: "SNG",
  isaiah: "ISA", isa: "ISA",
  jeremiah: "JER", jer: "JER",
  lamentations: "LAM", lam: "LAM",
  ezekiel: "EZK", ezek: "EZK",
  daniel: "DAN", dan: "DAN",
  hosea: "HOS", hos: "HOS",
  joel: "JOL",
  amos: "AMO",
  obadiah: "OBA",
  jonah: "JON",
  micah: "MIC", mic: "MIC",
  nahum: "NAM",
  habakkuk: "HAB", hab: "HAB",
  zephaniah: "ZEP", zeph: "ZEP",
  haggai: "HAG",
  zechariah: "ZEC", zech: "ZEC",
  malachi: "MAL", mal: "MAL",
  matthew: "MAT", matt: "MAT", mat: "MAT",
  mark: "MRK", mrk: "MRK",
  luke: "LUK", luk: "LUK",
  john: "JHN", jhn: "JHN",
  acts: "ACT",
  romans: "ROM", rom: "ROM",
  "1 corinthians": "1CO", "1 cor": "1CO", "1corinthians": "1CO",
  "2 corinthians": "2CO", "2 cor": "2CO", "2corinthians": "2CO",
  galatians: "GAL", gal: "GAL",
  ephesians: "EPH", eph: "EPH",
  philippians: "PHP", phil: "PHP", php: "PHP",
  colossians: "COL", col: "COL",
  "1 thessalonians": "1TH", "1 thess": "1TH", "1thessalonians": "1TH",
  "2 thessalonians": "2TH", "2 thess": "2TH", "2thessalonians": "2TH",
  "1 timothy": "1TI", "1 tim": "1TI", "1timothy": "1TI",
  "2 timothy": "2TI", "2 tim": "2TI", "2timothy": "2TI",
  titus: "TIT",
  philemon: "PHM",
  hebrews: "HEB", heb: "HEB",
  james: "JAS", jas: "JAS",
  "1 peter": "1PE", "1 pet": "1PE", "1peter": "1PE",
  "2 peter": "2PE", "2 pet": "2PE", "2peter": "2PE",
  "1 john": "1JN", "1 jn": "1JN", "1john": "1JN",
  "2 john": "2JN", "2 jn": "2JN", "2john": "2JN",
  "3 john": "3JN", "3 jn": "3JN", "3john": "3JN",
  jude: "JUD",
  revelation: "REV", rev: "REV", revelations: "REV",
};

export function bookIdFor(book) {
  if (!book) return null;
  return BOOK_IDS[book.trim().toLowerCase()] || null;
}

// Canonical 66-book order — used to lay out the reverse index / heat-map.
// The first OT_COUNT entries are the Old Testament.
export const BOOK_ORDER = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
  "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation",
];

export const OT_COUNT = 39;

// Short display labels for compact heat-map tiles.
export const BOOK_ABBR = {
  Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num",
  Deuteronomy: "Deut", Joshua: "Josh", Judges: "Judg", Ruth: "Ruth",
  "1 Samuel": "1 Sam", "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs",
  "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr", Ezra: "Ezra", Nehemiah: "Neh",
  Esther: "Esth", Job: "Job", Psalms: "Ps", Proverbs: "Prov",
  Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa", Jeremiah: "Jer",
  Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos",
  Joel: "Joel", Amos: "Amos", Obadiah: "Obad", Jonah: "Jonah",
  Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph",
  Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal",
  Matthew: "Matt", Mark: "Mark", Luke: "Luke", John: "John",
  Acts: "Acts", Romans: "Rom", "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor",
  Galatians: "Gal", Ephesians: "Eph", Philippians: "Phil", Colossians: "Col",
  "1 Thessalonians": "1 Thess", "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim",
  "2 Timothy": "2 Tim", Titus: "Titus", Philemon: "Phlm", Hebrews: "Heb",
  James: "Jas", "1 Peter": "1 Pet", "2 Peter": "2 Pet", "1 John": "1 Jn",
  "2 John": "2 Jn", "3 John": "3 Jn", Jude: "Jude", Revelation: "Rev",
};

/**
 * Fetch the text of a passage. Returns { reference, translation, verses:[{number,text}], text }
 * or null if it can't be resolved. Safe to call from the client.
 */
export async function fetchPassage(
  { book, bookId, chapter, verseStart, verseEnd },
  translation = DEFAULT_TRANSLATION
) {
  const id = bookId || bookIdFor(book);
  if (!id || !chapter) return null;

  try {
    const res = await fetch(
      `https://bible.helloao.org/api/${translation}/${id}/${chapter}.json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.chapter?.content || [];

    const start = verseStart || 1;
    const end = verseEnd || verseStart || 999;

    const verses = [];
    for (const item of content) {
      if (item?.type !== "verse") continue;
      if (item.number < start || item.number > end) continue;
      const text = (item.content || [])
        .map((c) => (typeof c === "string" ? c : c?.text || ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) verses.push({ number: item.number, text });
    }

    if (!verses.length) return null;
    return {
      reference: buildReference(book, chapter, verseStart, verseEnd),
      translation,
      verses,
      text: verses.map((v) => v.text).join(" "),
    };
  } catch {
    return null;
  }
}

export function buildReference(book, chapter, verseStart, verseEnd) {
  let ref = `${book} ${chapter}`;
  if (verseStart) {
    ref += `:${verseStart}`;
    if (verseEnd && verseEnd !== verseStart) ref += `-${verseEnd}`;
  }
  return ref;
}

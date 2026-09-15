import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";

export const metadata = {
  title: "Raising Stronger Believers — FaithHub",
  description:
    "The vision of Heritage of Faith Church: who a stronger believer is, and what enlargement asks of the ones carrying it.",
};

const ANCHOR = "7ikShQi33n4";
const watch = (id, seconds) => `https://youtube.com/watch?v=${id}&t=${seconds}s`;

/* ── small shared pieces ─────────────────────────────────────────── */

function Pull({ children }) {
  return (
    <blockquote className="border-l-2 border-brand-navy/40 pl-4 font-display text-xl italic leading-snug text-brand-ink">
      {children}
    </blockquote>
  );
}

function Subhead({ children }) {
  return (
    <p className="mt-3 text-xs font-bold uppercase tracking-[0.13em] text-brand-gray">
      {children}
    </p>
  );
}

function WatchLink({ href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-brand-navy hover:text-brand-deep"
    >
      <Play className="h-3 w-3" aria-hidden="true" />
      Watch this teaching
    </a>
  );
}

/* One numbered mark: scripture rail on the left, teaching on the right. */
function Mark({ number, refs, title, children }) {
  return (
    <article className="grid gap-5 border-b border-brand-navy/10 py-10 md:grid-cols-[8.5rem_minmax(0,1fr)] md:gap-11">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 md:flex-col md:items-end md:gap-3 md:text-right">
        <span className="font-display text-4xl leading-none text-brand-navy md:text-5xl">
          {number}
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums md:flex-col md:gap-1">
          <span className="hidden text-[0.65rem] font-bold uppercase tracking-[0.13em] text-brand-gray md:block">
            Scripture
          </span>
          {refs.map((r) => (
            <span key={r} className="text-xs text-brand-navy/70">
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="flex max-w-[34rem] flex-col gap-4">
        <h3 className="font-display text-2xl font-medium leading-tight text-brand-ink text-balance sm:text-3xl">
          {title}
        </h3>
        {children}
      </div>
    </article>
  );
}

function PartHeader({ label, title, children }) {
  return (
    <div className="mt-20 flex flex-col gap-3 border-t-2 border-brand-navy pt-4">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
        {label}
      </span>
      <h2 className="font-display text-3xl font-medium leading-tight text-brand-ink text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="max-w-[34rem] text-brand-gray">{children}</p>
    </div>
  );
}

function Component({ title, anchor, wide, children }) {
  return (
    <div
      className={`flex flex-col gap-3 border border-brand-navy/10 border-t-2 border-t-brand-navy/50 bg-white p-6 ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-brand-navy/70">
        {anchor || "Component"}
      </span>
      <h3 className="font-display text-xl font-medium leading-tight text-brand-ink text-balance">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SonshipPoint({ heading, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-brand-gray">
        {heading}
      </h4>
      <p className="text-sm leading-relaxed text-brand-ink">{children}</p>
    </section>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function VisionPage() {
  return (
    <main id="main-content" className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        {/* ── masthead ── */}
        <header className="flex flex-col gap-6 border-b border-brand-navy/15 pb-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-[0.13em] text-brand-gray hover:text-brand-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            FaithHub
          </Link>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-gray">
            <span className="text-brand-navy">Heritage of Faith Church</span>
            <span aria-hidden="true">·</span>
            <span>Lagos</span>
            <span aria-hidden="true">·</span>
            <span>Stewards &amp; Workers</span>
          </div>

          <h1 className="font-display text-5xl font-medium leading-[1.02] tracking-tight text-brand-ink text-balance sm:text-6xl lg:text-7xl">
            Raising{" "}
            <em className="font-normal italic text-brand-navy">Stronger</em>{" "}
            Believers
          </h1>

          <p className="max-w-2xl text-lg text-brand-gray">
            The vision of the house, and what it asks of the people carrying it —
            who a stronger believer is, and what enlargement requires of us.
          </p>
        </header>

        {/* ── the vision statement ── */}
        <section className="pt-12">
          <blockquote className="relative max-w-[30ch] font-display text-2xl font-normal leading-snug tracking-tight text-brand-ink sm:text-3xl lg:text-[2.05rem]">
            <span
              aria-hidden="true"
              className="absolute -left-[0.55em] -top-[0.05em] text-[2.2em] leading-none text-brand-mist"
            >
              &ldquo;
            </span>
            The vision of our ministry is raising stronger believers. And
            we&apos;re not just mouthing words like motivational speaking. No.
            That&apos;s a vision. That&apos;s an instruction God gave us.
            We&apos;re raising stronger believers.
          </blockquote>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-[0.1em] text-brand-gray">
            <span>Rev. Peter Ayo Alabi</span>
            <span aria-hidden="true">·</span>
            <span>Immersion Service</span>
            <a
              href={watch(ANCHOR, 7286)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-brand-navy hover:text-brand-deep"
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              Watch
            </a>
          </div>

          {/* operating charge */}
          <dl className="mt-12 grid gap-px border-y border-brand-navy/10 bg-brand-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["The starting point", "You must know a stronger believer to raise one."],
              ["The test", "Every real vision must be measurable."],
              [
                "The charge",
                "A mark of faithfulness is the ability to retain knowledge in its purest form. Protect truth.",
              ],
              ["The standard", "Vision has to be exact."],
            ].map(([term, def]) => (
              <div key={term} className="flex flex-col gap-2 bg-white p-5">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-brand-navy/70">
                  {term}
                </dt>
                <dd className="font-display text-lg leading-snug text-brand-ink text-pretty">
                  {def}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ══ PART ONE ══ */}
        <PartHeader label="Part One" title="Who is a stronger believer">
          Five marks, given in a fixed order. They answer a diagnostic question —
          why do problems persist so long in the lives of Christians?
        </PartHeader>

        <Mark
          number="1"
          title="One who knows God"
          refs={[
            "Dan 11:32",
            "2 Thess 1:8",
            "Rom 5:6",
            "1 Tim 2:4",
            "1 Cor 6:17",
            "John 17:21–23",
            "Gal 4:9",
            "Col 1:10",
            "Phil 3:10",
            "John 4:24",
          ]}
        >
          <p className="text-lg text-brand-ink">
            <em>
              The people that do know their God shall be strong, and do exploits.
            </em>
          </p>
          <Pull>
            There is strength in knowing God. You can&apos;t know God and not be
            strong.
          </Pull>
          <p className="text-brand-ink">
            Knowing God carries two meanings, and the order matters.{" "}
            <strong className="font-bold">Primarily it means salvation.</strong>{" "}
            To know God is to be intimate with Him, to be in union with Him. Paul
            equates being <em>without strength</em> with being <em>ungodly</em>.
            You cannot be saved without the knowledge of the truth; you are not
            saved until you are in union with the truth.
          </p>
          <p className="text-brand-ink">
            The oneness the Lord prayed for in John 17 is not denominational
            unity. It is union in Christ. You know God, and you are known of God —
            and that is what it means to be saved.
          </p>
          <p className="text-brand-ink">
            <strong className="font-bold">
              Secondarily it means growing in the knowledge of His word.
            </strong>{" "}
            Paul was still pressing to know Him thirty years in.
          </p>

          <Subhead>Relate to Him by truth</Subhead>
          <p className="text-brand-ink">
            God is Spirit, and those who worship Him must worship in spirit and in
            truth. We relate to God on the basis of truth, not on the basis of
            emotion.
          </p>

          <Subhead>Thanksgiving</Subhead>
          <p className="text-brand-ink">
            Never call a good thing a coincidence. Gratitude is a form of humility
            — a proud man does not love to acknowledge that somebody else is
            responsible for what he has. And gratitude for what He did before
            makes it easier to believe what He is saying now.
          </p>

          <Subhead>Tradition</Subhead>
          <p className="text-brand-ink">
            We cannot know God through tradition. Consciously discard information
            that negates God&apos;s word. Anything not instructed or inspired by
            the Holy Ghost is a lifeless practice.
          </p>

          <WatchLink href={watch(ANCHOR, 2108)} />
        </Mark>

        <Mark
          number="2"
          title="One who knows their identity in Christ"
          refs={[
            "Rev 1:5–6",
            "Titus 3:5",
            "2 Cor 5:21",
            "Col 3:3",
            "1 John 5:4",
            "1 Tim 2:5",
            "Eph 4:14",
            "Gal 4:19",
          ]}
        >
          <Pull>
            The identity God has given you in Christ is sonship — the Greek word{" "}
            <em>huios</em>, it means offspring.
          </Pull>
          <p className="text-lg text-brand-ink">
            He has made us kings and priests. Your identity must always be rooted
            in what He has made you — never in what you have achieved.
            Righteousness is an identity received, not a standard reached.
          </p>
          <p className="text-brand-ink">
            Salvation in itself brings an identity upon the one who receives it.
            At salvation you lost your identity to God&apos;s divinity.
          </p>
          <Pull>
            It is more important for you to know who you are in Christ than many
            funny things a lot of people want to know today.
          </Pull>

          <Subhead>The four deaths</Subhead>
          <p className="text-brand-ink">
            The believer is dead to the world, dead to sin, dead to ancestry, and
            dead to Satan. You are dead, and your life is hid with Christ in God.
          </p>

          <Subhead>The mediator</Subhead>
          <p className="text-brand-ink">
            The presence of a prophet does not mean distance between you and God.
            The mediatorship of Christ was done and finished at salvation. We do
            not have a relationship with God where every time we need to talk to
            God we must first knock on Jesus. He brought us to the Father once and
            for all. He is not a go-between.
          </p>

          <Subhead>Discipline in the prophetic</Subhead>
          <ul className="flex flex-col gap-2">
            {[
              "Never be pressurized under the anointing.",
              "Don't try to see by the Spirit. If there is something to see, the Spirit will show you.",
              "A prophet must not be a blab-mouth.",
              "Be satisfied to do the things of the Spirit without receiving recognition.",
            ].map((line) => (
              <li key={line} className="flex items-baseline gap-3 text-brand-ink">
                <span
                  aria-hidden="true"
                  className="mt-[0.4rem] h-1 w-1 flex-shrink-0 rounded-full bg-brand-navy"
                />
                <span>{line}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-3 text-brand-ink">
              <span
                aria-hidden="true"
                className="mt-[0.4rem] h-1 w-1 flex-shrink-0 rounded-full bg-brand-navy"
              />
              <span>
                Revelation comes for three things —{" "}
                <strong className="font-bold">prayer</strong>,{" "}
                <strong className="font-bold">teaching</strong>,{" "}
                <strong className="font-bold">correction</strong>.
              </span>
            </li>
          </ul>
          <p className="text-brand-ink">
            If a false prophet can sway you, you are not a strong Christian.
          </p>

          <Subhead>Identity inside the local church</Subhead>
          <p className="text-brand-ink">
            Every church must decide what they will be known for. It is what you
            do that you will be known for. Don&apos;t become an unidentifiable
            specie — not even within the local church.
          </p>

          <Subhead>The four stabilities</Subhead>
          <p className="text-brand-ink">
            That we be no more children, tossed to and fro. Stability is proved in
            four places: <strong className="font-bold">convictions</strong>,{" "}
            <strong className="font-bold">practices</strong>,{" "}
            <strong className="font-bold">relationships</strong>, and{" "}
            <strong className="font-bold">service</strong>. Be consistent in your
            commitment to relationships — can you keep friendships? And never be
            too big to serve.
          </p>

          <WatchLink href={watch(ANCHOR, 4218)} />
        </Mark>

        <Mark
          number="3"
          title="One who knows their rights and privileges"
          refs={["James 1:5–6", "Acts 3:6", "2 Cor 5:17"]}
        >
          <Pull>The Bible is our constitution.</Pull>
          <p className="text-brand-ink">
            In a room full of professionals, only the lawyers had ever read the
            Nigerian constitution — the document that governs every one of them.
            It is the same way many Christians think the truth of the word is only
            for pastors. It is not. It governs you, and you are entitled to know
            it.
          </p>
          <Pull>
            When you know your rights and privileges, the devil cannot cheat you.
          </Pull>

          <Subhead>Answered prayer is a right</Subhead>
          <p className="text-brand-ink">
            Getting answered prayers is a right. Never ask God for anything on the
            basis of your performance. But do not vacillate between faith and
            unbelief — a man who wavers should not think he will receive anything
            of the Lord.
          </p>

          <Subhead>The name of Jesus</Subhead>
          <p className="text-brand-ink">
            <em>Silver and gold have I none, but such as I have give I thee.</em>{" "}
            Peter&apos;s consciousness of what he carried was his spending power.
          </p>
          <p className="text-brand-ink">
            We all have the same rights and privileges as new creation.
          </p>

          <WatchLink href={watch(ANCHOR, 4989)} />
        </Mark>

        <Mark
          number="4"
          title="One who knows their God-given assignment"
          refs={["Dan 11:32"]}
        >
          <Pull>
            Number four is the one who knows his assignment — one who knows their{" "}
            <em>God-given</em> assignment, not just assignment. I&apos;m
            delivering to you as I receive from the Lord.
          </Pull>

          <Subhead>Why this order</Subhead>
          <p className="text-brand-ink">
            He asked the Lord why the marks come in this particular order.
          </p>
          <Pull>
            The first four are things you must act on. You mustn&apos;t just know
            them. Knowing God must be evident in your actions. Knowing who you are
            in Christ must be evident in your actions. Knowing your rights and
            privileges must be evidenced in your actions. And then knowing your
            assignment must be evidenced in your actions.
          </Pull>

          <Subhead>The evidence of it</Subhead>
          <p className="text-brand-ink">
            <em>
              The people that do know their God shall be strong, and do exploits.
            </em>{" "}
            People who know God do bold and big things. A person who knows God
            will do something bigger than himself.
          </p>

          <WatchLink href={watch(ANCHOR, 10786)} />
        </Mark>

        <Mark
          number="5"
          title="One who is a doer of the word"
          refs={["2 Cor 5:15", "James 1:22–25"]}
        >
          <p className="text-lg text-brand-ink">
            He died for all, that they which live should not henceforth live unto
            themselves, but unto him which died for them. We must live for the One
            who died for us.
          </p>
          <Pull>Don&apos;t know so much and do so little.</Pull>
          <p className="text-brand-ink">
            The word works for the one who works it. A doer is not a forgetful
            hearer — he does not look into the perfect law of liberty and walk
            away having forgotten what manner of man he was. He adjusts himself to
            the word rather than adjusting the word to himself.
          </p>

          <Subhead>What this asks of the house</Subhead>
          <p className="text-brand-ink">
            A church is not an entertainment centre. A church is a place of
            edification. Lay your own agenda by the side and carry His agenda on
            your head.
          </p>

          <WatchLink href={watch("55BvIbIvaVQ", 9559)} />
        </Mark>

        {/* ══ PART TWO ══ */}
        <PartHeader
          label="Part Two"
          title="The five components of enlargement"
        >
          Not a sequence — five things held together. Enlargement is what the
          vision requires of the ones carrying it.
        </PartHeader>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Component title="Embody the vision of the Church">
            <Pull>
              I&apos;ve joined myself to this vision. I don&apos;t have my own
              vision. The vision of the house is my vision.
              <span className="mt-2 block text-[0.65rem] font-bold uppercase tracking-[0.1em] not-italic text-brand-gray">
                Pastor Funlola Alabi
              </span>
            </Pull>
            <p className="text-sm text-brand-ink">
              When the set man says <em>I have a vision</em>, it is the vision of
              the Lord — he is only a custodian of it. Embodying it means it stops
              being his and becomes yours.
            </p>
            <p className="text-sm text-brand-ink">
              Writing makes an exact man. Show honour for the word of God by the
              way you receive it and by the way you store it.
            </p>
            <p className="text-sm text-brand-ink">
              <strong className="font-bold">The vision, concretely:</strong>{" "}
              planting churches of 200 to 250 in size — a thousand of them.
            </p>
            <p className="text-sm text-brand-ink">
              Paul did not say commit it to <em>able</em> men. He said commit it
              to <em>faithful</em> men. Talent is plenty. Talent is ubiquitous.
            </p>
          </Component>

          <Component title="Take your spiritual growth more seriously">
            <Pull>
              Spiritual growth is not the growth of your spirit man. It&apos;s the
              growing influence of your reborn spirit over your soul.
            </Pull>
            <p className="text-sm text-brand-ink">
              Said another way: the increasing influence of the truth of
              God&apos;s word on your mind.
            </p>
            <p className="text-sm text-brand-ink">
              One cold snack on a Sunday, once a week, tells you clearly where
              your allegiance lies. You will not grow that way.
            </p>
            <p className="text-sm text-brand-ink">
              Your spiritual growth is first of all for your own benefit. But as
              we mature, more is expected of us — as you grow in the things of God
              you are better equipped to handle situations.
            </p>
          </Component>

          <Component title="Generosity">
            <Pull>
              Be generous without expecting to collect something from the person.
              Expect returns from God, not from the people you give to.
            </Pull>
            <p className="text-sm text-brand-ink">
              The ultimate benefit of our giving is not just the harvest. Beyond
              the harvest is who we become in the process.
            </p>
            <p className="text-sm text-brand-ink">
              You should naturally desire to be generous towards the things of
              God.
            </p>
            <p className="text-sm text-brand-ink">
              And to have an entrepreneurial mind requires a generous mind.
            </p>
          </Component>

          <Component title="Practice extra commitment">
            <Pull>
              You don&apos;t grow big to manage well. You manage well to grow big.
            </Pull>
            <p className="text-sm text-brand-ink">
              Excel in your commitments. When you are productive in the house of
              God it is not a matter of promotion — it is a matter of growth. God
              can now entrust more into your hands.
            </p>
            <p className="text-sm text-brand-ink">
              People without character are dangerous people. The most gifted are
              not necessarily the most promising.
            </p>
            <p className="text-sm text-brand-ink">
              The counterweight: serve out of love, not to earn a blessing — and
              guard against over-committing yourself into weariness. Never too big
              to serve.
            </p>
          </Component>

          <Component
            wide
            title="Be rooted in sonship"
            anchor="Component · Anchor text 2 Cor 1:24"
          >
            <p className="max-w-[34rem] text-base text-brand-ink">
              The local church is not built upon the talent of a few. It is built
              upon the sacrifices of many.
            </p>

            <div className="mt-3 grid gap-x-9 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <SonshipPoint heading="It begins with making yourself known">
                People come and submit and say{" "}
                <em>the Lord led me to you to be a son</em>. By that statement you
                made known your intention for coming close — but that does not
                mean you have arrived.
              </SonshipPoint>

              <SonshipPoint heading="You grow from a spot in a shepherd's heart">
                God is the One who puts the care of His flock in the heart of the
                shepherd. When you receive the labour of ministry, you are
                becoming a son.
              </SonshipPoint>

              <SonshipPoint heading="Not an organization — an organism">
                The church is a living organism, not an organization. Don&apos;t
                be a professional member. Be a son. We are not saving men unto
                ourselves; we are saving men unto the Lord and planting them in
                His house.
              </SonshipPoint>

              <SonshipPoint heading="It means allowing accountability">
                Accountability is not bondage. It is safety. A life without
                accountability is like a car without brakes — it doesn&apos;t stop
                movement, it controls movement. People who don&apos;t want to be
                accountable to an anointing can&apos;t get the best of that
                anointing.
              </SonshipPoint>

              <SonshipPoint heading="Errands are a characteristic of it">
                One of the major characteristics of sonship is errands. And
                sonship is not a father-Christmas relationship.
              </SonshipPoint>

              <SonshipPoint heading="Recommendation">
                Your pastor must be able to recommend you.
              </SonshipPoint>

              <SonshipPoint heading="No man sponsors a destiny">
                No man is a helper of your destiny. Nobody can sponsor your
                destiny — only God can afford it. If man sponsors you, you can be
                stranded; he can run out of funds, he can change his mind. God
                doesn&apos;t need your father&apos;s money to sponsor your
                calling.
              </SonshipPoint>

              <SonshipPoint heading="Let God raise the ones He wants">
                Man is God&apos;s method — but not always. Don&apos;t pick them.
                God reduced Gideon&apos;s army rather than accept the men Gideon
                would have chosen. God does not consult men before choosing men.
              </SonshipPoint>

              <SonshipPoint heading="Produce with your own faith">
                You cannot live on what your father&apos;s faith produced. Use it
                as leverage, but be circumspect — you cannot live your Christian
                life with another man&apos;s faith.
              </SonshipPoint>

              <SonshipPoint heading="Faith, not pocket">
                Put your children in the school your faith can afford, not the
                school your salary can afford. The matter of your children&apos;s
                education is a matter of faith, not of your pocket. You must
                stretch.
              </SonshipPoint>

              <SonshipPoint heading="Money and preaching stay separate">
                Anything you do for the Lord must never be for money. Otherwise
                you will never preach what God wants — you will preach what will
                motivate more money to come.
              </SonshipPoint>

              <SonshipPoint heading="Handle access well">
                A son learns how to handle access. Be sensitive to the person who
                holds the key to the door. Don&apos;t be quick to ask for favours,
                and never try to figure out how a person should use what belongs
                to them. Bad manners brings disfavour; a well-fathered person is
                set up for favour.
              </SonshipPoint>
            </div>
          </Component>
        </div>

        {/* ══ PART THREE ══ */}
        <PartHeader
          label="Part Three"
          title="Process, and the seriousness it asks for"
        >
          A church that will not wait for people to grow will wail when untrained
          people destroy it.
        </PartHeader>

        <div className="mt-8 flex max-w-[34rem] flex-col gap-5">
          <Pull>
            The urgency of God&apos;s word doesn&apos;t call for hastiness. It
            calls for seriousness.
          </Pull>
          <p className="text-brand-ink">
            Hastiness is not proof of love — many times it is proof of anxiety.{" "}
            <em>He that believeth shall not make haste.</em> When God wants to do
            something urgent, He does not use a hasty person. He uses a serious
            person.
          </p>
          <p className="text-brand-ink">
            Every process of God is training you for something else. Training puts
            substance in you, and training never ends — the anointed must be
            apprenticed. Let patience have her perfect work, that you may be
            perfect and entire, wanting nothing.
          </p>

          <Subhead>On convictions</Subhead>
          <p className="text-brand-ink">
            Conviction is whatever your heart takes seriously — and there must be
            a commitment to that conviction. If you are not deliberate about
            strengthening your convictions, you will begin to lose them. Pray to
            be strengthened with might by His Spirit in the inner man.
          </p>

          <Subhead>The bearing of it</Subhead>
          <p className="text-brand-ink">
            We must live very godly and content lives. Godliness with contentment
            is great gain. And the Holy Ghost will lead us by giving us structures
            and also by spontaneous instruction — and the two must not be at
            variance with each other.
          </p>

          <Pull>It is really Jesus that we are following.</Pull>
        </div>

        {/* ── colophon ── */}
        <p className="mt-16 max-w-2xl border-t border-brand-navy/10 pt-6 text-xs leading-relaxed text-brand-gray">
          Heritage of Faith Church, Lagos · prepared for stewards and workers.
          Teaching of Rev. Peter Ayo Alabi except where otherwise attributed.
          Quotations are transcribed from recorded services — verify wording
          against the linked moment before reproducing in print.
        </p>
      </div>
    </main>
  );
}

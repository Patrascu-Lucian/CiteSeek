/** **Quotes, not offsets**: ids are minted per ingest and offsets move on any
 * edit, so a quote that stops matching fails the run rather than scoring zero.
 * `expect: []` is a question the corpus cannot answer — the floor's job. */

export type Expectation = { file: string; quote: string };

export type GoldenCase = {
  question: string;
  expect: readonly Expectation[];
};

const SUPPORT = "meridian-support-policy.md";
const MANUAL = "harbourline-equipment-manual.md";
const TENANCY = "larkfield-tenancy-agreement.md";

export const GOLDEN_SET: readonly GoldenCase[] = [
  // Meridian — support policy
  {
    question: "How quickly does someone get back to me if everything is down?",
    expect: [
      { file: SUPPORT, quote: "30 minutes for Severity 1, two hours for" },
    ],
  },
  {
    question: "Does the response clock keep running through the night?",
    expect: [
      { file: SUPPORT, quote: "the clock does not run overnight" },
      { file: SUPPORT, quote: "covered 09:00 to 18:00" },
    ],
  },
  {
    question: "Can I push a ticket up the chain more than once?",
    expect: [{ file: SUPPORT, quote: "requires a named business impact" }],
  },
  {
    question: "Does pushing a ticket up make it more urgent?",
    expect: [{ file: SUPPORT, quote: "does not change its severity" }],
  },
  {
    question: "What do I get back if you miss a target?",
    expect: [
      { file: SUPPORT, quote: "credits 5% of the monthly fee" },
      { file: SUPPORT, quote: "capped at 25% in any calendar month" },
    ],
  },
  {
    question: "Do I have to ask for the money back or is it automatic?",
    expect: [
      {
        file: SUPPORT,
        quote: "Credits are applied automatically to the next invoice",
      },
    ],
  },
  {
    question: "Can your engineers ask for a copy of our live database?",
    expect: [
      { file: SUPPORT, quote: "may not request production data extracts" },
    ],
  },
  {
    question: "How long do you keep whatever I attach to a ticket?",
    expect: [{ file: SUPPORT, quote: "90 days after closure" }],
  },
  {
    question: "Will an engineer be moving my mouse during a call?",
    expect: [{ file: SUPPORT, quote: "takes control of a customer machine" }],
  },
  {
    question: "How much warning do I need to give before it renews?",
    expect: [
      { file: SUPPORT, quote: "unless cancelled 30 days before the renewal" },
    ],
  },
  {
    question: "If I drop to the cheaper tier, when does that start?",
    expect: [
      { file: SUPPORT, quote: "takes effect at renewal, never mid-term" },
    ],
  },
  {
    question: "What happens to tickets I already have open if I cancel?",
    expect: [{ file: SUPPORT, quote: "they run to resolution under the plan" }],
  },

  // Harbourline — equipment manual
  {
    question: "How much force does this thing actually put out?",
    expect: [{ file: MANUAL, quote: "The press develops 90 kilonewtons" }],
  },
  {
    question: "Do I need ear defenders standing next to it?",
    expect: [{ file: MANUAL, quote: "measures 84 dB at one metre" }],
  },
  {
    question: "Which oil goes in it?",
    expect: [{ file: MANUAL, quote: "Use ISO VG 46 mineral oil" }],
  },
  {
    question: "How often does the oil need replacing?",
    expect: [
      { file: MANUAL, quote: "every 2,000 operating hours or annually" },
    ],
  },
  {
    question: "Why does it feel jerky when I first switch it on?",
    expect: [
      {
        file: MANUAL,
        quote: "mineral oil and about ninety seconds on synthetic",
      },
    ],
  },
  {
    question: "What temperature is too hot for it to run at?",
    expect: [{ file: MANUAL, quote: "above 70" }],
  },
  {
    question: "How tight do the tooling bolts go?",
    expect: [{ file: MANUAL, quote: "four M16 bolts torqued to 210 Nm" }],
  },
  {
    question: "Is there a point where a resharpened tool is too thin to use?",
    expect: [
      { file: MANUAL, quote: "reground below 38 mm thickness must not be" },
    ],
  },
  {
    question: "The over-temperature warning will not go away after a restart.",
    expect: [{ file: MANUAL, quote: "latches until the oil falls below 60" }],
  },
  {
    question: "The two pressure readings disagree with each other.",
    expect: [
      { file: MANUAL, quote: "indicates a pressure sensor disagreement" },
    ],
  },
  {
    question: "Anything to do before putting it on a lorry?",
    expect: [{ file: MANUAL, quote: "Retract the ram fully before transport" }],
  },
  {
    question: "It is going into a damp shed for the winter.",
    expect: [
      { file: MANUAL, quote: "humidity above 60% requires a desiccant" },
    ],
  },

  // Larkfield — tenancy agreement
  {
    question: "When is the money due each month and how do I send it?",
    expect: [
      {
        file: TENANCY,
        quote: "payable monthly in advance on the first day of each month",
      },
    ],
  },
  {
    question: "Is there a ceiling on how much it can go up?",
    expect: [
      {
        file: TENANCY,
        quote: "capped at the lower of the consumer price index or 4%",
      },
    ],
  },
  {
    question: "How much do I have to hand over at the start?",
    expect: [{ file: TENANCY, quote: "The deposit is five weeks' rent" }],
  },
  {
    question: "Can I be charged for repainting when I leave?",
    expect: [
      {
        file: TENANCY,
        quote: "not be made for redecoration attributable to",
      },
    ],
  },
  {
    question: "The boiler died in January. How fast should someone come?",
    expect: [
      {
        file: TENANCY,
        quote: "Emergency repairs are attended within 24 hours",
      },
    ],
  },
  {
    question: "Nobody is answering and water is coming through the ceiling.",
    expect: [
      { file: TENANCY, quote: "recover the reasonable cost against rent" },
    ],
  },
  {
    question: "Can the owner turn up unannounced?",
    expect: [
      {
        file: TENANCY,
        quote: "requires 24 hours' written notice before entering",
      },
    ],
  },
  {
    question: "How much notice do I give to move out?",
    expect: [{ file: TENANCY, quote: "the landlord gives two months'" }],
  },
  {
    question: "Is a text message enough to give notice?",
    expect: [{ file: TENANCY, quote: "Notice must be in writing" }],
  },
  {
    question: "My partner has been staying over for a month.",
    expect: [
      { file: TENANCY, quote: "14 consecutive nights require notification" },
    ],
  },
  {
    question: "Does having a dog cost extra?",
    expect: [{ file: TENANCY, quote: "Consent carries an additional deposit" }],
  },

  /*
    Term-heavy, because everything above is phrased away from the documents' words
    — right for testing a vector search, and unable to show what lexical search is
    for. Adding this is what made the hybrid comparison fair (ADR 021).
  */
  {
    question: "What does E04 mean?",
    expect: [{ file: MANUAL, quote: "indicates over-temperature and latches" }],
  },
  {
    question: "ISO VG 46",
    expect: [{ file: MANUAL, quote: "Use ISO VG 46 mineral oil" }],
  },
  {
    question: "M16 torque spec",
    expect: [{ file: MANUAL, quote: "four M16 bolts torqued to 210 Nm" }],
  },
  {
    question: "What counts as Severity 2?",
    expect: [
      { file: SUPPORT, quote: "Severity 2 means a production system is" },
    ],
  },
  {
    question: "What is the HL-90?",
    expect: [{ file: MANUAL, quote: "Harbourline HL-90 Bench Press" }],
  },
  {
    question: "clause 7",
    expect: [{ file: TENANCY, quote: "Pets require written consent" }],
  },

  /*
    Answerable by none of the three. A floor tuned only against the questions above
    would let all of these through and look excellent doing it.
  */
  { question: "How do I reset my password?", expect: [] },
  { question: "Which insurance company underwrites the property?", expect: [] },
  {
    question: "What is the warranty period on the hydraulic pump?",
    expect: [],
  },
  { question: "Who is the current chief executive?", expect: [] },
  { question: "Is there parking included?", expect: [] },
  { question: "What are the fire evacuation arrangements?", expect: [] },
  { question: "Can I get this in French?", expect: [] },
  { question: "How many people work in the support team?", expect: [] },
  { question: "What is the capital of Portugal?", expect: [] },
  { question: "Does the press come in a wider bed size?", expect: [] },
];

/** Separate from `GOLDEN_SET`, or every previously recorded number moves. */
export type FollowUpCase = {
  /** The turns before it, for a rewriting step to read. Not embedded today. */
  context: readonly string[];
  followUp: string;
  standalone: string;
  /** A passage the context turn would not already have retrieved, or the case
   * scores 1.00 whether or not the follow-up was understood. */
  expect: readonly Expectation[];
};

export const FOLLOW_UP_SET: readonly FollowUpCase[] = [
  {
    context: ["What is the maximum oil temperature?"],
    followUp: "and the fault code?",
    standalone: "Which fault code indicates over-temperature?",
    expect: [{ file: MANUAL, quote: "indicates over-temperature and latches" }],
  },
  {
    context: ["Is support covered at the weekend?"],
    followUp: "on premier?",
    standalone: "Are Premier plans covered at weekends?",
    expect: [{ file: SUPPORT, quote: "covered continuously" }],
  },
  {
    context: ["What oil does the press take?"],
    followUp: "how often?",
    standalone: "How often should the hydraulic oil be changed?",
    expect: [
      { file: MANUAL, quote: "every 2,000 operating hours or annually" },
    ],
  },
  {
    context: ["What oil does the press take?"],
    followUp: "and the filter?",
    standalone: "How often is the hydraulic filter changed?",
    expect: [{ file: MANUAL, quote: "The filter is changed at the same" }],
  },
  {
    context: ["Can I keep a cat?"],
    followUp: "what about the deposit?",
    standalone: "Does keeping a pet require an additional deposit?",
    expect: [{ file: TENANCY, quote: "Consent carries an additional deposit" }],
  },
  {
    context: ["How much notice must I give to leave?"],
    followUp: "in writing?",
    standalone: "Must notice to end the tenancy be in writing?",
    expect: [{ file: TENANCY, quote: "Notice must be in writing" }],
  },

  /* Carrying no term of their own. An earlier set of six scored 0.83, and five
     of the six held a discriminative word retrieval finds with no context at
     all — the mean was measuring the sampling. */
  {
    context: ["What can be deducted from the deposit at the end?"],
    followUp: "how much is it?",
    standalone: "How much is the tenancy deposit?",
    expect: [{ file: TENANCY, quote: "The deposit is five weeks' rent" }],
  },
  {
    context: ["Are resolution times guaranteed for a Severity 3 defect?"],
    followUp: "why?",
    standalone: "Why are Severity 3 resolution times not contractual?",
    expect: [{ file: SUPPORT, quote: "scheduled against the release train" }],
  },
  {
    context: ["Can a customer escalate a ticket?"],
    followUp: "who handles it then?",
    standalone: "Who owns a ticket after it is escalated?",
    expect: [{ file: SUPPORT, quote: "duty lead, who owns it until closure" }],
  },
  {
    context: ["What are the coverage hours on a Standard plan?"],
    followUp: "and outside them?",
    standalone:
      "What happens to a Severity 1 ticket raised outside covered hours?",
    expect: [
      { file: SUPPORT, quote: "begin their 30-minute clock when coverage" },
    ],
  },
];

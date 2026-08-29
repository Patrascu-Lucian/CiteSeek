# Local answers, in a browser

Run 2026-08-29 against `http://localhost:3000`, on WebGPU.

The questions and the scorer come from `eval:local-answers`, and retrieval is
the page's own — so this is that harness's eight-passage row, measured where
the product runs. The oracle column has no equivalent: the UI has no way to
hand a passage over.

Each question is asked in its own browser, because `useChat` sends the whole
history and the CPU harness asks every question cold.

`cited` counts **citation chips in the answer**, not `[n]` in the text. Markers
are rewritten into links before rendering, so a bracket never reaches the DOM;
a chip is also the stricter claim, since it resolved to a passage.

**Grounded 13/24, cited 2/24.**
Compare against the eight-passage row of `eval/local-answers.md`, which is the
same questions on the CPU. The comparison is written up in `docs/backlog.md`
rather than here, because a number copied into two generated files goes stale
in one of them.

## Per question

| question | grounded | chips |
| -------- | -------- | ----- |
| How quickly does someone get back to me if everything is down? | yes | 0 |
| How long do you keep whatever I attach to a ticket? | **no** | 0 |
| How much warning do I need to give before it renews? | **no** | 0 |
| What do I get back if you miss a target? | **no** | 0 |
| The boiler died in January. How fast should someone come? | **no** | 0 |
| How much notice do I give to move out? | **no** | 0 |
| How much do I have to hand over at the start? | **no** | 0 |
| What hours is the standard plan covered? | yes | 0 |
| How much force does the press develop? | yes | 0 |
| How loud is it at a metre? | yes | 0 |
| Which oil grade goes in it? | yes | 0 |
| How often does the oil need changing? | **no** | 1 |
| What oil temperature is too hot? | yes | 0 |
| What torque do the die bolts take? | **no** | 1 |
| How thin can a die be reground before it is scrap? | yes | 0 |
| How far apart can the pressure sensors read before it stops? | yes | 0 |
| What humidity needs a desiccant in storage? | yes | 0 |
| How much can the rent go up by? | yes | 0 |
| How long does the deposit take to be protected? | **no** | 0 |
| How fast is a non-emergency repair attended? | yes | 0 |
| How long can a guest stay before I have to tell anyone? | **no** | 0 |
| How much is the extra deposit for a pet? | yes | 0 |
| How much notice do I give if I am leaving? | **no** | 0 |
| What is the cap on credits in a month? | yes | 0 |

## Answers

Verbatim, including the model's own spelling — "regground", "every 1 years".
Correcting those edits the evidence.

**How quickly does someone get back to me if everything is down?**

> According to the Meridian Software Customer Support Policy, customers receive a standard response time of 30 minutes from ticket creation to the duty engineer.

**How long do you keep whatever I attach to a ticket?**

> The ticket system runs to resolution under the plan in force when they were raised.

**How much warning do I need to give before it renews?**

> Two months

**What do I get back if you miss a target?**

> If you miss a target, you receive a credit towards future service costs based on the severity level of the missed target. The amount of the credit depends on the number of months since the last missed target and whether the target was resolved.

**The boiler died in January. How fast should someone come?**

> At the same interval and not cleanable — a filter that looks clean has usually failed open.

**How much notice do I give to move out?**

> To determine how much notice you should give to move out, please refer to the following clauses:
> Notice must be in writing.
> A notice served by message or spoken in person has no effect, which protects both parties from a disagreement about what was said.
> Therefore, based on these clauses, you should provide at least one month's notice to move out.

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the relevant section of the property agreement. According to the information provided, the standard terms specify that rent is payable monthly in advance on the first day of each month. Therefore, the amount you should hand over at the start depends on whether you are renting under a standard plan or a premium plan.
> If you are renting under a standard plan:
> The amount you should hand over at the start is calculated based on the number of months you intend to rent (e.g., 12 months for a full year).
> For example, if you plan to rent for 12 months, you should hand over the full amount of rent for those 12 months.
> If you are renting under a premium plan:
> The amount you should hand over at the start is calculated based on the number

**What hours is the standard plan covered?**

> The standard plan is covered 09:00 to 18:00 in the customer's registered timezone.

**How much force does the press develop?**

> 90 kilonewtons

**How loud is it at a metre?**

> 84 dB

**Which oil grade goes in it?**

> ISO VG 46 mineral oil

**How often does the oil need changing?**

> The oil needs changing every 1 years.

**What oil temperature is too hot?**

> 70°C

**What torque do the die bolts take?**

> The torque takes 2 Nm.

**How thin can a die be reground before it is scrap?**

> A die that has been regground below 38 mm thickness must not be refitted.

**How far apart can the pressure sensors read before it stops?**

> 5 bar

**What humidity needs a desiccant in storage?**

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration.

**How much can the rent go up by?**

> According to the information provided in the Larkfield Tenancy Agreement (LTA), the rental amount can increase by up to 4% annually. This is stated directly in the first paragraph of the agreement, which mentions "any increase is capped at the lower of the consumer price index or 4%. "

**How long does the deposit take to be protected?**

> The deposit takes 5 weeks to be protected.

**How fast is a non-emergency repair attended?**

> emergency repairs are attended within 14 days.

**How long can a guest stay before I have to tell anyone?**

> 28 nights

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> To determine how much notice you should give if you are leaving, refer to the section titled "Notice." This section specifies that a notice must be in writing. Therefore, you should provide a clear and explicit notice to the landlord upon leaving the property.

**What is the cap on credits in a month?**

> The cap on credits in a month is 25%.

